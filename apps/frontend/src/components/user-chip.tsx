'use client';

import Link from 'next/link';
import { LogOut } from 'lucide-react';

import { useAuthAdmin } from '@/contexts/auth-context';

export function UserChip() {
  const { user, logout } = useAuthAdmin();
  return (
    <div className="flex items-center gap-3">
      <div className="flex size-9 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
        {(user?.displayName ?? 'A').slice(0, 2).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{user?.displayName ?? 'Cargando…'}</p>
        <p className="truncate text-xs text-foreground/50">{user?.email ?? ''}</p>
      </div>
      <Link
        href="/login"
        onClick={() => void logout()}
        className="rounded-md p-1.5 text-foreground/50 transition-colors hover:bg-muted hover:text-foreground"
        aria-label="Cerrar sesión"
      >
        <LogOut className="size-4" />
      </Link>
    </div>
  );
}