'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, ScrollText } from 'lucide-react';
import { type ColumnDef } from '@tanstack/react-table';

import { api } from '@/lib/api';
import type { AuditLogItem, Paginated } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { EmptyState } from '@/components/empty-state';
import { LoadingRows } from '@/components/pagination';
import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatDate } from '@/lib/utils';

const CATEGORIES: AuditLogItem['category'][] = [
  'AUTH',
  'FACEBOOK',
  'CAMPAIGN',
  'POST',
  'COMMENT',
  'AI',
  'WEBHOOK',
  'SYSTEM',
  'SECURITY',
  'DASHBOARD',
];

const CATEGORY_LABEL: Record<AuditLogItem['category'], string> = {
  AUTH: 'Autenticación',
  FACEBOOK: 'Facebook',
  CAMPAIGN: 'Campaña',
  POST: 'Publicación',
  COMMENT: 'Comentario',
  AI: 'Inteligencia',
  WEBHOOK: 'Webhook',
  SYSTEM: 'Sistema',
  SECURITY: 'Seguridad',
  DASHBOARD: 'Panel',
};

const CATEGORY_STYLE: Record<AuditLogItem['category'], string> = {
  AUTH: 'border-transparent bg-blue-500/10 text-blue-600 dark:text-blue-400',
  FACEBOOK: 'border-transparent bg-[#1877F2]/10 text-[#1877F2]',
  CAMPAIGN: 'border-transparent bg-violet-500/10 text-violet-600 dark:text-violet-400',
  POST: 'border-transparent bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  COMMENT: 'border-transparent bg-amber-500/10 text-amber-600 dark:text-amber-400',
  AI: 'border-transparent bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
  WEBHOOK: 'border-transparent bg-pink-500/10 text-pink-600 dark:text-pink-400',
  SYSTEM: 'border-transparent bg-slate-500/10 text-slate-600 dark:text-slate-400',
  SECURITY: 'border-transparent bg-destructive/10 text-destructive',
  DASHBOARD: 'border-transparent bg-teal-500/10 text-teal-600 dark:text-teal-400',
};

export default function LogsPage() {
  const [data, setData] = useState<AuditLogItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<AuditLogItem['category'] | 'ALL'>('ALL');
  const [loading, setLoading] = useState(false);

  const load = useCallback((cat: AuditLogItem['category'] | 'ALL' = 'ALL') => {
    const params = new URLSearchParams({ page: '1', limit: '200' });
    if (cat !== 'ALL') params.set('category', cat);
    return api
      .get<Paginated<AuditLogItem>>(`/audit?${params.toString()}`)
      .then((res) => setData(res.data))
      .catch((e) => setError(e instanceof Error ? e.message : 'No se pudieron cargar los logs'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    void load(category);
  }, [category, load]);

  const columns: ColumnDef<AuditLogItem>[] = [
    {
      accessorKey: 'action',
      header: 'Acción',
      cell: ({ row }) => {
        const l = row.original;
        return (
          <div className="max-w-[320px]">
            <p className="truncate font-medium text-[var(--foreground)]">{l.action}</p>
            {l.metadata && Object.keys(l.metadata).length > 0 ? (
              <p className="truncate text-xs text-[var(--muted-foreground)]">
                {JSON.stringify(l.metadata)}
              </p>
            ) : null}
          </div>
        );
      },
    },
    {
      accessorKey: 'category',
      header: 'Categoría',
      cell: ({ row }) => {
        const c = row.original.category;
        return (
          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${CATEGORY_STYLE[c]}`}>
            {CATEGORY_LABEL[c]}
          </span>
        );
      },
    },
    {
      accessorKey: 'user',
      header: 'Usuario',
      cell: ({ row }) => {
        const u = row.original.user;
        return u ? (
          <div className="flex flex-col">
            <span className="text-sm font-medium text-[var(--foreground)]">{u.displayName}</span>
            <span className="text-xs text-[var(--muted-foreground)]">{u.email}</span>
          </div>
        ) : (
          <span className="text-sm text-[var(--muted-foreground)]">Sistema</span>
        );
      },
    },
    {
      accessorKey: 'ipAddress',
      header: 'IP',
      cell: ({ row }) => (
        <span className="font-mono text-xs text-[var(--muted-foreground)]">
          {row.original.ipAddress ?? '—'}
        </span>
      ),
    },
    {
      accessorKey: 'createdAt',
      header: 'Fecha',
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-sm text-[var(--muted-foreground)]">
          {formatDate(row.original.createdAt)}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Logs" subtitle="Registro de auditoría y eventos del sistema">
        <div className="flex items-center gap-2">
          <Select value={category} onValueChange={(v) => { setError(null); setLoading(true); setCategory(v as AuditLogItem['category'] | 'ALL'); }}>
            <SelectTrigger className="h-9 w-[180px]">
              <SelectValue placeholder="Categoría" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todas</SelectItem>
              {CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {CATEGORY_LABEL[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => { setError(null); setLoading(true); void load(category); }} disabled={loading}>
            <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refrescar</span>
          </Button>
        </div>
      </PageHeader>

      {error ? <p className="text-sm text-[var(--destructive)]">{error}</p> : null}

      {data === null && !error ? (
        <LoadingRows rows={4} />
      ) : data && data.length === 0 ? (
        <EmptyState
          icon={<ScrollText className="size-6" />}
          title="Sin registros"
          description="Aún no hay eventos de auditoría registrados."
        />
      ) : data ? (
        <DataTable columns={columns} data={data} loading={loading} />
      ) : null}
    </div>
  );
}