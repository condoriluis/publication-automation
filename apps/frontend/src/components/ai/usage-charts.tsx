'use client';

import { useMemo, useState } from 'react';
import {
  CircleCheck,
  Coins,
  PhoneCall,
  Timer,
  SlidersHorizontal,
  Table as TableIcon,
} from 'lucide-react';
import { type ColumnDef } from '@tanstack/react-table';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { cn } from '@/lib/utils';
import type { AiUsageSummaryRow, AiUsageTimeseriesRow } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';

export const PROVIDER_LABELS: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google (Gemini)',
  groq: 'Groq',
  openrouter: 'OpenRouter',
};

const PROVIDER_COLORS: Record<string, string> = {
  openai: '#10a37f',
  anthropic: '#d97757',
  google: '#4285f4',
  groq: '#f55036',
  openrouter: '#9f5ef2',
};

const SHORT_LABELS = Object.fromEntries(
  Object.entries(PROVIDER_LABELS).map(([k, v]) => [k, v.replace(/ \(.+\)/, '')]),
);

function fmt(n: number): string {
  return n.toLocaleString('es');
}

function fmtMs(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`;
}

function compact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toLocaleString('es', { maximumFractionDigits: 1 })}M`;
  if (abs >= 1_000) return `${(n / 1_000).toLocaleString('es', { maximumFractionDigits: 1 })}k`;
  return fmt(n);
}

function providerLabel(p: string): string {
  return PROVIDER_LABELS[p] ?? p;
}

/* -- Tooltip compartido (seguro en dark mode) ----------------------------- */
function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number; color?: string; dataKey?: string }[];
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-lg border bg-background/95 px-3 py-2 text-xs shadow-lg backdrop-blur">
      {label ? <p className="mb-1 font-semibold text-foreground">{label}</p> : null}
      {payload.map((p, i) => (
        <p key={`${p.dataKey ?? p.name ?? i}`} className="flex items-center gap-1.5 text-muted-foreground">
          <span className="size-2 shrink-0 rounded-full" style={{ background: p.color ?? '#1877F2' }} />
          {p.name}: <span className="font-semibold tabular-nums text-foreground">{fmt(Number(p.value ?? 0))}</span>
        </p>
      ))}
    </div>
  );
}

/* -- KPI: numeros clave del consumo -------------------------------------- */
export function UsageKpis({ summary }: { summary: AiUsageSummaryRow[] }) {
  const kpis = useMemo(() => {
    const calls = summary.reduce((a, s) => a + s.calls, 0);
    const ok = summary.reduce((a, s) => a + s.ok, 0);
    const input = summary.reduce((a, s) => a + s.inputTokens, 0);
    const output = summary.reduce((a, s) => a + s.outputTokens, 0);
    const latSum = summary.reduce((a, s) => a + s.avgLatencyMs * s.calls, 0);
    return {
      calls,
      tokens: input + output,
      okRate: calls > 0 ? Math.round((ok / calls) * 1000) / 10 : 0,
      latAvg: calls > 0 ? latSum / calls : 0,
    };
  }, [summary]);

  if (summary.length === 0) {
    return (
      <Card>
        <CardContent className="py-6 text-sm text-muted-foreground">
          Sin registros todavia. El consumo se mide a partir de la primera llamada de IA.
        </CardContent>
      </Card>
    );
  }

  const items = [
    { icon: <PhoneCall className="size-4" />, label: 'Llamadas', value: fmt(kpis.calls) },
    { icon: <Coins className="size-4" />, label: 'Tokens', value: fmt(kpis.tokens) },
    { icon: <CircleCheck className="size-4" />, label: '% Exito', value: `${kpis.okRate}%` },
    { icon: <Timer className="size-4" />, label: 'Latencia media', value: fmtMs(kpis.latAvg) },
  ];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Metricas de consumo</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3">
          {items.map((it) => (
            <div key={it.label} className="flex items-center gap-3 rounded-xl border bg-background p-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#1877F2]/10 text-[#1877F2]">
                {it.icon}
              </div>
              <div className="min-w-0">
                <p className="truncate text-[11px] font-medium text-muted-foreground">{it.label}</p>
                <p className="truncate text-lg font-bold tabular-nums text-foreground">{it.value}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/* -- Panel de graficas: barras + dona + evolucion temporal ---------------- */
const DAY_RANGES = [7, 30, 90] as const;
const TREND_TABS = [
  { key: 'tokens', label: 'Tokens' },
  { key: 'calls', label: 'Llamadas' },
  { key: 'errors', label: 'Errores' },
  { key: 'latency', label: 'Latencia' },
] as const;
type TrendKey = (typeof TREND_TABS)[number]['key'];

export function UsageCharts({
  summary,
  timeseries,
  days,
  onDaysChange,
}: {
  summary: AiUsageSummaryRow[];
  timeseries: AiUsageTimeseriesRow[];
  days: number;
  onDaysChange: (d: number) => void;
}) {
  const [trendTab, setTrendTab] = useState<TrendKey>('tokens');
  const [showTable, setShowTable] = useState(false);

  const barData = useMemo(
    () =>
      [...summary]
        .sort((a, b) => b.inputTokens + b.outputTokens - (a.inputTokens + a.outputTokens))
        .slice(0, 8)
        .map((s) => ({
          model: `${SHORT_LABELS[s.provider] ?? s.provider} / ${s.model}`,
          entrada: s.inputTokens,
          salida: s.outputTokens,
        })),
    [summary],
  );

  const donutData = useMemo(() => {
    const ok = summary.reduce((a, s) => a + s.ok, 0);
    const errors = summary.reduce((a, s) => a + s.errors, 0);
    return [
      { name: 'OK', value: ok, color: '#10b981' },
      { name: 'Errores', value: errors, color: '#ef4444' },
    ];
  }, [summary]);

  const okRate = useMemo(() => {
    const calls = summary.reduce((a, s) => a + s.calls, 0);
    const ok = summary.reduce((a, s) => a + s.ok, 0);
    return calls > 0 ? Math.round((ok / calls) * 100) : 0;
  }, [summary]);

  const dayData = useMemo(() => {
    type Day = {
      date: string;
      calls: number;
      errors: number;
      inputTokens: number;
      outputTokens: number;
      latencySum: number;
      latencyN: number;
    };
    const m = new Map<string, Day>();
    for (const t of timeseries) {
      const e = m.get(t.date) ?? { date: t.date, calls: 0, errors: 0, inputTokens: 0, outputTokens: 0, latencySum: 0, latencyN: 0 };
      e.calls += t.calls;
      e.errors += t.errors;
      e.inputTokens += t.inputTokens;
      e.outputTokens += t.outputTokens;
      e.latencySum += t.avgLatencyMs * t.calls;
      e.latencyN += t.calls;
      m.set(t.date, e);
    }
    return [...m.values()]
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((d) => ({ ...d, avgLatencyMs: d.latencyN > 0 ? Math.round(d.latencySum / d.latencyN) : 0 }));
  }, [timeseries]);

  const providerChips = useMemo(() => [...new Set(summary.map((s) => s.provider))], [summary]);

  const trendArea = (key: TrendKey) => {
    const axisProps = {
      tick: { fill: 'var(--muted-foreground)', fontSize: 11 },
      tickLine: false as const,
      axisLine: { stroke: 'var(--border)' },
    };
    const grid = <CartesianGrid stroke="#94a3b8" strokeOpacity={0.25} strokeDasharray="3 3" vertical={false} />;
    const tooltip = <Tooltip content={<ChartTooltip />} />;
    const x = (
      <XAxis
        {...axisProps}
        dataKey="date"
        tickFormatter={(v: string) => v.slice(5).replace('-', '/')}
        interval="preserveStartEnd"
        minTickGap={24}
      />
    );
    const y = (
      <YAxis
        tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
        tickLine={false}
        axisLine={false}
        width={52}
        tickFormatter={(v: number) => compact(v)}
        allowDecimals={false}
      />
    );

    switch (key) {
      case 'tokens':
        return (
          <AreaChart data={dayData} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
            {grid}
            {x}
            {y}
            {tooltip}
            <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" formatter={(value) => <span className="text-muted-foreground">{value}</span>} />
            <Area type="monotone" dataKey="inputTokens" name="Entrada" stackId="t" stroke="#1877F2" fill="#1877F2" fillOpacity={0.85} strokeWidth={2} />
            <Area type="monotone" dataKey="outputTokens" name="Salida" stackId="t" stroke="#3ba7ff" fill="#3ba7ff" fillOpacity={0.55} strokeWidth={2} />
          </AreaChart>
        );
      case 'calls':
        return (
          <AreaChart data={dayData} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
            {grid}
            {x}
            {y}
            {tooltip}
            <Area type="monotone" dataKey="calls" name="Llamadas" stroke="#1877F2" fill="#1877F2" fillOpacity={0.18} strokeWidth={2} />
          </AreaChart>
        );
      case 'errors':
        return (
          <AreaChart data={dayData} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
            {grid}
            {x}
            {y}
            {tooltip}
            <Area type="monotone" dataKey="errors" name="Errores" stroke="#ef4444" fill="#ef4444" fillOpacity={0.18} strokeWidth={2} />
          </AreaChart>
        );
      case 'latency':
        return (
          <AreaChart data={dayData} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
            {grid}
            {x}
            {y}
            {tooltip}
            <Area type="monotone" dataKey="avgLatencyMs" name="Latencia (ms)" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.18} strokeWidth={2} />
          </AreaChart>
        );
    }
  };

  const detailColumns: ColumnDef<AiUsageSummaryRow>[] = [
    {
      accessorKey: 'provider',
      header: 'Proveedor',
      cell: ({ row }) => providerLabel(row.original.provider),
    },
    {
      accessorKey: 'model',
      header: 'Modelo',
      cell: ({ row }) => <span className="font-medium">{row.original.model}</span>,
    },
    {
      accessorKey: 'calls',
      header: 'Llamadas',
      cell: ({ row }) => <span className="tabular-nums">{fmt(row.original.calls)}</span>,
    },
    {
      id: 'status',
      header: 'OK / Err',
      cell: ({ row }) => (
        <span className="tabular-nums">
          <span className="text-emerald-600 dark:text-emerald-400">{row.original.ok}</span>
          <span className="mx-1 text-muted-foreground">/</span>
          <span className={row.original.errors > 0 ? 'text-red-600 dark:text-red-400' : ''}>{row.original.errors}</span>
        </span>
      ),
    },
    {
      accessorKey: 'inputTokens',
      header: 'Tokens in',
      cell: ({ row }) => <span className="tabular-nums">{fmt(row.original.inputTokens)}</span>,
    },
    {
      accessorKey: 'outputTokens',
      header: 'Tokens out',
      cell: ({ row }) => <span className="tabular-nums">{fmt(row.original.outputTokens)}</span>,
    },
    {
      accessorKey: 'avgLatencyMs',
      header: 'Lat. media',
      cell: ({ row }) => <span className="tabular-nums">{fmtMs(row.original.avgLatencyMs)}</span>,
    },
  ];

  const okCount = donutData[0]?.value ?? 0;
  const errCount = donutData[1]?.value ?? 0;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="text-base">Analitica de consumo por proveedor y modelo</CardTitle>
        <Button type="button" size="sm" variant="outline" onClick={() => setShowTable((v) => !v)}>
          {showTable ? <SlidersHorizontal className="size-3.5" /> : <TableIcon className="size-3.5" />}
          {showTable ? 'Ocultar detalle' : 'Ver detalle'}
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        {barData.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Sin registros todavia. El consumo se mide a partir de la primera llamada de IA.
          </p>
        ) : (
          <>
            <div className="grid gap-6 lg:grid-cols-[1.6fr,1fr]">
              <div className="min-w-0">
                <p className="mb-1 text-sm font-semibold text-foreground">Tokens consumidos por modelo</p>
                <p className="mb-3 text-xs text-muted-foreground">Totales acumulados (entrada + salida), top 8</p>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={barData} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                      <CartesianGrid stroke="#94a3b8" strokeOpacity={0.25} strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="model"
                        tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
                        tickLine={false}
                        axisLine={{ stroke: 'var(--border)' }}
                        interval="preserveStartEnd"
                        minTickGap={12}
                        tickFormatter={(v: string) => (v.length > 14 ? `${v.slice(0, 13)}...` : v)}
                      />
                      <YAxis
                        tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                        width={52}
                        tickFormatter={(v: number) => compact(v)}
                        allowDecimals={false}
                      />
                      <Tooltip content={<ChartTooltip />} />
                      <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" formatter={(value) => <span className="text-muted-foreground">{value}</span>} />
                      <Bar dataKey="entrada" name="Entrada" stackId="t" fill="#1877F2" />
                      <Bar dataKey="salida" name="Salida" stackId="t" fill="#3ba7ff" radius={[4, 4, 0, 0]} maxBarSize={44} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="flex min-w-0 flex-col">
                <p className="mb-1 text-sm font-semibold text-foreground">Estado de las llamadas</p>
                <p className="mb-3 text-xs text-muted-foreground">Exitosas vs. con error</p>
                <div className="relative mx-auto h-44 w-full max-w-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={donutData} dataKey="value" nameKey="name" innerRadius={56} outerRadius={80} paddingAngle={2} strokeWidth={0}>
                        {donutData.map((d) => (
                          <Cell key={d.name} fill={d.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<ChartTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold tabular-nums text-foreground">{okRate}%</span>
                    <span className="text-[11px] font-medium text-muted-foreground">exito</span>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="size-2 rounded-full bg-emerald-500" /> OK {fmt(okCount)}
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="size-2 rounded-full bg-red-500" /> Errores {fmt(errCount)}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-xl border p-4">
              <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-semibold text-foreground">Evolucion del consumo</p>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1 rounded-lg border bg-background p-0.5">
                    {DAY_RANGES.map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => onDaysChange(d)}
                        className={cn(
                          'rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors',
                          days === d ? 'bg-[#1877F2] text-white' : 'text-muted-foreground hover:text-foreground',
                        )}
                      >
                        {d}d
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-1 rounded-lg border bg-background p-0.5">
                    {TREND_TABS.map((t) => (
                      <button
                        key={t.key}
                        type="button"
                        onClick={() => setTrendTab(t.key)}
                        className={cn(
                          'rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors',
                          trendTab === t.key ? 'bg-[#1877F2] text-white' : 'text-muted-foreground hover:text-foreground',
                        )}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <p className="mb-3 text-xs text-muted-foreground">
                Todas las llamadas de IA. Pasa el cursor sobre los puntos para ver el detalle.
              </p>
              {dayData.length === 0 ? (
                <div className="flex h-56 items-center justify-center rounded-lg border border-dashed px-4 text-center text-sm text-muted-foreground">
                  Sin datos en este rango de fechas todavía. Intenta con otra cantidad de días.
                </div>
              ) : (
                <div className="h-56 w-full">
                  <ResponsiveContainer key={trendTab} width="100%" height="100%">
                    {trendArea(trendTab)}
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {showTable ? (
              <div>
                <DataTable columns={detailColumns} data={summary} hideToolbar hidePagination />
              </div>
            ) : null}

            {providerChips.length > 1 ? (
              <div className="flex flex-wrap items-center gap-2">
                {providerChips.map((p) => (
                  <span
                    key={p}
                    className="inline-flex items-center gap-1.5 rounded-full border bg-background px-2.5 py-1 text-[11px] font-medium text-muted-foreground"
                  >
                    <span className="size-2 rounded-full" style={{ background: PROVIDER_COLORS[p] ?? '#94a3b8' }} />
                    {providerLabel(p)}
                  </span>
                ))}
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}