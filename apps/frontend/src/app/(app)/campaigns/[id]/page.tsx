'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Play, Pause, RotateCcw, X, Copy, ArrowLeft, CheckCircle2,
  XCircle, Clock, Zap, Shield, Bot, Timer, ChevronRight,
  Trash2, ExternalLink, Film,
} from 'lucide-react';

import { api } from '@/lib/api';
import type { CampaignProgress, Paginated, PostListRow } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/status-badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate } from '@/lib/utils';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

// ─── Countdown hook ─────────────────────────────────────────────────────────
function useCountdown(intervalSeconds: number, isRunning: boolean) {
  const [remaining, setRemaining] = useState(intervalSeconds);
  useEffect(() => {
    if (!isRunning) { setRemaining(intervalSeconds); return; }
    setRemaining(intervalSeconds);
    const tick = window.setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) { return intervalSeconds; }
        return r - 1;
      });
    }, 1000);
    return () => window.clearInterval(tick);
  }, [isRunning, intervalSeconds]);
  return remaining;
}

// ─── Facebook post preview ────────────────────────────────────────────────────
function PostPreview({ post }: { post: PostListRow }) {
  const isPublished = post.status === 'PUBLISHED';
  const isFailed = post.status === 'FAILED';
  const isCancelled = post.status === 'CANCELLED';
  const pageName = post.page?.name ?? post.pageId.slice(0, 8);
  const images = (post.imageUrls ?? []).slice(0, 3);
  const extraImages = (post.imageUrls?.length ?? 0) - images.length;
  const statusLabel = isPublished ? 'Publicado' : isFailed ? 'Fallido' : isCancelled ? 'Cancelado' : 'Pendiente';

  return (
    <div className={`rounded-xl border bg-card p-3.5 transition-all ${isPublished ? 'border-emerald-500/40 bg-emerald-500/5' : isFailed ? 'border-destructive/30 bg-destructive/5' : 'border-border'}`}>
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#1877F2] text-[10px] font-bold text-white">
          {pageName.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="truncate text-sm font-semibold">{pageName}</span>
            <span className="shrink-0 text-[10px] text-foreground/40">· Facebook</span>
          </div>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-foreground/80 line-clamp-3">{post.content}</p>

          {/* Media: imágenes y video (compacto) */}
          {(images.length > 0 || post.videoUrl) ? (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {images.map((u) => (
                <img key={u} src={u} alt="" className="size-12 rounded-md border border-border object-cover sm:size-14" />
              ))}
              {extraImages > 0 && (
                <span className="flex size-12 items-center justify-center rounded-md border bg-muted text-xs font-medium text-foreground/50 sm:size-14">
                  +{extraImages}
                </span>
              )}
              {post.videoUrl ? (
                <span className="inline-flex h-5 items-center gap-1 rounded-full bg-muted px-2 text-[10px] font-medium text-foreground/60">
                  <Film className="size-3" /> Video
                </span>
              ) : null}
            </div>
          ) : null}

          <div className="mt-2 flex items-center justify-between gap-2 border-t border-border/60 pt-1.5">
            <span className={`flex items-center gap-1 text-[11px] font-medium ${isPublished ? 'text-emerald-600 dark:text-emerald-400' : isFailed ? 'text-destructive' : 'text-foreground/40'}`}>
              {isPublished ? <CheckCircle2 className="size-3" /> : isFailed ? <XCircle className="size-3" /> : <Clock className="size-3" />}
              {statusLabel}
            </span>
            {isPublished && post.metaPermalinkUrl ? (
              <a
                href={post.metaPermalinkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-[#1877F2] hover:underline"
              >
                <ExternalLink className="size-3" /> Ver en Facebook
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CampaignDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<CampaignProgress | null>(null);
  const [posts, setPosts] = useState<PostListRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(() => {
    Promise.all([
      api.get<CampaignProgress>(`/campaigns/${params.id}/progress`),
      api.get<Paginated<PostListRow>>(`/posts?campaignId=${params.id}&limit=100`),
    ])
      .then(([progress, postsRes]) => {
        setData(progress);
        setPosts(postsRes.data);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'No se pudo cargar la campaña'));
  }, [params.id]);

  useEffect(() => { void load(); }, [load]);

  const isActive = ['SCHEDULED', 'RUNNING', 'PAUSED'].includes(data?.campaign.status ?? '');
  useEffect(() => {
    if (!isActive) return;
    const timer = window.setInterval(() => void load(), 4000);
    return () => window.clearInterval(timer);
  }, [isActive, load]);

  const run = useCallback(async (action: string) => {
    setBusy(action);
    try {
      await api.post(`/campaigns/${params.id}/${action}`);
      toast.success(`Acción completada`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Acción fallida');
    } finally {
      setBusy(null);
    }
  }, [params.id, load]);

  async function deleteCampaign() {
    setBusy('delete');
    try {
      await api.delete(`/campaigns/${params.id}`);
      toast.success('Campaña eliminada');
      router.push('/campaigns');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo eliminar');
      setBusy(null);
    }
  }

  const countdown = useCountdown(data?.campaign.intervalSeconds ?? 5, data?.campaign.status === 'RUNNING');

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!data) return <LoadingSkeleton />;

  const c = data.campaign;
  const progress = c.totalActions > 0 ? c.actionsDone / c.totalActions : 0;
  const pct = Math.min(100, Math.round(progress * 100));
  const isRunning = c.status === 'RUNNING';
  const isDone = ['COMPLETED', 'CANCELLED', 'FAILED'].includes(c.status);

  // Contadores para el encabezado y las tarjetas de estado
  const publishedCount = data.postsDone;
  const failedCount = data.postsFailed;
  const pendingCount = data.postsTotal - publishedCount - failedCount;

  return (
    <div className="space-y-4">
      {/* Header */}
      <PageHeader title={c.name} subtitle={`Creada ${formatDate(c.createdAt)}`}>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => router.push('/campaigns')}>
            <ArrowLeft className="size-4" /> Volver
          </Button>
          {isDone && (
            <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="size-4" /> Eliminar
            </Button>
          )}
        </div>
      </PageHeader>

      {/* Status bar */}
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-5 pb-5">
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge value={c.status} />
            {/* Safe mode badge */}
            <span className="flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <Shield className="size-3" /> Modo seguro activo
            </span>
            {c.aiGenerated && (
              <span className="flex items-center gap-1 rounded-full border border-[#1877F2]/30 bg-[#1877F2]/10 px-2.5 py-1 text-xs font-medium text-[#1877F2]">
                <Bot className="size-3" /> Generado con IA
              </span>
            )}
            {/* Live countdown */}
            {isRunning && (
              <span className="flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                <Timer className="size-3 animate-pulse" /> Próxima publicación en {countdown}s
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {['DRAFT', 'SCHEDULED', 'PAUSED'].includes(c.status) && (
              <Button size="sm" disabled={busy !== null} onClick={() => void run('start')}>
                <Play className="size-4" /> Iniciar
              </Button>
            )}
            {c.status === 'RUNNING' && (
              <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void run('pause')}>
                <Pause className="size-4" /> Pausar
              </Button>
            )}
            {c.status === 'PAUSED' && (
              <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void run('resume')}>
                <RotateCcw className="size-4" /> Reanudar
              </Button>
            )}
            {['DRAFT', 'SCHEDULED', 'RUNNING', 'PAUSED'].includes(c.status) && (
              <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => setConfirmCancel(true)}>
                <X className="size-4" /> Cancelar
              </Button>
            )}
            <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void run('duplicate')}>
              <Copy className="size-4" /> Duplicar
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-5">
        {/* Left: Progress + Details */}
        <div className="space-y-4 lg:col-span-2">
          {/* Progress card */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Progreso general</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {/* Big progress bar */}
              <div>
                <div className="mb-1.5 flex items-end justify-between text-xs">
                  <span className="text-foreground/60">{c.actionsDone} de {c.totalActions} publicaciones</span>
                  <span className="font-semibold text-foreground">{pct}%</span>
                </div>
                <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${isRunning ? 'bg-[#1877F2]' : c.status === 'COMPLETED' ? 'bg-emerald-500' : c.status === 'FAILED' ? 'bg-destructive' : 'bg-primary'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2">
                <StatCard label="Publicados" value={publishedCount} icon={<CheckCircle2 className="size-4 text-emerald-500" />} color="emerald" />
                <StatCard label="Fallidos" value={failedCount} icon={<XCircle className="size-4 text-destructive" />} color="red" />
                <StatCard label="Pendientes" value={pendingCount} icon={<Clock className="size-4 text-foreground/40" />} color="neutral" />
              </div>

              {/* Details */}
              <dl className="space-y-2 border-t pt-3 text-sm">
                <Row label="Inicio" value={formatDate(c.startAt)} />
                <Row label="Fin" value={c.endsAt ? formatDate(c.endsAt) : '—'} />
                <Row label="Intervalo entre posts" value={`${c.intervalSeconds}s`} />
                <Row label="Pausa entre grupos" value={`${c.groupsWaitSeconds}s`} />
              </dl>
            </CardContent>
          </Card>

          {/* Groups */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Grupos de distribución</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {data.groups.length === 0 ? (
                <p className="text-sm text-foreground/60">Sin grupos configurados.</p>
              ) : data.groups.map((g, i) => {
                const gPct = g.actionsTarget > 0 ? Math.round((g.actionsDone / g.actionsTarget) * 100) : 0;
                return (
                  <div key={g.id} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Grupo {i + 1}</span>
                      <StatusBadge value={g.status} />
                    </div>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-[#1877F2] transition-all" style={{ width: `${gPct}%` }} />
                    </div>
                    <p className="mt-1.5 flex items-center gap-1.5 text-xs text-foreground/60">
                      <Zap className="size-3" /> {g.actionsDone}/{g.actionsTarget} posts
                      <ChevronRight className="size-3" />
                      {g.percentage}% de la campaña
                      <ChevronRight className="size-3" />
                      cada {g.intervalSeconds}s
                    </p>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        {/* Right: Post feed preview */}
        <div className="lg:col-span-3">
          <Card className="h-full">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                Vista previa del contenido
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-normal text-foreground/50">
                  {publishedCount} publicados · {pendingCount} pendientes
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
              {posts.length === 0 ? (
                <p className="py-8 text-center text-sm text-foreground/40">
                  Las publicaciones aparecerán aquí una vez que inicie la campaña.
                </p>
              ) : (
                posts.map((p) => <PostPreview key={p.id} post={p} />)
              )}
              {posts.length > 0 && posts.length < data.postsTotal && (
                <p className="py-1 text-center text-xs text-foreground/40">
                  Mostrando {posts.length} de {data.postsTotal} publicaciones
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Cancel confirm */}
      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cancelar campaña?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción detendrá la campaña permanentemente. No se podrá reanudar.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No, mantener</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { setConfirmCancel(false); void run('cancel'); }}>
              Sí, cancelar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirm */}
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar campaña?</AlertDialogTitle>
            <AlertDialogDescription>Se eliminará permanentemente y no podrá recuperarse.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { setConfirmDelete(false); void deleteCampaign(); }}>
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: 'emerald' | 'red' | 'neutral' }) {
  const bg = color === 'emerald' ? 'bg-emerald-500/10 border-emerald-500/20' : color === 'red' ? 'bg-destructive/10 border-destructive/20' : 'bg-muted/50 border-border';
  return (
    <div className={`rounded-lg border p-3 ${bg}`}>
      <div className="flex items-center gap-1.5 text-xs text-foreground/60">{icon}{label}</div>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-foreground/60">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-16" />
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-40" />
        </div>
        <Skeleton className="h-[500px] lg:col-span-3" />
      </div>
    </div>
  );
}