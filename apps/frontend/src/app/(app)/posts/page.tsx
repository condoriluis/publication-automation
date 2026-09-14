'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Play, X, Trash2, ExternalLink, Plus } from 'lucide-react';

import { api } from '@/lib/api';
import type { Paginated, PostDetail, PostStatus } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/status-badge';
import { EmptyState } from '@/components/empty-state';
import { LoadingRows, Pagination } from '@/components/pagination';
import { formatDate } from '@/lib/utils';

const STATUSES: (PostStatus | '')[] = ['', 'DRAFT', 'SCHEDULED', 'PUBLISHING', 'PUBLISHED', 'PARTIALLY_FAILED', 'FAILED', 'CANCELLED'];

export default function PostsPage() {
  const [data, setData] = useState<Paginated<PostDetail> | null>(null);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const q = status ? `&status=${status}` : '';
    api
      .get<Paginated<PostDetail>>(`/posts?page=${page}&limit=10${q}`)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'No se pudieron cargar las publicaciones'));
  }, [page, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const action = useCallback(
    async (id: string, act: string, method: 'post' | 'delete' = 'post') => {
      try {
        if (method === 'delete') await api.delete(`/posts/${id}`);
        else await api.post(`/posts/${id}/${act}`);
        toast.success('Acción ejecutada');
        await load();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Acción fallida');
      }
    },
    [load],
  );

  return (
    <div className="space-y-4">
      <PageHeader title="Publicaciones" subtitle="Gestiona individualmente cada publicación">
        <Button asChild>
          <Link href="/posts/new"><Plus className="size-4" /> Nuevo post</Link>
        </Button>
      </PageHeader>

      <div className="flex flex-wrap gap-1.5">
        {STATUSES.map((s) => (
          <Button key={s || 'all'} size="sm" variant={status === s ? 'default' : 'outline'} onClick={() => { setStatus(s); setPage(1); }}>
            {s || 'Todos'}
          </Button>
        ))}
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {data === null && !error ? (
        <LoadingRows />
      ) : data && data.data.length === 0 ? (
        <EmptyState title="No hay publicaciones" description="Crea tu primera publicación." />
      ) : data ? (
        <Card>
          <ul className="divide-y">
            {data.data.map((p) => (
              <li key={p.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Link href={`/posts/${p.id}`} className="text-sm font-medium hover:text-primary">
                      {p.content.slice(0, 80)}{p.content.length > 80 ? '…' : ''}
                    </Link>
                    {p.aiGenerated ? <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">IA</span> : null}
                  </div>
                  <p className="mt-1 text-xs text-foreground/50">
                    {p.page?.name ?? '—'}{p.campaign ? <> · {p.campaign.name}</> : null} · {formatDate(p.statusChangedAt)}
                  </p>
                  {p.metaPermalinkUrl ? (
                    <a href={p.metaPermalinkUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline">
                      Ver en Facebook <ExternalLink className="size-3" />
                    </a>
                  ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <StatusBadge value={p.status} />
                  <span className="text-xs text-foreground/50">{p._count?.comments ?? 0} comentarios</span>
                  {['DRAFT', 'SCHEDULED', 'FAILED'].includes(p.status) ? (
                    <IconBtn title="Publicar" onClick={() => void action(p.id, 'publish')}><Play /></IconBtn>
                  ) : null}
                  {['DRAFT', 'SCHEDULED', 'PUBLISHING'].includes(p.status) ? (
                    <IconBtn title="Cancelar" onClick={() => void action(p.id, 'cancel')}><X /></IconBtn>
                  ) : null}
                  {p.status === 'DRAFT' ? (
                    <IconBtn title="Eliminar" onClick={() => void action(p.id, '', 'delete')}><Trash2 /></IconBtn>
                  ) : null}
                  {p.status === 'PUBLISHED' ? (
                    <IconBtn
                      title="Eliminar de Facebook"
                      onClick={() => {
                        if (window.confirm('¿Eliminar esta publicación de Facebook? No se puede deshacer.')) {
                          void action(p.id, '', 'delete');
                        }
                      }}
                    >
                      <Trash2 />
                    </IconBtn>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
          <Pagination data={data} onPage={setPage} />
        </Card>
      ) : null}
    </div>
  );
}

function IconBtn({ title, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { title: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      className="inline-flex size-8 items-center justify-center rounded-md border p-1.5 text-foreground/70 transition-colors hover:bg-muted disabled:opacity-40"
      {...props}
    >
      {children}
    </button>
  );
}