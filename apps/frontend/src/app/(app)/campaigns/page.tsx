'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Copy, Play, Pause, RotateCcw, X, Plus, Trash2 } from 'lucide-react';
import { type ColumnDef } from '@tanstack/react-table';

import { api } from '@/lib/api';
import { StatusBadge } from '@/components/status-badge';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { EmptyState } from '@/components/empty-state';
import { LoadingRows } from '@/components/pagination';
import { DataTable } from '@/components/ui/data-table';
import { formatDate, formatPercent } from '@/lib/utils';
import type { Campaign, CampaignStatus, Paginated } from '@/lib/types';

const STATUSES: (CampaignStatus | '')[] = ['', 'DRAFT', 'SCHEDULED', 'RUNNING', 'PAUSED', 'COMPLETED', 'FAILED', 'CANCELLED'];

export default function CampaignsPage() {
  const [data, setData] = useState<Campaign[] | null>(null);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [campaignToDelete, setCampaignToDelete] = useState<string | null>(null);

  const load = useCallback(async () => {
    const q = status ? `&status=${status}` : '';
    api
      .get<Paginated<Campaign>>(`/campaigns?page=1&limit=100${q}`)
      .then((res) => setData(res.data))
      .catch((e) => setError(e instanceof Error ? e.message : 'No se pudieron cargar las campañas'));
  }, [status]);

  useEffect(() => {
    void load();
  }, [load]);

  const hasActive = (data ?? []).some((c) =>
    ['SCHEDULED', 'RUNNING', 'PAUSED'].includes(c.status),
  );
  useEffect(() => {
    if (!hasActive) return;
    const timer = window.setInterval(() => void load(), 6000);
    return () => window.clearInterval(timer);
  }, [hasActive, load]);

  const run = useCallback(
    async (id: string, action: string) => {
      setBusy(`${id}:${action}`);
      try {
        await api.post(`/campaigns/${id}/${action}`);
        toast.success(`Acción "${action}" ejecutada`);
        await load();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Acción fallida');
      } finally {
        setBusy(null);
      }
    },
    [load],
  );

  const remove = useCallback(
    async (id: string) => {
      setBusy(id);
      try {
        await api.delete(`/campaigns/${id}`);
        toast.success('Campaña eliminada');
        await load();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'No se pudo eliminar');
      } finally {
        setBusy(null);
      }
    },
    [load],
  );

  const columns: ColumnDef<Campaign>[] = [
    {
      accessorKey: 'name',
      header: 'Campaña',
      cell: ({ row }) => {
        const c = row.original;
        return (
          <div className="flex flex-col">
            <Link href={`/campaigns/${c.id}`} className="font-medium text-[var(--foreground)] hover:text-[var(--primary)] hover:underline">
              {c.name}
            </Link>
            <span className="text-xs text-[var(--muted-foreground)]">
              {c.pageId ? `Página ${c.pageId.slice(0, 8)}…` : '—'} · Inicio {formatDate(c.startAt)}
            </span>
          </div>
        );
      },
    },
    {
      id: 'progress',
      header: 'Progreso',
      cell: ({ row }) => {
        const c = row.original;
        const progress = c.totalActions > 0 ? c.actionsDone / c.totalActions : 0;
        return (
          <div className="w-[180px] sm:w-[220px]">
            <div className="flex justify-between text-xs mb-1 text-[var(--muted-foreground)]">
              <span>{c.actionsDone}/{c.totalActions} acciones</span>
              <span className="font-medium">{formatPercent(progress)}</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--muted)]">
              <div
                className={`h-full rounded-full transition-all duration-500 ${c.status === 'FAILED' ? 'bg-[var(--destructive)]' : 'bg-[#1877F2]'}`}
                style={{ width: `${Math.min(100, progress * 100)}%` }}
              />
            </div>
            {c.actionsFailed > 0 && (
              <p className="mt-1 text-[10px] text-[var(--destructive)]">{c.actionsFailed} fallidas</p>
            )}
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
      header: 'Acciones',
      cell: ({ row }) => {
        const c = row.original;
        return (
          <div className="flex flex-wrap items-center gap-1.5">
            {c.status === 'DRAFT' || c.status === 'SCHEDULED' || c.status === 'PAUSED' ? (
              <IconBtn title="Iniciar" disabled={busy !== null} onClick={() => void run(c.id, 'start')}><Play /></IconBtn>
            ) : null}
            {c.status === 'RUNNING' ? (
              <IconBtn title="Pausar" disabled={busy !== null} onClick={() => void run(c.id, 'pause')}><Pause /></IconBtn>
            ) : null}
            {c.status === 'PAUSED' ? (
              <IconBtn title="Reanudar" disabled={busy !== null} onClick={() => void run(c.id, 'resume')}><RotateCcw /></IconBtn>
            ) : null}
            {['DRAFT', 'SCHEDULED', 'RUNNING', 'PAUSED'].includes(c.status) ? (
              <IconBtn title="Cancelar" disabled={busy !== null} onClick={() => void run(c.id, 'cancel')}><X /></IconBtn>
            ) : null}
            <IconBtn title="Duplicar" disabled={busy !== null} onClick={() => void run(c.id, 'duplicate')}><Copy /></IconBtn>
            {c.status === 'DRAFT' ? (
              <IconBtn title="Eliminar" disabled={busy !== null} onClick={() => setCampaignToDelete(c.id)}>
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
      <PageHeader title="Campañas" subtitle="Automatiza publicaciones por grupos y porcentajes">
        <Button asChild className="bg-[#1877F2] hover:bg-[#0A5BC4] text-white">
          <Link href="/campaigns/new">
            <Plus className="mr-1.5 size-4" /> Nueva campaña
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
            {s || 'Todas'}
          </Button>
        ))}
      </div>

      {error ? <p className="text-sm text-[var(--destructive)]">{error}</p> : null}

      {data === null && !error ? (
        <LoadingRows rows={4} />
      ) : data && data.length === 0 ? (
        <EmptyState title="No hay campañas" description="Crea tu primera campaña automatizada." />
      ) : data ? (
        <DataTable columns={columns} data={data} />
      ) : null}

      <AlertDialog open={!!campaignToDelete} onOpenChange={(open) => !open && setCampaignToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar campaña?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. La campaña será eliminada permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-[var(--destructive)] text-[var(--destructive-foreground)] hover:bg-[var(--destructive)]/90"
              onClick={() => {
                if (campaignToDelete) {
                  void remove(campaignToDelete);
                  setCampaignToDelete(null);
                }
              }}
            >
              Eliminar
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