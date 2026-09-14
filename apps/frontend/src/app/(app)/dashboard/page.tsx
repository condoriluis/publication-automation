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
  const cards = [
    { label: 'Posts publicados', value: t.postsPublicados, icon: FileText, href: '/posts?status=PUBLISHED' },
    { label: 'Programados', value: t.programados, icon: CalendarClock, href: '/posts?status=SCHEDULED' },
    { label: 'Fallidos', value: t.fallidos, icon: XCircle, href: '/posts?status=FAILED' },
    { label: 'Campañas activas', value: t.campañasActivas, icon: Megaphone, href: '/campaigns' },
    { label: 'Páginas conectadas', value: t.paginasConectadas, icon: Link2, href: '/pages' },
    { label: 'Comentarios recientes', value: t.comentariosRecientes, icon: MessageCircle, href: '/comments' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {cards.map((c) => (
          <Link key={c.label} href={c.href} className="group">
            <Card className="transition-colors group-hover:border-primary/40">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-foreground/60">{c.label}</p>
                  <c.icon className="size-4 text-foreground/40" />
                </div>
                <p className="mt-2 text-2xl font-semibold">{c.value}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Actividad reciente</CardTitle>
            {t.respuestasPendientes > 0 ? (
              <span className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                <Clock className="size-3" />
                {t.respuestasPendientes} respuestas pendientes
              </span>
            ) : null}
          </CardHeader>
          <CardContent>
            {data.actividadReciente.data.length === 0 ? (
              <EmptyState title="Sin actividad todavía" description="Las acciones quedarán registradas aquí." />
            ) : (
              <ul className="divide-y">
                {data.actividadReciente.data.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 py-3">
                    <StatusBadge value={a.action} className="min-w-0" />
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
          <CardContent className="space-y-3 text-sm">
            <ActionRow href="/pages" label="Conectar una página" />
            <ActionRow href="/campaigns/new" label="Crear campaña" />
            <ActionRow href="/posts/new" label="Crear publicación" />
            <ActionRow href="/ai" label="Generar contenido con IA" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ActionRow({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted">
      <span className="font-medium">{label}</span>
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