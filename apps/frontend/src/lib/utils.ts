import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function formatDate(iso: string | null | undefined, opts?: Intl.DateTimeFormatOptions, fallback = '—'): string {
  if (!iso) return fallback;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return fallback;
  return new Intl.DateTimeFormat('es', {
    dateStyle: 'medium',
    timeStyle: 'short',
    ...opts,
  }).format(d);
}

export function formatRelative(iso: string | null | undefined): string {
  const d = new Date(iso ?? '');
  const ts = d.getTime();
  if (Number.isNaN(ts)) return '—';
  const r = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });
  const diff = ts - Date.now();
  const min = Math.round(diff / 60_000);
  if (Math.abs(min) < 60) return r.format(min, 'minute');
  const hr = Math.round(min / 60);
  if (Math.abs(hr) < 24) return r.format(hr, 'hour');
  return r.format(Math.round(hr / 24), 'day');
}

export function formatPercent(n: number): string {
  return new Intl.NumberFormat('es', { style: 'percent', maximumFractionDigits: 1 }).format(n);
}
