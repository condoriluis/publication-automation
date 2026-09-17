'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2, Ban, CheckCircle2 } from 'lucide-react';

import { api } from '@/lib/api';
import type { Paginated, User, UserRole } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StatusBadge } from '@/components/status-badge';
import { EmptyState } from '@/components/empty-state';
import { LoadingRows, Pagination } from '@/components/pagination';
import { formatDate } from '@/lib/utils';

const ROLES: UserRole[] = ['ADMIN', 'MANAGER', 'OPERATOR'];

export default function UsersPage() {
  const [data, setData] = useState<Paginated<User> | null>(null);
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ email: '', username: '', password: '', displayName: '', roles: ['OPERATOR'] as UserRole[] });
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    api.get<Paginated<User>>(`/users?page=${page}&limit=10`).then(setData).catch((e) => setError(e instanceof Error ? e.message : 'No se pudieron cargar los usuarios'));
  }, [page]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleActive = useCallback(
    async (u: User) => {
      setBusy(u.id);
      try {
        await api.patch(`/users/${u.id}`, { isActive: !u.isActive });
        toast.success(`Usuario ${u.isActive ? 'desactivado' : 'activado'}`);
        await load();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'No se pudo actualizar');
      } finally {
        setBusy(null);
      }
    },
    [load],
  );

  const remove = useCallback(
    async (u: User) => {
      setBusy(u.id);
      try {
        await api.delete(`/users/${u.id}`);
        toast.success('Usuario eliminado');
        await load();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'No se pudo eliminar');
      } finally {
        setBusy(null);
      }
    },
    [load],
  );

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    try {
      await api.post('/users', { ...form, roles: form.roles });
      toast.success('Usuario creado');
      setForm({ email: '', username: '', password: '', displayName: '', roles: ['OPERATOR'] });
      setPage(1);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo crear el usuario');
    } finally {
      setCreating(false);
    }
  }

  function toggleRole(r: UserRole) {
    setForm((f) => ({
      ...f,
      roles: f.roles.includes(r) ? f.roles.filter((x) => x !== r) : [...f.roles, r],
    }));
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Control de acceso" subtitle="Usuarios y roles de la plataforma" />

      <form onSubmit={create}>
        <Card>
          <CardHeader><CardTitle className="text-base">Crear usuario</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>Usuario</Label>
              <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>Contraseña</Label>
              <Input type="password" minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Roles</Label>
              <div className="flex gap-2">
                {ROLES.map((r) => (
                  <Button key={r} type="button" size="sm" variant={form.roles.includes(r) ? 'default' : 'outline'} onClick={() => toggleRole(r)}>
                    {r}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={creating}>
              {creating ? <Loader2 className="animate-spin" /> : <Plus className="size-4" />}
              {creating ? 'Creando…' : 'Crear usuario'}
            </Button>
          </CardFooter>
        </Card>
      </form>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {data === null && !error ? (
        <LoadingRows />
      ) : data && data.data.length === 0 ? (
        <EmptyState title="Sin usuarios" />
      ) : data ? (
        <Card>
          <ul className="divide-y">
            {data.data.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center gap-3 p-4">
                <div className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                  {u.displayName.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{u.displayName}</p>
                  <p className="truncate text-xs text-foreground/50">{u.email} · creado {formatDate(u.createdAt, { dateStyle: 'medium' })}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  {u.roles.map((r) => <StatusBadge key={r} value={r} />)}
                </div>
                <div className="flex items-center gap-1.5">
                  <Button size="sm" variant="outline" disabled={busy === u.id} onClick={() => void toggleActive(u)}>
                    {u.isActive ? <Ban className="size-3.5" /> : <CheckCircle2 className="size-3.5" />}
                    {u.isActive ? 'Desactivar' : 'Activar'}
                  </Button>
                  <Button size="sm" variant="outline" className="text-destructive" disabled={busy === u.id} onClick={() => void remove(u)}>
                    <Trash2 className="size-3.5" />
                  </Button>
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