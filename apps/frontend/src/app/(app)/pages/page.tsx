'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Link2, Unplug, RefreshCw, BookOpen, Trash2 } from 'lucide-react';
import { type ColumnDef } from '@tanstack/react-table';

import { api } from '@/lib/api';
import type { Paginated, PageListRow, SafeFacebookAccount } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { StatusBadge } from '@/components/status-badge';
import { EmptyState } from '@/components/empty-state';
import { LoadingRows } from '@/components/pagination';
import { DataTable } from '@/components/ui/data-table';
import { FacebookIcon } from '@/components/facebook-icon';
import { TutorialFacebookGuide } from '@/components/tutorial-facebook-guide';
import { formatDate } from '@/lib/utils';

/** Etiquetas legibles para el estado de una cuenta conectada. */
const ACCOUNT_STATUS_LABELS: Record<SafeFacebookAccount['status'], string> = {
  ACTIVE: 'Conectada',
  EXPIRED: 'Expirada',
  REVOKED: 'Revocada',
  DISCONNECTED: 'Desconectada',
};

export default function PagesPage() {
  const [accounts, setAccounts] = useState<SafeFacebookAccount[] | null>(null);
  const [pages, setPages] = useState<PageListRow[] | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [accountToRemove, setAccountToRemove] = useState<string | null>(null);
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

  const hasActiveAccount = accounts?.some((a) => a.status === 'ACTIVE') ?? false;

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

  async function removeAccount(id: string) {
    setRemoving(id);
    try {
      await api.delete(`/facebook/accounts/${id}/permanent`);
      toast.success('Cuenta eliminada');
      setAccountToRemove(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo eliminar la cuenta');
      setAccountToRemove(null);
    } finally {
      setRemoving(null);
    }
  }

  async function syncAccount(id: string) {
    setSyncing(id);
    try {
      const res = await api.post<{ synced: number }>(`/pages/accounts/${id}/sync`);
      toast.success(`${res.synced} páginas sincronizadas desde Meta`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo sincronizar las páginas');
    } finally {
      setSyncing(null);
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
            {connecting ? 'Preparando…' : hasActiveAccount ? 'Conectar otra cuenta' : 'Conectar cuenta de Facebook'}
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
                <CardHeader className="flex-row items-center justify-between space-y-0">
                  <div className="flex min-w-0 items-center gap-3">
                    {a.pictureUrl ? (
                      <img
                        src={a.pictureUrl}
                        alt={a.facebookUserName ?? a.facebookUserId}
                        className="size-10 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-foreground/50">
                        {(a.facebookUserName ?? a.facebookUserId).slice(0, 1).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <CardTitle className="truncate text-base">{a.facebookUserName ?? a.facebookUserId}</CardTitle>
                      <p className="mt-0.5 text-xs text-foreground/50">{a.facebookUserId}</p>
                    </div>
                  </div>
                  <StatusBadge value={a.status} label={ACCOUNT_STATUS_LABELS[a.status]} />
                </CardHeader>
                <CardContent className="flex items-center justify-between gap-3">
                  <div className="text-sm text-foreground/60">
                    <p><span className="font-medium">{a.pageCount}</span> páginas</p>
                    {a.tokenExpiresAt ? <p>Token expira: {formatDate(a.tokenExpiresAt, { dateStyle: 'medium' })}</p> : null}
                  </div>
                  <div className="flex items-center gap-2">
                    {a.status === 'ACTIVE' ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={syncing === a.id}
                        title="Volver a traer la lista de páginas desde Meta"
                        onClick={() => void syncAccount(a.id)}
                      >
                        <RefreshCw className={`size-4 ${syncing === a.id ? 'animate-spin' : ''}`} />
                        {syncing === a.id ? 'Sincronizando…' : 'Sincronizar'}
                      </Button>
                    ) : null}
                    {a.status === 'ACTIVE' ? (
                      <Button size="sm" variant="outline" disabled={disconnecting === a.id} onClick={() => void disconnect(a.id)}>
                        <Unplug className="size-4" />
                        {disconnecting === a.id ? '…' : 'Desconectar'}
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={removing === a.id}
                        title="Eliminar del panel"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setAccountToRemove(a.id)}
                      >
                        <Trash2 className="size-4" />
                        {removing === a.id ? '…' : 'Quitar'}
                      </Button>
                    )}
                  </div>
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

      <AlertDialog open={accountToRemove !== null} onOpenChange={(open) => { if (!open) setAccountToRemove(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Quitar cuenta de Facebook?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará la cuenta y sus páginas del panel, junto con sus publicaciones,
              comentarios y campañas. Esta acción no se puede deshacer. Tu cuenta de Facebook no se ve afectada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removing !== null}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={removing !== null}
              onClick={() => { if (accountToRemove) void removeAccount(accountToRemove); }}
            >
              {removing ? 'Quitando…' : 'Sí, quitar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}