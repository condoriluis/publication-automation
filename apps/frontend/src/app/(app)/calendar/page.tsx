'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { api } from '@/lib/api';
import type { Paginated, PostDetail } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/status-badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export default function CalendarPage() {
  const [posts, setPosts] = useState<PostDetail[] | null>(null);
  const [cursor, setCursor] = useState<{ year: number; month: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const d = new Date();
    setCursor({ year: d.getFullYear(), month: d.getMonth() });
  }, []);

  useEffect(() => {
    api
      .get<Paginated<PostDetail>>('/posts?page=1&limit=100')
      .then((r) => setPosts(r.data))
      .catch((e) => setError(e instanceof Error ? e.message : 'No se pudieron cargar los posts'));
  }, []);

  const prev = useCallback(() => setCursor((c) => (c && c.month === 0 ? { year: c.year - 1, month: 11 } : c ? { ...c, month: c.month - 1 } : c)), []);
  const next = useCallback(() => setCursor((c) => (c && c.month === 11 ? { year: c.year + 1, month: 0 } : c ? { ...c, month: c.month + 1 } : c)), []);

  const ready = posts !== null && cursor !== null;
  const days = cursor ? buildDays(cursor.year, cursor.month) : [];
  const byDay = cursor ? groupByDay(posts ?? [], cursor.year, cursor.month) : new Map<string, PostDetail[]>();

  return (
    <div className="space-y-4">
      <PageHeader
        title={cursor ? `${MONTHS[cursor.month]} ${cursor.year}` : 'Calendario'}
        subtitle="Publicaciones programadas y publicadas"
      >
        <div className="flex gap-1.5">
          <Button size="sm" variant="outline" onClick={prev} disabled={!cursor}><ChevronLeft className="size-4" /></Button>
          <Button size="sm" variant="outline" onClick={() => { const d = new Date(); setCursor({ year: d.getFullYear(), month: d.getMonth() }); }}>Hoy</Button>
          <Button size="sm" variant="outline" onClick={next} disabled={!cursor}><ChevronRight className="size-4" /></Button>
        </div>
      </PageHeader>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {ready ? (
        <Card className="p-2">
          <div className="grid grid-cols-7 gap-px">
            {WEEKDAYS.map((w) => (
              <div key={w} className="px-2 py-2 text-center text-xs font-medium text-foreground/60">{w}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-px">
            {days.map((d) => {
              const dayPosts = byDay.get(d.key) ?? [];
              return (
                <div key={d.key} className={cn('min-h-24 rounded-lg border p-1.5', d.out === false ? 'bg-muted/30' : 'bg-card')}>
                  <p className="px-1 text-xs font-medium text-foreground/60">{d.day}</p>
                  <div className="mt-1 space-y-1">
                    {dayPosts.slice(0, 3).map((p) => (
                      <Link key={p.id} href={`/posts/${p.id}`} className="block rounded-md bg-primary/5 px-1.5 py-1 text-[11px] leading-tight hover:bg-primary/10">
                        <span className="block truncate">{p.content.slice(0, 40)}</span>
                      </Link>
                    ))}
                    <div className="flex flex-wrap gap-1 px-1">
                      {dayPosts.slice(3).map((p) => (
                        <Link key={p.id} href={`/posts/${p.id}`}>
                          <StatusBadge value={p.status} className="px-1.5 py-0 text-[10px]" />
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      ) : null}
      {!ready ? <Skeleton className="h-96" /> : null}
    </div>
  );
}

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

function buildDays(year: number, month: number) {
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7; // semana empieza en lunes
  const total = new Date(year, month + 1, 0).getDate();
  const cells: { day: number; key: string; out: boolean }[] = [];
  for (let i = 0; i < offset; i++) {
    const d = new Date(year, month, -offset + i + 1);
    cells.push({ day: d.getDate(), key: k(d), out: false });
  }
  for (let day = 1; day <= total; day++) {
    const d = new Date(year, month, day);
    cells.push({ day, key: k(d), out: true });
  }
  const remaining = (7 - (cells.length % 7)) % 7;
  for (let i = 1; i <= remaining; i++) {
    const d = new Date(year, month + 1, i);
    cells.push({ day: d.getDate(), key: k(d), out: false });
  }
  return cells;
}

function k(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function groupByDay(posts: PostDetail[], year: number, month: number) {
  const map = new Map<string, PostDetail[]>();
  for (const p of posts) {
    const s = p.scheduledFor ? new Date(p.scheduledFor) : p.publishedAt ? new Date(p.publishedAt) : null;
    if (!s || s.getFullYear() !== year || s.getMonth() !== month) continue;
    const key = k(s);
    const list = map.get(key) ?? [];
    list.push(p);
    map.set(key, list);
  }
  return map;
}