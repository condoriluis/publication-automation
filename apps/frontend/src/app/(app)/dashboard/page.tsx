'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, FileText, CalendarClock, XCircle, Megaphone, Link2, MessageCircle, Clock } from 'lucide-react';

import { api } from '@/lib/api';
import type { DashboardSummary } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/empty-state';
import { StatusBadge } from '@/components/status-badge';
import { formatRelative } from '@/lib/utils';

interface StatCardDef {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  color: string; // color del ícono / texto
  bg: string;    // fondo del chip
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<DashboardSummary>('/dashboard/summary?page=1&limit=8')
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'No se pudo cargar el dashboard'));
  }, []);

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!data) return <DashboardSkeleton />;

  const t = data.totals;
  const cards: StatCardDef[] = [
    { label: 'Posts publicados', value: t.postsPublicados, icon: FileText, href: '/posts?status=PUBLISHED', color: 'text-[#1877F2]', bg: 'bg-[#1877F2]/10' },
    { label: 'Programados', value: t.programados, icon: CalendarClock, href: '/posts?status=SCHEDULED', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10' },
    { label: 'Fallidos', value: t.fallidos, icon: XCircle, href: '/posts?status=FAILED', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-500/10' },
    { label: 'Campañas activas', value: t.campañasActivas, icon: Megaphone, href: '/campaigns', color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-500/10' },
    { label: 'Páginas conectadas', value: t.paginasConectadas, icon: Link2, href: '/pages', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: 'Comentarios recientes', value: t.comentariosRecientes, icon: MessageCircle, href: '/comments', color: 'text-sky-600 dark:text-sky-400', bg: 'bg-sky-500/10' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {cards.map((c) => (
          <StatCard key={c.label} {...c} />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="min-w-0 lg:col-span-2">
          <CardHeader className="flex flex-wrap items-center justify-between gap-2 space-y-0">
            <CardTitle className="text-base">Actividad reciente</CardTitle>
            {t.respuestasPendientes > 0 ? (
              <span className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                <Clock className="size-3" />
                {t.respuestasPendientes} respuestas pendientes
              </span>
            ) : null}
          </CardHeader>
          <CardContent className="p-0 sm:p-6">
            {data.actividadReciente.data.length === 0 ? (
              <EmptyState title="Sin actividad todavía" description="Las acciones quedarán registradas aquí." />
            ) : (
              <ul className="divide-y">
                {data.actividadReciente.data.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center gap-2 px-4 py-3 sm:px-0">
                    <StatusBadge value={a.action} className="shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{a.action}</p>
                      <p className="truncate text-xs text-foreground/50">
                        {a.user ? `${a.user.displayName} (${a.user.email})` : 'Sistema'} · {formatRelative(a.createdAt)}
                      </p>
                    </div>
                    <ArrowUpRight className="size-4 shrink-0 text-foreground/30" />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Panel de control</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2 text-sm sm:block sm:space-y-3">
            <ActionRow href="/pages" label="Conectar página" shortLabel="Páginas" />
            <ActionRow href="/campaigns/new" label="Crear campaña" shortLabel="Campaña" />
            <ActionRow href="/posts/new" label="Crear publicación" shortLabel="Publicar" />
            <ActionRow href="/ai" label="Generar contenido con IA" shortLabel="Contenido IA" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon: Icon, href, color, bg }: StatCardDef) {
  return (
    <Link href={href} className="group">
      <div className="rounded-xl border bg-card p-3 shadow-sm transition-all group-hover:-translate-y-0.5 group-hover:border-[#1877F2]/40 group-hover:shadow-md sm:p-4">
        <div className="flex items-center gap-2 sm:gap-3">
          <span className={`flex size-8 shrink-0 items-center justify-center rounded-full ${bg} sm:size-10`}>
            <Icon className={`size-4 ${color} sm:size-5`} />
          </span>
          <div className="min-w-0">
            <p className="text-xl font-bold leading-none tabular-nums sm:text-2xl">{value}</p>
            <p className="mt-0.5 truncate text-[11px] font-medium text-muted-foreground sm:mt-1 sm:text-xs">{label}</p>
          </div>
        </div>
      </div>
    </Link>
  );
}

function ActionRow({ href, label, shortLabel }: { href: string; label: string; shortLabel?: string }) {
  return (
    <Link href={href} className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted">
      <span className="font-medium">
        <span className="hidden sm:inline">{label}</span>
        <span className="sm:hidden">{shortLabel ?? label}</span>
      </span>
      <ArrowUpRight className="size-4 text-foreground/40" />
    </Link>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}