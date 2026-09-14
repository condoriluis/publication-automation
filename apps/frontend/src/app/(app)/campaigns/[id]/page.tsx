'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Play, Pause, RotateCcw, X, Copy, ArrowLeft } from 'lucide-react';

import { api } from '@/lib/api';
import type { CampaignProgress } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/status-badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate } from '@/lib/utils';

export default function CampaignDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [data, setData] = useState<CampaignProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    api
      .get<CampaignProgress>(`/campaigns/${params.id}/progress`)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'No se pudo cargar la campaña'));
  }, [params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  // Refresco automático mientras la campaña esté activa (SCHEDULED/RUNNING/PAUSED).
  const isActive = ['SCHEDULED', 'RUNNING', 'PAUSED'].includes(data?.campaign.status ?? '');
  useEffect(() => {
    if (!isActive) return;
    const timer = window.setInterval(() => void load(), 4000);
    return () => window.clearInterval(timer);
  }, [isActive, load]);

  const run = useCallback(
    async (action: string) => {
      setBusy(action);
      try {
        await api.post(`/campaigns/${params.id}/${action}`);
        toast.success(`Campaña ${action}`);
        await load();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Acción fallida');
      } finally {
        setBusy(null);
      }
    },
    [params.id, load],
  );

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!data) return <LoadingSkeleton />;

  const c = data.campaign;
  const progress = c.totalActions > 0 ? c.actionsDone / c.totalActions : 0;

  return (
    <div className="space-y-4">
      <PageHeader title={c.name} subtitle={`${c.id.slice(0, 8)}… · creada ${formatDate(c.createdAt)}`}>
        <Button size="sm" variant="outline" onClick={() => router.push('/campaigns')}>
          <ArrowLeft className="size-4" /> Volver
        </Button>
      </PageHeader>

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 pt-6">
          <div className="flex items-center gap-3">
            <StatusBadge value={c.status} />
            {c.errorMessage ? <p className="text-xs text-destructive">{c.errorMessage}</p> : null}
          </div>
          <div className="flex gap-1.5">
            {['DRAFT', 'SCHEDULED', 'PAUSED'].includes(c.status) ? (
              <Button size="sm" disabled={busy !== null} onClick={() => void run('start')}><Play className="size-4" /> Iniciar</Button>
            ) : null}
            {c.status === 'RUNNING' ? (
              <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void run('pause')}><Pause className="size-4" /> Pausar</Button>
            ) : null}
            {c.status === 'PAUSED' ? (
              <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void run('resume')}><RotateCcw className="size-4" /> Reanudar</Button>
            ) : null}
            {['DRAFT', 'SCHEDULED', 'RUNNING', 'PAUSED'].includes(c.status) ? (
              <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void run('cancel')}><X className="size-4" /> Cancelar</Button>
            ) : null}
            <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void run('duplicate')}><Copy className="size-4" /> Duplicar</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Progreso</CardTitle></CardHeader>
          <CardContent>
            <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(100, progress * 100)}%` }} />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-3 text-sm">
              <Stat label="Publicados" value={String(data.postsDone)} />
              <Stat label="Fallidos" value={String(data.postsFailed)} />
              <Stat label="Total posts" value={String(data.postsTotal)} />
            </div>
            <dl className="mt-4 space-y-1 text-sm">
              <Row label="Inicio" value={formatDate(c.startAt)} />
              <Row label="Fin" value={c.endsAt ? formatDate(c.endsAt) : '—'} />
              <Row label="Acciones" value={`${c.actionsDone}/${c.totalActions}`} />
              <Row label="Intervalo" value={`${c.intervalSeconds}s`} />
              <Row label="Espera entre grupos" value={`${c.groupsWaitSeconds}s`} />
              <Row label="IA" value={c.aiGenerated ? 'Sí' : 'No'} />
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Grupos</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {data.groups.length === 0 ? <p className="text-sm text-foreground/60">Sin grupos.</p> : null}
            {data.groups.map((g) => (
              <div key={g.id} className="rounded-lg border p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{g.name}</span>
                  <StatusBadge value={g.status} />
                </div>
                <p className="mt-1 text-xs text-foreground/60">
                  {g.percentage}% · cada {g.intervalSeconds}s · {g.actionsDone}/{g.actionsTarget} acciones
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-xs text-foreground/60">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-24" />
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    </div>
  );
}