'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';

import { api } from '@/lib/api';
import type { Paginated, PostDetail } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { Card } from '@/components/ui/card';
import { StatusBadge } from '@/components/status-badge';
import { EmptyState } from '@/components/empty-state';
import { LoadingRows, Pagination } from '@/components/pagination';
import { formatDate } from '@/lib/utils';

export default function HistoryPage() {
  const [data, setData] = useState<Paginated<PostDetail> | null>(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api.get<Paginated<PostDetail>>(`/posts?page=${page}&limit=10&status=PUBLISHED`).then(setData).catch((e) => setError(e instanceof Error ? e.message : 'No se pudo cargar el historial'));
  }, [page]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-4">
      <PageHeader title="Historial" subtitle="Publicaciones publicadas a lo largo del tiempo" />
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {data === null && !error ? (
        <LoadingRows />
      ) : data && data.data.length === 0 ? (
        <EmptyState title="Sin publicaciones" description="Aún no hay posts publicados." />
      ) : data ? (
        <Card>
          <ul className="divide-y">
            {data.data.map((p) => (
              <li key={p.id} className="flex items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <Link href={`/posts/${p.id}`} className="text-sm font-medium hover:text-primary">
                    {p.content.slice(0, 90)}{p.content.length > 90 ? '…' : ''}
                  </Link>
                  <p className="mt-1 text-xs text-foreground/50">
                    {p.page?.name ?? '—'} · publicado {p.publishedAt ? formatDate(p.publishedAt) : formatDate(p.statusChangedAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge value={p.status} />
                  {p.metaPermalinkUrl ? (
                    <a href={p.metaPermalinkUrl} target="_blank" rel="noopener noreferrer" title="Ver en Facebook">
                      <ExternalLink className="size-4 text-foreground/50" />
                    </a>
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