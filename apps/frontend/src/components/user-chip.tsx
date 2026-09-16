'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, LogOut } from 'lucide-react';

import { useAuthAdmin } from '@/contexts/auth-context';

export function UserChip({ compact }: { compact?: boolean }) {
  const router = useRouter();
  const { user, logout } = useAuthAdmin();
  const [loggingOut, setLoggingOut] = useState(false);

  const initials = (user?.displayName ?? 'A').slice(0, 2).toUpperCase();

  const avatar = (
    <div
      className="flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white shadow-sm"
      style={{ background: 'linear-gradient(135deg, #1877F2 0%, #0A5BC4 100%)' }}
    >
      {initials}
    </div>
  );

  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      setLoggingOut(false);
      router.replace('/login');
    }
  }

  const logoutButton = (
    <button
      type="button"
      onClick={() => void handleLogout()}
      disabled={loggingOut}
      aria-label="Cerrar sesión"
      title="Cerrar sesión"
      className="flex size-8 shrink-0 items-center justify-center rounded-lg text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--foreground)] disabled:opacity-60"
    >
      {loggingOut ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" />}
    </button>
  );

  if (compact) {
    return (
      <div className="flex flex-col items-center gap-3">
        <div title={user?.displayName ?? ''}>{avatar}</div>
        {logoutButton}
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
      {logoutButton}
    </div>
  );
}