'use client';

import type { ReactNode } from 'react';
import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Menu, X, ChevronLeft, ChevronRight,
  Plus, Megaphone,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { mainNav, bottomNav } from '@/lib/nav';
import { Button } from '@/components/ui/button';
import { UserChip } from '@/components/user-chip';
import { MetaLogo } from '@/components/meta-logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { AiStatusBadge } from '@/components/ai-status-badge';
import { useAuthAdmin } from '@/contexts/auth-context';

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuthAdmin();

  // Desktop: sidebar collapsed/expanded
  const [collapsed, setCollapsed] = useState(false);
  // Mobile: sidebar open/closed (overlay)
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  const closeMobile = useCallback(() => setMobileOpen(false), []);
  const toggleCollapse = useCallback(() => setCollapsed((c) => !c), []);

  // Sin sesión: no renderizar contenido protegido mientras se redirige.
  if (!isLoading && !isAuthenticated) return null;

  const sidebarW = collapsed ? 'lg:pl-[4.5rem]' : 'lg:pl-64';

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Mobile backdrop */}
      {mobileOpen && (
        <button
          type="button"
          aria-label="Cerrar menú"
          onClick={closeMobile}
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
        />
      )}

      {/* Sidebar */}
      <Sidebar
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onCloseMobile={closeMobile}
        onToggleCollapse={toggleCollapse}
      />

      {/* Content area */}
      <div className={cn('transition-all duration-300 ease-in-out', sidebarW)}>
        <Topbar onOpenMobileMenu={() => setMobileOpen(true)} sidebarCollapsed={collapsed} />
        <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}

/* ── Sidebar ─────────────────────────────────────────────────────────────── */
function Sidebar({
  collapsed,
  mobileOpen,
  onCloseMobile,
  onToggleCollapse,
}: {
  collapsed: boolean;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onToggleCollapse: () => void;
}) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        // Base styles
        'fixed inset-y-0 left-0 z-50 flex flex-col border-r transition-all duration-300 ease-in-out',
        'bg-[var(--sidebar-bg)] shadow-sm',
        // Mobile: slide in/out
        mobileOpen ? 'translate-x-0' : '-translate-x-full',
        // Desktop: always visible, width changes on collapse
        'lg:translate-x-0',
        collapsed ? 'lg:w-[4.5rem]' : 'lg:w-64',
        // Mobile always full width of nav
        'w-64',
      )}
    >
      {/* Brand header */}
      <div className="flex h-16 shrink-0 items-center justify-between border-b px-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <MetaLogo className="size-8 shrink-0" />
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-[13px] font-bold leading-tight text-[#1877F2]">
                Publication
              </p>
              <p className="truncate text-[10px] font-medium leading-tight text-[var(--muted-foreground)]">
                Automation
              </p>
            </div>
          )}
        </div>

        {/* Mobile close button */}
        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Cerrar menú"
          className="flex size-8 items-center justify-center rounded-lg text-[var(--muted-foreground)] hover:bg-[var(--muted)] lg:hidden"
        >
          <X className="size-4" />
        </button>

        {/* Desktop collapse toggle */}
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
          className="hidden size-8 items-center justify-center rounded-lg text-[var(--muted-foreground)] transition-colors hover:bg-[var(--muted)] hover:text-[var(--foreground)] lg:flex"
        >
          {collapsed ? (
            <ChevronRight className="size-4" />
          ) : (
            <ChevronLeft className="size-4" />
          )}
        </button>
      </div>

      {/* Nav links */}
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto overflow-x-hidden p-2 pt-3">
        {/* Main section */}
        {!collapsed && (
          <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
            Principal
          </p>
        )}
        {mainNav.map((item) => (
          <SidebarLink
            key={item.href}
            {...item}
            active={pathname.startsWith(item.href)}
            collapsed={collapsed}
            onNavigate={onCloseMobile}
          />
        ))}

        <div className={cn('mt-3', !collapsed && 'border-t pt-3')}>
          {!collapsed && (
            <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
              Administración
            </p>
          )}
          {collapsed && <div className="my-2 border-t" />}
          {bottomNav.map((item) => (
            <SidebarLink
              key={item.href}
              {...item}
              active={pathname.startsWith(item.href)}
              collapsed={collapsed}
              onNavigate={onCloseMobile}
            />
          ))}
        </div>
      </nav>

      {/* User chip at bottom */}
      <div className={cn('shrink-0 border-t p-3', collapsed && 'px-2')}>
        {collapsed ? (
          <div className="flex justify-center">
            <UserChip compact />
          </div>
        ) : (
          <UserChip />
        )}
      </div>
    </aside>
  );
}

/* ── Sidebar link ────────────────────────────────────────────────────────── */
function SidebarLink({
  title,
  href,
  icon: Icon,
  active,
  collapsed,
  onNavigate,
}: {
  title: string;
  href: string;
  icon: (typeof mainNav)[number]['icon'];
  active?: boolean;
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      title={collapsed ? title : undefined}
      className={cn(
        'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150',
        collapsed ? 'justify-center px-0' : '',
        active
          ? 'bg-[var(--sidebar-active)] text-[var(--sidebar-active-fg)] font-semibold'
          : 'text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]',
      )}
    >
      <Icon
        className={cn(
          'size-[18px] shrink-0 transition-transform group-hover:scale-105',
          active ? 'text-[var(--sidebar-active-fg)]' : '',
        )}
      />
      {!collapsed && <span className="truncate">{title}</span>}
    </Link>
  );
}

/* ── Top bar ─────────────────────────────────────────────────────────────── */
function Topbar({
  onOpenMobileMenu,
  sidebarCollapsed,
}: {
  onOpenMobileMenu: () => void;
  sidebarCollapsed: boolean;
}) {
  const pathname = usePathname();
  const current = [...mainNav, ...bottomNav].find((n) => pathname.startsWith(n.href));
  const Icon = current?.icon;

  return (
    <header
      className="sticky top-0 z-30 h-14 border-b backdrop-blur-md"
      style={{ background: 'var(--topbar-bg)' }}
    >
      <div className="flex h-full items-center justify-between gap-3 px-4 sm:px-6">
        {/* Left: mobile menu + breadcrumb */}
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onOpenMobileMenu}
            aria-label="Abrir menú"
            className="flex size-9 items-center justify-center rounded-xl text-[var(--muted-foreground)] hover:bg-[var(--muted)] lg:hidden"
          >
            <Menu className="size-5" />
          </button>

          <div className="flex min-w-0 items-center gap-2">
            {Icon && (
              <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[var(--accent)]">
                <Icon className="size-4 text-[var(--accent-foreground)]" />
              </div>
            )}
            <div className="min-w-0">
              <h1 className="truncate text-[13px] font-semibold leading-tight text-[var(--foreground)]">
                {current?.title ?? 'Publication Automation'}
              </h1>
              <p className="hidden truncate text-[11px] text-[var(--muted-foreground)] sm:block">
                Meta Business Suite · Gestión de publicaciones
              </p>
            </div>
          </div>
        </div>

        {/* Right: quick actions */}
        <div className="flex min-w-0 shrink-0 items-center gap-2">
          <AiStatusBadge />
          <ThemeToggle />
          <Button variant="outline" size="sm" asChild className="hidden sm:inline-flex">
            <Link href="/pages">
              <Plus className="mr-1 size-3.5" />
              Página
            </Link>
          </Button>
          <Button size="sm" asChild className="bg-[#1877F2] hover:bg-[#0A5BC4] text-white shadow-sm">
            <Link href="/campaigns/new">
              <Megaphone className="mr-1.5 size-3.5" />
              <span className="hidden sm:inline">Nueva campaña</span>
              <span className="sm:hidden">Campaña</span>
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
