'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Link2, Unplug, RefreshCw } from 'lucide-react';

import { api } from '@/lib/api';
import type { Paginated, PageListRow, SafeFacebookAccount } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/status-badge';
import { EmptyState } from '@/components/empty-state';
import { LoadingRows, Pagination } from '@/components/pagination';
import { formatDate } from '@/lib/utils';

export default function PagesPage() {
  const [accounts, setAccounts] = useState<SafeFacebookAccount[] | null>(null);
  const [pages, setPages] = useState<Paginated<PageListRow> | null>(null);
  const [page, setPage] = useState(1);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [accs, list] = await Promise.all([
        api.get<SafeFacebookAccount[]>('/facebook/accounts'),
        api.get<Paginated<PageListRow>>(`/pages?page=${page}&limit=10`),
      ]);
      setAccounts(accs);
      setPages(list);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar páginas');
    }
  }, [page]);

  useEffect(() => {
    void load();
  }, [load]);

  // Refresco automático cuando el popup de Facebook cierra el OAuth.
  useEffect(() => {
    const channel = new BroadcastChannel('pa-fb-oauth');
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === 'connected') {
        toast.success('Cuenta de Facebook conectada');
        void load();
      }
    };
    channel.addEventListener('message', onMessage);
    return () => channel.close();
  }, [load]);

  async function connect() {
    setConnecting(true);
    try {
      const res = await api.get<{ authorizeUrl: string }>('/facebook/oauth/url');
      window.open(res.authorizeUrl, '_blank', 'noopener,noreferrer');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo iniciar la conexión');
    } finally {
      setConnecting(false);
    }
  }

  async function disconnect(id: string) {
    setDisconnecting(id);
    try {
      await api.delete(`/facebook/accounts/${id}`);
      toast.success('Cuenta desconectada');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo desconectar');
    } finally {
      setDisconnecting(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Páginas" subtitle="Cuentas de Facebook conectadas y sus páginas">
        <Button disabled={connecting} onClick={() => void connect()}>
          {connecting ? 'Preparando…' : 'Conectar cuenta de Facebook'}
        </Button>
      </PageHeader>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <section>
        <h3 className="mb-3 text-sm font-medium text-foreground/70">Cuentas conectadas</h3>
        {accounts === null ? (
          <LoadingRows rows={2} />
        ) : accounts.length === 0 ? (
          <EmptyState
            icon={<Link2 className="size-5" />}
            title="Sin cuentas conectadas"
            description="Conecta una cuenta de Facebook para gestionar sus páginas."
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {accounts.map((a) => (
              <Card key={a.id}>
                <CardHeader className="flex-row items-start justify-between space-y-0">
                  <div className="min-w-0">
                    <CardTitle className="truncate text-base">{a.facebookUserName ?? a.facebookUserId}</CardTitle>
                    <p className="mt-0.5 text-xs text-foreground/50">{a.facebookUserId}</p>
                  </div>
                  <StatusBadge value={a.status} />
                </CardHeader>
                <CardContent className="flex items-center justify-between">
                  <div className="text-sm text-foreground/60">
                    <p><span className="font-medium">{a.pageCount}</span> páginas</p>
                    {a.tokenExpiresAt ? <p>Token expira: {formatDate(a.tokenExpiresAt, { dateStyle: 'medium' })}</p> : null}
                  </div>
                  <Button size="sm" variant="outline" disabled={disconnecting === a.id} onClick={() => void disconnect(a.id)}>
                    <Unplug className="size-4" />
                    {disconnecting === a.id ? '…' : 'Desconectar'}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-medium text-foreground/70">Páginas</h3>
          <Button size="sm" variant="outline" onClick={() => void load()}>
            <RefreshCw className="size-3.5" /> Refrescar
          </Button>
        </div>
        {pages === null ? (
          <LoadingRows />
        ) : pages.data.length === 0 ? (
          <EmptyState title="Sin páginas" description="Conecta una cuenta para sincronizar sus páginas." />
        ) : (
          <Card>
            <ul className="divide-y">
              {pages.data.map((p) => (
                <li key={p.id} className="flex items-center gap-3 p-4">
                  {p.pictureUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.pictureUrl} alt={p.name} className="size-10 rounded-lg object-cover" />
                  ) : (
                    <div className="flex size-10 items-center justify-center rounded-lg bg-muted text-sm font-semibold text-foreground/60">
                      {p.name.slice(0, 1)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{p.name}</p>
                    <p className="truncate text-xs text-foreground/50">
                      {p.category ?? 'Sin categoría'} · {p.followersCount.toLocaleString('es')} seguidores
                    </p>
                  </div>
                  <StatusBadge value={p.status} />
                </li>
              ))}
            </ul>
            <Pagination data={pages} onPage={setPage} />
          </Card>
        )}
      </section>
    </div>
  );
}