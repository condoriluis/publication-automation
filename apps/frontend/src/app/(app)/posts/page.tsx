'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Play, X, Trash2, ExternalLink, Plus, Loader2 } from 'lucide-react';
import { type ColumnDef } from '@tanstack/react-table';

import { api } from '@/lib/api';
import type { Paginated, PostDetail, PostStatus } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/status-badge';
import { EmptyState } from '@/components/empty-state';
import { LoadingRows } from '@/components/pagination';
import { DataTable } from '@/components/ui/data-table';
import { formatDate } from '@/lib/utils';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

const STATUSES: (PostStatus | '')[] = ['', 'DRAFT', 'SCHEDULED', 'PUBLISHING', 'PUBLISHED', 'PARTIALLY_FAILED', 'FAILED', 'CANCELLED'];

export default function PostsPage() {
  const [data, setData] = useState<PostDetail[] | null>(null);
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [postToDelete, setPostToDelete] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const q = status ? `&status=${status}` : '';
    api
      .get<Paginated<PostDetail>>(`/posts?page=1&limit=100${q}`)
      .then((res) => setData(res.data))
      .catch((e) => setError(e instanceof Error ? e.message : 'No se pudieron cargar las publicaciones'));
  }, [status]);

  useEffect(() => { void load(); }, [load]);

  const action = useCallback(
    async (id: string, act: string, method: 'post' | 'delete' = 'post') => {
      setBusy(id);
      try {
        if (method === 'delete') await api.delete(`/posts/${id}`);
        else await api.post(`/posts/${id}/${act}`);
        toast.success('Acción ejecutada');
        await load();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Acción fallida');
      } finally {
        setBusy(null);
      }
    },
    [load],
  );

  const columns: ColumnDef<PostDetail>[] = [
    {
      accessorKey: 'content',
      header: 'Contenido',
      cell: ({ row }) => {
        const p = row.original;
        return (
          <div className="flex flex-col gap-1 max-w-[300px]">
            <div className="flex items-center gap-2">
              <Link href={`/posts/${p.id}`} className="font-medium text-[var(--foreground)] hover:text-[#1877F2] hover:underline truncate">
                {p.content || '(Sin contenido)'}
              </Link>
              {p.aiGenerated ? (
                <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">IA</span>
              ) : null}
            </div>
            {p.metaPermalinkUrl ? (
              <a href={p.metaPermalinkUrl} target="_blank" rel="noopener noreferrer" className="inline-flex w-fit items-center gap-1 text-[11px] text-[#1877F2] hover:underline">
                Ver en Facebook <ExternalLink className="size-3" />
              </a>
            ) : null}
          </div>
        );
      },
    },
    {
      id: 'details',
      header: 'Detalles',
      cell: ({ row }) => {
        const p = row.original;
        return (
          <div className="flex flex-col text-xs text-[var(--muted-foreground)]">
            <span>{p.page?.name ?? '—'}{p.campaign ? <> · {p.campaign.name}</> : null}</span>
            <span>{formatDate(p.statusChangedAt)}</span>
          </div>
        );
      },
    },
    {
      id: 'comments',
      header: 'Comentarios',
      cell: ({ row }) => (
        <span className="text-xs text-[var(--muted-foreground)]">
          {row.original._count?.comments ?? 0}
        </span>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Estado',
      cell: ({ row }) => <StatusBadge value={row.original.status} />,
    },
    {
      id: 'actions',
      header: 'Acciones',
      cell: ({ row }) => {
        const p = row.original;
        return (
          <div className="flex flex-wrap items-center gap-1.5">
            {['DRAFT', 'SCHEDULED', 'FAILED'].includes(p.status) ? (
              <IconBtn title="Publicar" disabled={busy === p.id} onClick={() => void action(p.id, 'publish')}><Play className="text-[#1877F2]" /></IconBtn>
            ) : null}
            {['DRAFT', 'SCHEDULED', 'PUBLISHING'].includes(p.status) ? (
              <IconBtn title="Cancelar" disabled={busy === p.id} onClick={() => void action(p.id, 'cancel')}><X /></IconBtn>
            ) : null}
            {['DRAFT', 'PUBLISHED'].includes(p.status) ? (
              <IconBtn title="Eliminar" disabled={busy === p.id} onClick={() => setPostToDelete(p.id)}>
                <Trash2 className="text-[var(--destructive)]" />
              </IconBtn>
            ) : null}
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Publicaciones" subtitle="Gestiona individualmente cada publicación">
        <Button asChild className="bg-[#1877F2] hover:bg-[#0A5BC4] text-white">
          <Link href="/posts/new">
            <Plus className="mr-1.5 size-4" /> Nuevo post
          </Link>
        </Button>
      </PageHeader>

      <div className="flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <Button
            key={s || 'all'}
            size="sm"
            variant={status === s ? 'default' : 'outline'}
            onClick={() => setStatus(s)}
            className={status === s ? 'bg-[#1877F2] text-white hover:bg-[#0A5BC4]' : ''}
          >
            {s || 'Todos'}
          </Button>
        ))}
      </div>

      {error ? <p className="text-sm text-[var(--destructive)]">{error}</p> : null}

      {data === null && !error ? (
        <LoadingRows rows={4} />
      ) : data && data.length === 0 ? (
        <EmptyState title="No hay publicaciones" description="Crea tu primera publicación." />
      ) : data ? (
        <DataTable columns={columns} data={data} />
      ) : null}

      <AlertDialog open={postToDelete !== null} onOpenChange={(open) => { if (!open) setPostToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar publicación?</AlertDialogTitle>
            <AlertDialogDescription>Se eliminará permanentemente. Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy !== null}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={busy !== null}
              onClick={() => { if (postToDelete) { void action(postToDelete, '', 'delete'); } setPostToDelete(null); }}
            >
              {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Sí, eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function IconBtn({ title, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { title: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      className="inline-flex size-8 items-center justify-center rounded-md border bg-[var(--card)] p-1.5 text-[var(--foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[#1877F2] disabled:opacity-40 disabled:hover:text-inherit"
      {...props}
    >
      <span className="size-4 [&>svg]:size-4">{children}</span>
    </button>
  );
}