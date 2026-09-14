'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';

import { cn } from '@/lib/utils';
import { mainNav, bottomNav, groupLabel } from '@/lib/nav';
import { Button } from '@/components/ui/button';
import { UserChip } from '@/components/user-chip';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <div className="min-h-screen bg-muted/30">
      <Sidebar open={open} onClose={close} />
      {open && (
        <button
          type="button"
          aria-label="Cerrar menú"
          onClick={close}
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
        />
      )}
      <div className="transition-all duration-300 lg:pl-64">
        <Topbar onOpenMenu={() => setOpen(true)} />
        <main className="container max-w-7xl px-4 py-6 sm:px-6">{children}</main>
      </div>
    </div>
  );
}

function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  return (
    <aside
      className={cn(
        'fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r bg-card transition-transform duration-300 lg:translate-x-0',
        open ? 'translate-x-0' : '-translate-x-full',
      )}
    >
      <div className="flex h-16 items-center justify-between border-b px-6">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <span className="text-sm font-semibold">PA</span>
          </div>
          <span className="text-sm font-semibold tracking-tight">Publication Auto</span>
        </div>
        <Button variant="ghost" size="icon" aria-label="Cerrar menú" onClick={onClose} className="lg:hidden">
          <X />
        </Button>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {groupLabel(mainNav).primary.map((item) => (
          <SidebarLink key={item.href} {...item} active={pathname.startsWith(item.href)} onNavigate={onClose} />
        ))}
        <div className="pt-4">
          <p className="px-3 text-xs font-medium text-foreground/50">Administración</p>
          <div className="mt-2 space-y-1">
            {groupLabel(bottomNav).users.map((item) => (
              <SidebarLink key={item.href} {...item} active={pathname.startsWith(item.href)} onNavigate={onClose} />
            ))}
          </div>
        </div>
      </nav>
      <div className="border-t p-4">
        <UserChip />
      </div>
    </aside>
  );
}

function SidebarLink({
  title,
  href,
  icon: Icon,
  active,
  onNavigate,
}: {
  title: string;
  href: string;
  icon: typeof mainNav[number]['icon'];
  active?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
        active ? 'bg-primary/10 text-primary' : 'text-foreground/70 hover:bg-muted',
      )}
    >
      <Icon className="size-4 shrink-0" />
      <span className="truncate">{title}</span>
    </Link>
  );
}

function Topbar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const pathname = usePathname();
  const current = [...mainNav, ...bottomNav].find((n) => pathname.startsWith(n.href));
  return (
    <header className="sticky top-0 z-30 h-16 border-b bg-card/80 backdrop-blur">
      <div className="flex h-full items-center justify-between gap-2 px-4 sm:px-6">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" aria-label="Abrir menú" onClick={onOpenMenu} className="lg:hidden">
            <Menu />
          </Button>
          <div>
            <h1 className="text-sm font-semibold">{current?.title ?? 'Publication Automation'}</h1>
            <p className="hidden text-xs text-foreground/50 sm:block">Gestión de publicación en Facebook</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/pages">+ Página</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/campaigns/new">Nueva campaña</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
