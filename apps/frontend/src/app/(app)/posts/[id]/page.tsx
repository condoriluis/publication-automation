'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowLeft, Play, X, Trash2, ExternalLink, RefreshCw, Loader2 } from 'lucide-react';

import { api } from '@/lib/api';
import type { PostDetail } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/status-badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate } from '@/lib/utils';

export default function PostDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [post, setPost] = useState<PostDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(() => {
    api.get<PostDetail>(`/posts/${params.id}`).then(setPost).catch((e) => setError(e instanceof Error ? e.message : 'No se pudo cargar la publicación'));
  }, [params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const action = useCallback(
    async (act: string, del = false) => {
      setBusy(act);
      try {
        if (del) await api.delete(`/posts/${params.id}`);
        else await api.post(`/posts/${params.id}/${act}`);
        toast.success('Acción ejecutada');
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
      toast.success(`${res.synced} comentarios nuevos, ${res.skipped} ya respondidos`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo sincronizar');
    } finally {
      setSyncing(false);
    }
  }

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!post) return <div className="space-y-4"><Skeleton className="h-8 w-64" /><Skeleton className="h-40" /></div>;

  const e = post.engagement;

  return (
    <div className="space-y-4">
      <PageHeader title="Detalle de la publicación" subtitle={post.id.slice(0, 8)}>
        <Button size="sm" variant="outline" onClick={() => router.push('/posts')}>
          <ArrowLeft className="size-4" /> Volver
        </Button>
      </PageHeader>

      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge value={post.status} />
            {post.aiGenerated ? <span className="rounded bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">IA</span> : null}
            <span className="text-xs text-foreground/50">{post.page?.name}</span>
          </div>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{post.content}</p>
          {post.imageUrls.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {post.imageUrls.map((u) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={u} src={u} alt="" className="h-24 w-24 rounded-lg object-cover" />
              ))}
            </div>
          ) : null}
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <InfoRow label="Campaña" value={post.campaign?.name ?? '—'} />
            <InfoRow label="Programado" value={post.scheduledFor ? formatDate(post.scheduledFor) : '—'} />
            <InfoRow label="Publicado" value={post.publishedAt ? formatDate(post.publishedAt) : '—'} />
            <InfoRow label="Actualizado" value={formatDate(post.statusChangedAt)} />
            <InfoRow label="Comentarios" value={String(post._count?.comments ?? 0)} />
          </dl>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        {['DRAFT', 'SCHEDULED', 'FAILED'].includes(post.status) ? (
          <Button size="sm" disabled={busy !== null} onClick={() => void action('publish')}>
            {busy === 'publish' ? <Loader2 className="animate-spin" /> : <Play className="size-4" />} Publicar
          </Button>
        ) : null}
        {['DRAFT', 'SCHEDULED', 'PUBLISHING'].includes(post.status) ? (
          <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void action('cancel')}><X className="size-4" /> Cancelar</Button>
        ) : null}
        {post.status === 'DRAFT' ? (
          <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void action('', true)}><Trash2 className="size-4" /> Eliminar</Button>
        ) : null}
        {post.status === 'PUBLISHED' || post.status === 'PARTIALLY_FAILED' ? (
          <Button size="sm" variant="outline" disabled={syncing} onClick={() => void syncComments()}>
            <RefreshCw className={syncing ? 'animate-spin' : 'size-4'} /> Sincronizar comentarios
          </Button>
        ) : null}
        {post.metaPermalinkUrl ? (
          <Button size="sm" variant="outline" asChild>
            <a href={post.metaPermalinkUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="size-4" /> Ver en Facebook
            </a>
          </Button>
        ) : null}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Engagement</CardTitle></CardHeader>
          <CardContent>
            {!e ? (
              <p className="text-sm text-foreground/60">Sin métricas disponibles.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                <Metric label="Me gusta" value={e.likes} />
                <Metric label="Comentarios" value={e.comments} />
                <Metric label="Compartidos" value={e.shares} />
                <Metric label="Alcance" value={e.reach} />
                <Metric label="Impresiones" value={e.impressions} />
              </div>
            )}
          </CardContent>
      </Card>
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

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-foreground/60">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value.toLocaleString('es')}</p>
    </div>
  );
}