'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { type ColumnDef } from '@tanstack/react-table';

import { api } from '@/lib/api';
import type { Paginated, PostDetail } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { StatusBadge } from '@/components/status-badge';
import { EmptyState } from '@/components/empty-state';
import { LoadingRows } from '@/components/pagination';
import { DataTable } from '@/components/ui/data-table';
import { formatDate } from '@/lib/utils';

export default function HistoryPage() {
  const [data, setData] = useState<PostDetail[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api
      .get<Paginated<PostDetail>>(`/posts?page=1&limit=100&status=PUBLISHED`)
      .then((res) => setData(res.data))
      .catch((e) => setError(e instanceof Error ? e.message : 'No se pudo cargar el historial'));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const columns: ColumnDef<PostDetail>[] = [
    {
      accessorKey: 'content',
      header: 'Publicación',
      cell: ({ row }) => {
        const p = row.original;
        return (
          <div className="flex flex-col gap-1 max-w-[400px]">
            <Link href={`/posts/${p.id}`} className="font-medium text-[var(--foreground)] hover:text-[#1877F2] hover:underline truncate">
              {p.content || '(Sin contenido)'}
            </Link>
            <span className="text-xs text-[var(--muted-foreground)]">
              {p.page?.name ?? '—'} · publicado {p.publishedAt ? formatDate(p.publishedAt) : formatDate(p.statusChangedAt)}
            </span>
          </div>
        );
      },
    },
    {
      accessorKey: 'status',
      header: 'Estado',
      cell: ({ row }) => <StatusBadge value={row.original.status} />,
    },
    {
      id: 'actions',
      header: 'Enlace',
      cell: ({ row }) => {
        const p = row.original;
        if (!p.metaPermalinkUrl) return null;
        return (
          <a
            href={p.metaPermalinkUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Ver en Facebook"
            className="inline-flex size-8 items-center justify-center rounded-md text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[#1877F2]"
          >
            <ExternalLink className="size-4" />
          </a>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Historial" subtitle="Publicaciones publicadas a lo largo del tiempo" />
      {error ? <p className="text-sm text-[var(--destructive)]">{error}</p> : null}
      
      {data === null && !error ? (
        <LoadingRows rows={4} />
      ) : data && data.length === 0 ? (
        <EmptyState title="Sin publicaciones" description="Aún no hay posts publicados." />
      ) : data ? (
        <DataTable columns={columns} data={data} />
      ) : null}
    </div>
  );
}