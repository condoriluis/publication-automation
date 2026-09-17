'use client';

import React, { useCallback, useEffect, useState } from 'react';
import type { ComponentProps, FormEvent } from 'react';
import { toast } from 'sonner';
import { CheckCircle2, Ban, Loader2, Pencil, Plus, Trash2, Eye, EyeOff } from 'lucide-react';
import { type ColumnDef } from '@tanstack/react-table';

import { api } from '@/lib/api';
import type { Paginated, User, UserRole } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { StatusBadge } from '@/components/status-badge';
import { EmptyState } from '@/components/empty-state';
import { LoadingRows } from '@/components/pagination';
import { DataTable } from '@/components/ui/data-table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { formatDate } from '@/lib/utils';

const ROLES: UserRole[] = ['ADMIN', 'MANAGER', 'OPERATOR'];

interface UserFormState {
  email: string;
  username: string;
  displayName: string;
  password: string;
  roles: UserRole[];
  isActive: boolean;
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);

  const load = useCallback(() => {
    api
      .get<Paginated<User>>('/users?page=1&limit=100')
      .then((res) => setUsers(res.data))
      .catch((e) => setError(e instanceof Error ? e.message : 'No se pudieron cargar los usuarios'));
  }, []);

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

  const confirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setBusy(deleteTarget.id);
    try {
      await api.delete(`/users/${deleteTarget.id}`);
      toast.success('Usuario eliminado');
      setDeleteTarget(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo eliminar');
    } finally {
      setBusy(null);
    }
  }, [deleteTarget, load]);

  const saveUser = useCallback(
    async (form: UserFormState, user: User | null) => {
      setBusy(user?.id ?? 'new');
      try {
        if (user) {
          const payload: Record<string, unknown> = {
            email: form.email,
            username: form.username,
            displayName: form.displayName,
            roles: form.roles,
            isActive: form.isActive,
          };
          if (form.password) payload.password = form.password;
          await api.patch(`/users/${user.id}`, payload);
          toast.success('Usuario actualizado');
        } else {
          await api.post('/users', { ...form, isActive: true });
          toast.success('Usuario creado');
        }
        setDialogOpen(false);
        setEditing(null);
        await load();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'No se pudo guardar');
      } finally {
        setBusy(null);
      }
    },
    [load],
  );

  const columns: ColumnDef<User>[] = [
    {
      accessorKey: 'displayName',
      header: 'Usuario',
      cell: ({ row }) => {
        const u = row.original;
        return (
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
              {u.displayName.slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate font-medium text-foreground">{u.displayName}</p>
              <p className="truncate text-xs text-foreground/50">{u.username}</p>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: 'email',
      header: 'Email',
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.email}</span>,
    },
    {
      id: 'roles',
      header: 'Roles',
      cell: ({ row }) => (
        <div className="flex flex-wrap items-center gap-1.5">
          {row.original.roles.map((r) => (
            <StatusBadge key={r} value={r} />
          ))}
        </div>
      ),
    },
    {
      id: 'status',
      header: 'Estado',
      cell: ({ row }) => (
        <StatusBadge value={row.original.isActive ? 'ACTIVE' : 'DISABLED'} label={row.original.isActive ? 'Activo' : 'Inactivo'} />
      ),
    },
    {
      accessorKey: 'createdAt',
      header: 'Creado',
      cell: ({ row }) => <span className="text-xs text-muted-foreground">{formatDate(row.original.createdAt, { dateStyle: 'medium' })}</span>,
    },
    {
      id: 'actions',
      header: 'Acciones',
      cell: ({ row }) => {
        const u = row.original;
        return (
          <div className="flex flex-wrap items-center gap-1.5">
            <IconBtn
              title="Editar"
              disabled={busy === u.id}
              onClick={() => {
                setEditing(u);
                setDialogOpen(true);
              }}
            >
              <Pencil />
            </IconBtn>
            <IconBtn title={u.isActive ? 'Desactivar' : 'Activar'} disabled={busy === u.id} onClick={() => void toggleActive(u)}>
              {u.isActive ? <Ban /> : <CheckCircle2 className="text-emerald-600" />}
            </IconBtn>
            <IconBtn
              title="Eliminar"
              disabled={busy === u.id}
              onClick={() => setDeleteTarget(u)}
            >
              <Trash2 className="text-[var(--destructive)]" />
            </IconBtn>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Control de acceso" subtitle="Usuarios y roles de la plataforma">
        <Button
          className="bg-[#1877F2] hover:bg-[#0A5BC4] text-white shadow-sm"
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="mr-1.5 size-4" /> Crear usuario
        </Button>
      </PageHeader>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {users === null && !error ? (
        <LoadingRows rows={4} />
      ) : users && users.length === 0 ? (
        <EmptyState title="Sin usuarios" description="Crea el primer usuario de la plataforma." />
      ) : users ? (
        <DataTable columns={columns} data={users} />
      ) : null}

      <UserDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        user={editing}
        busy={busy !== null}
        onSave={saveUser}
      />

      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar usuario?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará permanentemente el usuario <span className="font-medium">{deleteTarget?.email}</span>. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy !== null}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={busy !== null}
              onClick={() => void confirmDelete()}
            >
              {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              Sí, eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface UserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: User | null;
  busy: boolean;
  onSave: (form: UserFormState, user: User | null) => Promise<void>;
}

function UserDialog({ open, onOpenChange, user, busy, onSave }: UserDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open ? (
        <UserDialogBody
          key={user?.id ?? 'new'}
          user={user}
          busy={busy}
          onSave={onSave}
          onClose={() => onOpenChange(false)}
        />
      ) : null}
    </Dialog>
  );
}

function UserDialogBody({
  user,
  busy,
  onSave,
  onClose,
}: {
  user: User | null;
  busy: boolean;
  onSave: (form: UserFormState, user: User | null) => Promise<void>;
  onClose: () => void;
}) {
  const editing = user !== null;
  const [form, setForm] = useState<UserFormState>(() => emptyForm(user));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    void onSave(form, user);
  };

  return (
    <DialogContent className="sm:max-w-lg">
      <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar usuario' : 'Crear usuario'}</DialogTitle>
            <DialogDescription>
              {editing ? 'Actualiza los datos del usuario. Deja la contraseña vacía para no cambiarla.' : 'Registra un nuevo usuario en la plataforma.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="user-email">Email</Label>
              <Input
                id="user-email"
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="user-username">Usuario</Label>
              <Input
                id="user-username"
                required
                minLength={3}
                maxLength={32}
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="user-name">Nombre</Label>
              <Input
                id="user-name"
                required
                maxLength={80}
                value={form.displayName}
                onChange={(e) => setForm({ ...form, displayName: e.target.value })}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="user-password">{editing ? 'Nueva contraseña' : 'Contraseña'}</Label>
              <PasswordInput
                id="user-password"
                minLength={8}
                maxLength={72}
                required={!editing}
                placeholder={editing ? 'Dejar vacío para no cambiar' : 'Mínimo 8 caracteres'}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Roles</Label>
              <RoleToggles value={form.roles} onChange={(roles) => setForm({ ...form, roles })} />
            </div>
            {editing ? (
              <label className="flex items-center gap-2 text-sm text-foreground/80 sm:col-span-2">
                <Checkbox
                  checked={form.isActive}
                  onCheckedChange={(checked) => setForm({ ...form, isActive: checked === true })}
                />
                Cuenta activa
              </label>
            ) : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
              Cancelar
            </Button>
            <Button type="submit" disabled={busy} className="bg-[#1877F2] hover:bg-[#0A5BC4] text-white">
              {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              {editing ? 'Guardar cambios' : 'Crear usuario'}
            </Button>
          </DialogFooter>
        </form>
    </DialogContent>
  );
}

function emptyForm(user: User | null): UserFormState {
  return {
    email: user?.email ?? '',
    username: user?.username ?? '',
    displayName: user?.displayName ?? '',
    password: '',
    roles: user?.roles?.length ? (user.roles as UserRole[]) : ['OPERATOR'],
    isActive: user?.isActive ?? true,
  };
}

function RoleToggles({ value, onChange }: { value: UserRole[]; onChange: (roles: UserRole[]) => void }) {
  const toggle = (r: UserRole) => {
    onChange(value.includes(r) ? value.filter((x) => x !== r) : [...value, r]);
  };
  return (
    <div className="flex flex-wrap gap-2">
      {ROLES.map((r) => (
        <Button
          key={r}
          type="button"
          size="sm"
          variant={value.includes(r) ? 'default' : 'outline'}
          onClick={() => toggle(r)}
        >
          {r}
        </Button>
      ))}
    </div>
  );
}

function PasswordInput(props: Omit<ComponentProps<typeof Input>, 'type'>) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input type={show ? 'text' : 'password'} className="pr-10" {...props} />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        title={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
      >
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
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