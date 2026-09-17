'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { ArrowLeft, Play, X, Trash2, ExternalLink, RefreshCw, Loader2,
  MessageSquare, ThumbsUp, Share2, Eye, TrendingUp, Bot, Clock, ChevronRight,
} from 'lucide-react';

import { api } from '@/lib/api';
import type { PostDetail } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { FacebookPostPreview } from '@/components/facebook-post-preview';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/status-badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate } from '@/lib/utils';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function PostDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [post, setPost] = useState<PostDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(() => {
    api.get<PostDetail>(`/posts/${params.id}`)
      .then(setPost)
      .catch((e) => setError(e instanceof Error ? e.message : 'No se pudo cargar la publicación'));
  }, [params.id]);

  useEffect(() => { void load(); }, [load]);

  const action = useCallback(
    async (act: string, del = false) => {
      setBusy(act);
      try {
        if (del) await api.delete(`/posts/${params.id}`);
        else await api.post(`/posts/${params.id}/${act}`);
        const toastMap: Record<string, string> = {
          publish: 'Publicación enviada a Facebook',
          cancel: 'Publicación cancelada',
        };
        toast.success(del ? 'Publicación eliminada' : (toastMap[act] ?? 'Acción ejecutada'));
        if (del) router.push('/posts');
        else await load();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Acción fallida');
      } finally {
        setBusy(null);
      }
    },
    [params.id, load, router],
  );

  async function syncComments() {
    setSyncing(true);
    try {
      const res = await api.post<{ synced: number; skipped: number }>(`/comments/sync/${params.id}`);
      toast.success(`${res.synced} comentarios nuevos sincronizados`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo sincronizar');
    } finally {
      setSyncing(false);
    }
  }

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!post) return <LoadingSkeleton />;

  const e = post.engagement;
  const isPublished = post.status === 'PUBLISHED';
  const commentCount = post._count?.comments ?? 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <PageHeader title={post.campaign?.name ?? 'Publicación'} subtitle={`Publicado el ${post.publishedAt ? formatDate(post.publishedAt) : '—'}`}>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => router.push('/posts')}>
            <ArrowLeft className="size-4" /> Volver
          </Button>
          {post.metaPermalinkUrl ? (
            <Button size="sm" variant="outline" asChild>
              <a href={post.metaPermalinkUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="size-4" /> Ver en Facebook
              </a>
            </Button>
          ) : null}
        </div>
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-5">
        {/* Left: post preview + meta */}
        <div className="space-y-4 lg:col-span-3">
          {/* Post preview styled as Facebook */}
          <FacebookPostPreview
            pageName={post.page?.name ?? 'Página'}
            pagePicture={post.page?.pictureUrl ?? null}
            content={post.content}
            imageUrls={post.imageUrls}
            videoUrl={post.videoUrl}
            linkUrl={post.linkUrl}
            timeLabel={post.publishedAt ? formatDate(post.publishedAt) : '—'}
            headerExtra={
              <div className="flex shrink-0 items-center gap-2">
                <StatusBadge value={post.status} />
                {post.aiGenerated ? (
                  <span className="flex items-center gap-1 rounded-full bg-[#1877F2]/10 px-2.5 py-1 text-[11px] font-medium text-[#1877F2]">
                    <Bot className="size-3" /> IA
                  </span>
                ) : null}
              </div>
            }
          />

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            {['DRAFT', 'SCHEDULED', 'FAILED'].includes(post.status) ? (
              <Button size="sm" disabled={busy !== null} onClick={() => void action('publish')}>
                {busy === 'publish' ? <Loader2 className="animate-spin size-4" /> : <Play className="size-4" />} Publicar ahora
              </Button>
            ) : null}
            {['DRAFT', 'SCHEDULED', 'PUBLISHING'].includes(post.status) ? (
              <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void action('cancel')}>
                <X className="size-4" /> Cancelar
              </Button>
            ) : null}
            {post.status === 'DRAFT' ? (
              <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" disabled={busy !== null} onClick={() => setConfirmDelete(true)}>
                <Trash2 className="size-4" /> Eliminar
              </Button>
            ) : null}
            {isPublished ? (
              <Button size="sm" variant="outline" disabled={syncing} onClick={() => void syncComments()}>
                <RefreshCw className={`size-4 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Sincronizando…' : 'Sincronizar comentarios'}
              </Button>
            ) : null}
          </div>
        </div>

        {/* Right: info + engagement */}
        <div className="space-y-4 lg:col-span-2">
          {/* Metadata */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Información</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <InfoRow label="Campaña" value={post.campaign?.name ?? '—'} />
              <InfoRow label="Programado" value={post.scheduledFor ? formatDate(post.scheduledFor) : '—'} />
              <InfoRow label="Publicado" value={post.publishedAt ? formatDate(post.publishedAt) : '—'} />
              <InfoRow label="Última actualización" value={formatDate(post.statusChangedAt)} />
              <div className="flex items-center justify-between pt-1 border-t">
                <span className="text-foreground/60">Comentarios</span>
                {commentCount > 0 ? (
                  <Link
                    href={`/comments?postId=${post.id}`}
                    className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 font-medium text-[#1877F2] transition-colors hover:bg-black/5 dark:hover:bg-white/10"
                  >
                    <MessageSquare className="size-3.5" />
                    {commentCount}
                    <ChevronRight className="size-3.5" />
                  </Link>
                ) : (
                  <span className="flex items-center gap-1.5 font-medium">
                    <Clock className="size-3.5 text-foreground/30" /> 0
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Engagement */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Engagement</CardTitle></CardHeader>
            <CardContent>
              {!e ? (
                <div className="flex flex-col items-center gap-2 py-4 text-center">
                  <TrendingUp className="size-8 text-foreground/20" />
                  <p className="text-xs text-foreground/50">
                    {isPublished ? 'Sin métricas aún. Vuelve en unos minutos.' : 'Disponible después de publicar.'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <EngagementStat icon={<ThumbsUp className="size-4 text-[#1877F2]" />} label="Me gusta" value={e.likes} />
                  <EngagementStat icon={<MessageSquare className="size-4 text-emerald-500" />} label="Comentarios" value={e.comments} />
                  <EngagementStat icon={<Share2 className="size-4 text-purple-500" />} label="Compartidos" value={e.shares} />
                  <EngagementStat icon={<Eye className="size-4 text-amber-500" />} label="Alcance" value={e.reach} />
                  <EngagementStat icon={<TrendingUp className="size-4 text-rose-500" />} label="Impresiones" value={e.impressions} />
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar publicación?</AlertDialogTitle>
            <AlertDialogDescription>Se eliminará permanentemente. Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { setConfirmDelete(false); void action('', true); }}>
              Sí, eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-foreground/60">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}

function EngagementStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border p-3">
      <div className="flex items-center gap-1.5 text-xs text-foreground/60">{icon}{label}</div>
      <p className="text-xl font-bold">{value.toLocaleString('es')}</p>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-64" />
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-3">
          <Skeleton className="h-64" />
          <Skeleton className="h-9 w-48" />
        </div>
        <div className="space-y-4 lg:col-span-2">
          <Skeleton className="h-40" />
          <Skeleton className="h-48" />
        </div>
      </div>
    </div>
  );
}