'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Link2, Unplug, RefreshCw, BookOpen } from 'lucide-react';
import { type ColumnDef } from '@tanstack/react-table';

import { api } from '@/lib/api';
import type { Paginated, PageListRow, SafeFacebookAccount } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/status-badge';
import { EmptyState } from '@/components/empty-state';
import { LoadingRows } from '@/components/pagination';
import { DataTable } from '@/components/ui/data-table';
import { FacebookIcon } from '@/components/facebook-icon';
import { TutorialFacebookGuide } from '@/components/tutorial-facebook-guide';
import { formatDate } from '@/lib/utils';

export default function PagesPage() {
  const [accounts, setAccounts] = useState<SafeFacebookAccount[] | null>(null);
  const [pages, setPages] = useState<PageListRow[] | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tutorialOpen, setTutorialOpen] = useState(false);

  const load = useCallback(() => {
    return Promise.all([
      api.get<SafeFacebookAccount[]>('/facebook/accounts'),
      api.get<Paginated<PageListRow>>(`/pages?page=1&limit=100`),
    ])
      .then(([accs, list]) => {
        setAccounts(accs);
        setPages(list.data);
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Error al cargar páginas');
      });
  }, []);

  const reload = useCallback(() => {
    setError(null);
    void load();
  }, [load]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const channel = new BroadcastChannel('pa-fb-oauth');
    const onMessage = (e: MessageEvent) => {
      if (e.data?.type === 'connected') {
        toast.success('Cuenta de Facebook conectada');
        void reload();
      }
    };
    channel.addEventListener('message', onMessage);
    return () => channel.close();
  }, [reload]);

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

  // Columnas para la tabla dinámica
  const columns: ColumnDef<PageListRow>[] = [
    {
      accessorKey: 'name',
      header: 'Página',
      cell: ({ row }) => {
        const p = row.original;
        return (
          <div className="flex items-center gap-3">
            {p.pictureUrl ? (

              <img src={p.pictureUrl} alt={p.name} className="size-8 shrink-0 rounded-md object-cover" />
            ) : (
              <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-semibold text-foreground/60">
                {p.name.slice(0, 1)}
              </div>
            )}
            <span className="font-medium text-foreground">{p.name}</span>
          </div>
        );
      },
    },
    {
      accessorKey: 'category',
      header: 'Categoría',
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.category ?? 'Sin categoría'}</span>
      ),
    },
    {
      accessorKey: 'followersCount',
      header: 'Seguidores',
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.followersCount.toLocaleString('es')}</span>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Estado',
      cell: ({ row }) => <StatusBadge value={row.original.status} />,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Páginas" subtitle="Cuentas de Facebook conectadas y sus páginas">
          <Button variant="outline" onClick={() => setTutorialOpen(true)}>
            <BookOpen className="size-4 text-[#1877F2]" />
            Tutorial
          </Button>
          <Button disabled={connecting} className="bg-[#1877F2] hover:bg-[#0A5BC4] text-white shadow-sm" onClick={() => void connect()}>
            <FacebookIcon className="size-4" />
            {connecting ? 'Preparando…' : 'Conectar cuenta de Facebook'}
          </Button>
        </PageHeader>

      <TutorialFacebookGuide open={tutorialOpen} onClose={() => setTutorialOpen(false)} />

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
          <h3 className="text-sm font-medium text-foreground/70">Páginas de Facebook</h3>
          <Button size="sm" variant="outline" onClick={() => void reload()}>
            <RefreshCw className="size-3.5" /> Refrescar
          </Button>
        </div>

        {pages === null ? (
          <LoadingRows />
        ) : pages.length === 0 ? (
          <EmptyState title="Sin páginas" description="Conecta una cuenta para sincronizar sus páginas." />
        ) : (
          <DataTable columns={columns} data={pages} />
        )}
      </section>
    </div>
  );
}