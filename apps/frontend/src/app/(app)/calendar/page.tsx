'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, dateFnsLocalizer, Views } from 'react-big-calendar';
import type { View } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { Plus, RefreshCw } from 'lucide-react';
import Link from 'next/link';

import { api } from '@/lib/api';
import type { Paginated, PostDetail } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

// ── Localizer ────────────────────────────────────────────────────────────────
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: (date: Date) => startOfWeek(date, { weekStartsOn: 1 }),
  getDay,
  locales: { es },
});

// ── Status config ────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  PUBLISHED:  { label: 'Publicado',   color: '#fff', bg: '#31A24C' },
  SCHEDULED:  { label: 'Programado',  color: '#fff', bg: '#1877F2' },
  DRAFT:      { label: 'Borrador',    color: '#444', bg: '#E4E6EB' },
  FAILED:     { label: 'Fallido',     color: '#fff', bg: '#E02020' },
  CANCELLED:  { label: 'Cancelado',   color: '#fff', bg: '#A8AAAF' },
  RUNNING:    { label: 'En curso',    color: '#fff', bg: '#F7B928' },
  PAUSED:     { label: 'Pausado',     color: '#fff', bg: '#8B5CF6' },
};

interface CalEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resource: PostDetail;
}

export default function CalendarPage() {
  const router = useRouter();
  const [posts, setPosts] = useState<PostDetail[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>(Views.MONTH);
  const [date, setDate] = useState(new Date());

  const load = useCallback(() => {
    setLoading(true);
    api
      .get<Paginated<PostDetail>>('/posts?page=1&limit=100')
      .then((r) => setPosts(r.data))
      .catch(() => setPosts([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const events: CalEvent[] = (posts ?? []).flatMap((p) => {
    const d = p.scheduledFor ? new Date(p.scheduledFor)
      : p.publishedAt ? new Date(p.publishedAt)
      : null;
    if (!d) return [];
    return [{
      id: p.id,
      title: p.content?.slice(0, 60) || '(Sin contenido)',
      start: d,
      end: new Date(d.getTime() + 30 * 60 * 1000),
      resource: p,
    }];
  });

  const getBg = (p: PostDetail) => STATUS_CONFIG[p.status]?.bg ?? '#65676B';
  const getColor = (p: PostDetail) => STATUS_CONFIG[p.status]?.color ?? '#fff';

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <PageHeader
        title="Calendario de Publicaciones"
        subtitle="Vista mensual, semanal y diaria de todas tus publicaciones"
      >
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={cn('mr-1.5 size-3.5', loading && 'animate-spin')} />
            Actualizar
          </Button>
          <Button size="sm" asChild style={{ background: '#1877F2' }} className="text-white hover:opacity-90">
            <Link href="/posts/new">
              <Plus className="mr-1.5 size-3.5" />
              Nueva publicación
            </Link>
          </Button>
        </div>
      </PageHeader>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-2 rounded-xl border bg-[var(--card)] px-4 py-3 shadow-sm">
        {Object.entries(STATUS_CONFIG).map(([, cfg]) => (
          <div key={cfg.label} className="flex items-center gap-1.5">
            <span
              className="inline-block size-3 rounded-full shadow-sm"
              style={{ background: cfg.bg }}
            />
            <span className="text-xs font-medium text-[var(--muted-foreground)]">
              {cfg.label}
            </span>
          </div>
        ))}
      </div>

      {/* Calendar */}
      {loading ? (
        <Skeleton className="h-[640px] w-full rounded-xl" />
      ) : (
        <div className="overflow-hidden rounded-xl border bg-[var(--card)] shadow-sm" style={{ height: 680 }}>
          <Calendar
            localizer={localizer}
            culture="es"
            events={events}
            view={view}
            date={date}
            onView={setView}
            onNavigate={setDate}
            onSelectEvent={(e) => router.push(`/posts/${e.id}`)}
            eventPropGetter={(e) => ({
              style: {
                backgroundColor: getBg(e.resource),
                color: getColor(e.resource),
                border: 'none',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: '500',
                padding: '1px 6px',
              },
            })}
            messages={{
              next: 'Siguiente →',
              previous: '← Anterior',
              today: 'Hoy',
              month: 'Mes',
              week: 'Semana',
              day: 'Día',
              agenda: 'Agenda',
              date: 'Fecha',
              time: 'Hora',
              event: 'Publicación',
              noEventsInRange: 'No hay publicaciones en este período.',
              showMore: (c) => `+${c} más`,
            }}
            popup
            style={{ height: '100%' }}
          />
        </div>
      )}

      {/* Calendar global overrides */}
      <style>{`
        /* Toolbar */
        .rbc-toolbar {
          padding: 12px 16px;
          gap: 8px;
          flex-wrap: wrap;
          border-bottom: 1px solid var(--border);
          background: var(--card);
          font-family: inherit;
        }
        .rbc-toolbar button {
          color: var(--foreground);
          background: var(--background);
          border: 1px solid var(--border) !important;
          border-radius: 8px !important;
          padding: 5px 14px !important;
          font-size: 12px !important;
          font-weight: 500 !important;
          font-family: inherit !important;
          transition: all 0.15s;
          cursor: pointer;
          box-shadow: none !important;
        }
        .rbc-toolbar button:hover { background: var(--muted) !important; }
        .rbc-toolbar button.rbc-active {
          background: #1877F2 !important;
          border-color: #1877F2 !important;
          color: #fff !important;
        }
        .rbc-toolbar-label {
          font-size: 15px !important;
          font-weight: 700 !important;
          color: var(--foreground) !important;
          font-family: inherit !important;
        }
        /* Header row */
        .rbc-header {
          padding: 8px 4px !important;
          font-size: 11px !important;
          font-weight: 700 !important;
          text-transform: uppercase !important;
          letter-spacing: 0.05em !important;
          color: var(--muted-foreground) !important;
          background: var(--muted) !important;
          border-color: var(--border) !important;
          font-family: inherit !important;
        }
        /* Grid borders */
        .rbc-month-view { border: none !important; }
        .rbc-day-bg + .rbc-day-bg { border-left: 1px solid var(--border) !important; }
        .rbc-month-row + .rbc-month-row { border-top: 1px solid var(--border) !important; }
        .rbc-month-row { min-height: 90px; }
        /* Off-range days */
        .rbc-off-range-bg { background: var(--muted) !important; opacity: 0.5; }
        .rbc-off-range .rbc-button-link { color: var(--muted-foreground) !important; opacity: 0.5; }
        /* Today highlight */
        .rbc-today { background: #E7F3FF !important; }
        /* Date number */
        .rbc-date-cell {
          padding: 4px 8px 2px !important;
          font-size: 12px !important;
          font-weight: 500 !important;
          color: var(--muted-foreground) !important;
          text-align: right !important;
        }
        .rbc-date-cell.rbc-now .rbc-button-link {
          color: #1877F2 !important;
          font-weight: 800 !important;
        }
        .rbc-button-link {
          color: inherit !important;
          font-family: inherit !important;
        }
        /* Show more */
        .rbc-show-more {
          font-size: 11px !important;
          color: #1877F2 !important;
          font-weight: 600 !important;
          background: transparent !important;
          padding: 1px 6px !important;
        }
        /* Week / Day time grid */
        .rbc-time-view, .rbc-agenda-view { border: none !important; }
        .rbc-time-header-content { border-color: var(--border) !important; }
        .rbc-timeslot-group { border-color: var(--border) !important; min-height: 40px; }
        .rbc-time-content { border-color: var(--border) !important; }
        .rbc-time-content > * + * > * { border-left: 1px solid var(--border) !important; }
        .rbc-time-slot { color: var(--muted-foreground) !important; font-size: 10px !important; }
        .rbc-current-time-indicator { background: #1877F2 !important; height: 2px !important; }
        /* Agenda */
        .rbc-agenda-view table { font-family: inherit !important; font-size: 13px !important; }
        .rbc-agenda-date-cell, .rbc-agenda-time-cell { color: var(--muted-foreground) !important; }
        .rbc-agenda-event-cell { color: var(--foreground) !important; }
        .rbc-agenda-table tbody > tr { border-color: var(--border) !important; }
        .rbc-agenda-table tbody > tr > td { border-color: var(--border) !important; }
        /* Popup overlay */
        .rbc-overlay {
          background: var(--card) !important;
          border: 1px solid var(--border) !important;
          border-radius: 12px !important;
          box-shadow: 0 8px 24px rgba(0,0,0,0.12) !important;
          padding: 8px !important;
          font-family: inherit !important;
        }
        .rbc-overlay-header {
          font-size: 12px !important;
          font-weight: 700 !important;
          color: var(--foreground) !important;
          border-bottom: 1px solid var(--border) !important;
          padding-bottom: 6px !important;
          margin-bottom: 4px !important;
        }
        /* Dark mode adjustments */
        .dark .rbc-today { background: #1e3a5f !important; }
        .dark .rbc-off-range-bg { background: rgba(255,255,255,0.03) !important; }
      `}</style>
    </div>
  );
}