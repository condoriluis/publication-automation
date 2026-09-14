'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Copy, Play, Pause, RotateCcw, X, Plus, Trash2 } from 'lucide-react';

import { api } from '@/lib/api';
import { StatusBadge } from '@/components/status-badge';
import { PageHeader } from '@/components/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/empty-state';
import { LoadingRows, Pagination } from '@/components/pagination';
import { formatDate, formatPercent } from '@/lib/utils';
import type { Campaign, CampaignStatus, Paginated } from '@/lib/types';

const STATUSES: (CampaignStatus | '')[] = ['', 'DRAFT', 'SCHEDULED', 'RUNNING', 'PAUSED', 'COMPLETED', 'FAILED', 'CANCELLED'];

export default function CampaignsPage() {
  const [data, setData] = useState<Paginated<Campaign> | null>(null);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const q = status ? `&status=${status}` : '';
    api
      .get<Paginated<Campaign>>(`/campaigns?page=${page}&limit=10${q}`)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'No se pudieron cargar las campañas'));
  }, [page, status]);

  useEffect(() => {
    void load();
  }, [load]);

  // Refresco automático mientras exista alguna campaña activa en la lista.
  const hasActive = (data?.data ?? []).some((c) =>
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

  return (
    <div className="space-y-4">
      <PageHeader title="Campañas" subtitle="Automatiza publicaciones por grupos y porcentajes">
        <Button asChild>
          <Link href="/campaigns/new">
            <Plus className="size-4" /> Nueva campaña
          </Link>
        </Button>
      </PageHeader>

      <div className="flex flex-wrap gap-1.5">
        {STATUSES.map((s) => (
          <Button key={s || 'all'} size="sm" variant={status === s ? 'default' : 'outline'} onClick={() => { setStatus(s); setPage(1); }}>
            {s || 'Todas'}
          </Button>
        ))}
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {data === null && !error ? (
        <LoadingRows />
      ) : data && data.data.length === 0 ? (
        <EmptyState title="No hay campañas" description="Crea tu primera campaña automatizada." />
      ) : data ? (
        <Card>
          <ul className="divide-y">
            {data.data.map((c) => {
              const progress = c.totalActions > 0 ? c.actionsDone / c.totalActions : 0;
              return (
                <li key={c.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <Link href={`/campaigns/${c.id}`} className="text-sm font-medium hover:text-primary">
                      {c.name}
                    </Link>
                    <p className="truncate text-xs text-foreground/50">
                      {c.pageId ? `Página ${c.pageId.slice(0, 8)}…` : '—'} · Inicio {formatDate(c.startAt)}
                    </p>
                    <div className="mt-2 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full ${c.status === 'FAILED' ? 'bg-destructive' : 'bg-primary'}`}
                        style={{ width: `${Math.min(100, progress * 100)}%` }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-foreground/60">
                      {c.actionsDone}/{c.totalActions} acciones · {formatPercent(progress)}
                      {c.actionsFailed > 0 ? <> · <span className="text-destructive">{c.actionsFailed} fallidas</span></> : null}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <StatusBadge value={c.status} />
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
                      <IconBtn title="Eliminar" disabled={busy !== null} onClick={() => void remove(c.id)}>
                        <Trash2 />
                      </IconBtn>
                    ) : null}
                  </div>
                </li>
              );
            })}
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