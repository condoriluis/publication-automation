'use client';

import Link from 'next/link';
import { LogOut } from 'lucide-react';

import { useAuthAdmin } from '@/contexts/auth-context';

export function UserChip({ compact }: { compact?: boolean }) {
  const { user, logout } = useAuthAdmin();

  const initials = (user?.displayName ?? 'A').slice(0, 2).toUpperCase();

  const avatar = (
    <div
      className="flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white shadow-sm"
      style={{ background: 'linear-gradient(135deg, #1877F2 0%, #0A5BC4 100%)' }}
    >
      {initials}
    </div>
  );

  if (compact) {
    return (
      <div title={user?.displayName ?? ''}>
        {avatar}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      {avatar}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold text-[var(--foreground)]">
          {user?.displayName ?? 'Cargando…'}
        </p>
        <p className="truncate text-[11px] text-[var(--muted-foreground)]">
          {user?.email ?? ''}
        </p>
      </div>
      <Link
        href="/login"
        onClick={() => void logout()}
        className="flex size-8 items-center justify-center rounded-lg text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
        aria-label="Cerrar sesión"
      >
        <LogOut className="size-4" />
      </Link>
    </div>
  );
}