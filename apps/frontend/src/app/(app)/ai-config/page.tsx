'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { type ColumnDef } from '@tanstack/react-table';
import {
  Sparkles,
  KeyRound,
  Zap,
  Loader2,
  CircleCheck,
  CircleX,
  SlidersHorizontal,
  RotateCcw,
  Lock,
  BookOpenCheck,
} from 'lucide-react';
import { toast } from 'sonner';

import { api } from '@/lib/api';
import type {
  AiConfigTestResult,
  AiConfigView,
  AiPromptFeature,
  AiUsageRow,
  AiUsageSummaryRow,
  AiUsageTimeseriesRow,
  Paginated,
  PromptTemplateView,
  TestAiConfigPayload,
  UpdateAiConfigPayload,
  UpdatePromptPayload,
} from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { DataTable } from '@/components/ui/data-table';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthAdmin } from '@/contexts/auth-context';
import { formatRelative } from '@/lib/utils';
import { PROVIDER_LABELS, UsageKpis } from '@/components/ai/usage-charts';

const PromptEditor = dynamic(() => import('@/components/ai/prompt-editor').then((m) => m.default), {
  ssr: false,
  loading: () => <Skeleton className="h-56 w-full" />,
});

const UsageCharts = dynamic(
  () => import('@/components/ai/usage-charts').then((m) => m.UsageCharts),
  {
    ssr: false,
    loading: () => (
      <Card>
        <CardContent>
          <Skeleton className="h-80 w-full" />
        </CardContent>
      </Card>
    ),
  },
);

const PROVIDERS = ['openai', 'anthropic', 'google', 'groq', 'openrouter'] as const;

const FEATURE_LABELS: Record<string, string> = {
  generate_post: 'Generar post',
  generate_campaign: 'Generar campaña',
  generate_reply: 'Respuesta (worker)',
  comment_reply: 'Responder comentario',
  analyze_comment: 'Análisis comentario',
  moderate_comment: 'Moderación',
  config_test: 'Prueba de conexión',
  chat: 'Chat',
};

const PROMPT_FEATURES: { value: AiPromptFeature; label: string; description: string }[] = [
  {
    value: 'generate_post',
    label: 'Publicaciones (Posts)',
    description: 'Texto para los posts creados desde el panel.',
  },
  {
    value: 'generate_campaign',
    label: 'Campañas',
    description: 'Contenido inicial de una campaña.',
  },
  {
    value: 'comment_reply',
    label: 'Respuesta manual',
    description: 'Sugerencias al responder comentarios.',
  },
  {
    value: 'generate_reply',
    label: 'Respuesta automática',
    description: 'Respuestas publicadas por el sistema.',
  },
  {
    value: 'analyze_comment',
    label: 'Análisis de sentimiento',
    description: 'Clasificación de riesgo e intención.',
  },
  {
    value: 'moderate_comment',
    label: 'Moderación',
    description: 'Decisión sobre ocultar o responder.',
  },
];

function fmt(n: number): string {
  return n.toLocaleString('es');
}

function fmtMs(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
}

export default function AiConfigPage() {
  const { user, isLoading, isAuthenticated } = useAuthAdmin();
  const canManage = Boolean(user?.roles.some((r) => r === 'ADMIN' || r === 'MANAGER'));
  // Mientras la sesión se resuelve (hidratación / `/auth/me`) todavía no
  // conocemos los roles: mostramos el loader y evitamos el "flash" de acceso
  // denegado que aparecía durante unos segundos.
  const resolving = isLoading || (isAuthenticated && !user);

  const [config, setConfig] = useState<AiConfigView | null>(null);
  const [prompts, setPrompts] = useState<PromptTemplateView[] | null>(null);
  const [summary, setSummary] = useState<AiUsageSummaryRow[]>([]);
  const [timeseries, setTimeseries] = useState<AiUsageTimeseriesRow[]>([]);
  const [seriesDays, setSeriesDays] = useState(30);
  const [usage, setUsage] = useState<Paginated<AiUsageRow> | null>(null);
  const [usagePage, setUsagePage] = useState(1);
  const [usageLimit, setUsageLimit] = useState(10);

  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const [selectedFeature, setSelectedFeature] = useState<AiPromptFeature>('generate_post');

  const selectedView = prompts?.find((p) => p.feature === selectedFeature) ?? null;

  useEffect(() => {
    if (!canManage) return;
    api
      .get<AiConfigView>('/ai/config')
      .then(setConfig)
      .catch((e) => toast.error(e instanceof Error ? e.message : 'No se pudo cargar la configuración de IA'));
    api
      .get<PromptTemplateView[]>('/ai/prompts')
      .then(setPrompts)
      .catch(() => undefined);
    api
      .get<AiUsageSummaryRow[]>('/ai/usage/summary')
      .then(setSummary)
      .catch(() => undefined);
  }, [canManage]);

  useEffect(() => {
    if (!canManage) return;
    const tz = typeof window !== 'undefined' ? window.Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC';
    api
      .get<AiUsageTimeseriesRow[]>(`/ai/usage/timeseries?days=${seriesDays}&tz=${encodeURIComponent(tz)}`)
      .then(setTimeseries)
      .catch(() => setTimeseries([]));
  }, [canManage, seriesDays]);

  useEffect(() => {
    if (!canManage) return;
    api
      .get<Paginated<AiUsageRow>>(`/ai/usage?page=${usagePage}&limit=${usageLimit}`)
      .then(setUsage)
      .catch(() => undefined);
  }, [canManage, usagePage, usageLimit]);

  if (resolving) {
    return <AiConfigSkeleton />;
  }

  if (!canManage) {
    return <AccessDenied name={user?.displayName ?? null} />;
  }

  async function saveConfig(dto: UpdateAiConfigPayload): Promise<void> {
    setSaving(true);
    try {
      const updated = await api.patch<AiConfigView>('/ai/config', dto);
      setConfig(updated);
      toast.success('Configuración de proveedor guardada');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar la configuración');
    } finally {
      setSaving(false);
    }
  }

  async function saveGlobalInstructions(systemPrompt: string): Promise<void> {
    try {
      const updated = await api.patch<AiConfigView>('/ai/config', { systemPrompt });
      setConfig(updated);
      toast.success('Instrucciones generales guardadas');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar las instrucciones');
    }
  }

  async function testConnection(dto: TestAiConfigPayload): Promise<void> {
    setTesting(true);
    try {
      const res = await api.post<AiConfigTestResult>('/ai/config/test', dto);
      if (res.ok) toast.success(`Conexión OK con ${res.provider} / ${res.model} · ${fmtMs(res.latencyMs)}`);
      else toast.error(`${res.message} (${fmtMs(res.latencyMs)})`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al probar la conexión');
    } finally {
      setTesting(false);
    }
  }

  async function savePrompt(feature: AiPromptFeature, dto: UpdatePromptPayload): Promise<void> {
    try {
      const updated = await api.patch<PromptTemplateView>(`/ai/prompts/${feature}`, dto);
      setPrompts((prev) => prev?.map((p) => (p.feature === feature ? updated : p)) ?? [updated]);
      setSelectedFeature(feature);
      toast.success('Prompt actualizado');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al guardar el prompt');
    }
  }

  async function restorePrompt(feature: AiPromptFeature): Promise<void> {
    try {
      const updated = await api.post<PromptTemplateView>(`/ai/prompts/${feature}/restore`, {});
      setPrompts((prev) => prev?.map((p) => (p.feature === feature ? updated : p)) ?? [updated]);
      toast.success('Prompt restaurado a los valores por defecto');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al restaurar el prompt');
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inteligencia Artificial"
        subtitle="Configuración de proveedor, comportamiento y métricas de uso"
      />

      <div className="grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
        <ConfigCard
          key={`${config?.provider ?? 'loading'}:${config?.model ?? ''}`}
          config={config}
          saving={saving}
          testing={testing}
          onSave={saveConfig}
          onTest={testConnection}
        />
        <UsageKpis summary={summary} />
      </div>

      <UsageCharts summary={summary} timeseries={timeseries} days={seriesDays} onDaysChange={setSeriesDays} />

      <GlobalInstructionsCard key={config?.systemPrompt ?? 'loading'} initialValue={config?.systemPrompt ?? ''} onSave={saveGlobalInstructions} />

      <PromptsCard
        features={PROMPT_FEATURES}
        selectedFeature={selectedFeature}
        onSelectFeature={setSelectedFeature}
        view={selectedView}
        onSave={savePrompt}
        onRestore={restorePrompt}
      />

      <ActivityCard 
        usage={usage} 
        onPaginationChange={(page, limit) => {
          setUsagePage(page);
          setUsageLimit(limit);
          // Mientras carga la página nueva, muestra el esqueleto en vez de
          // las filas de la página anterior.
          setUsage(null);
        }} 
      />
    </div>
  );
}

/* ── Esqueleto de carga ──────────────────────────────────────────────────── */
function AiConfigSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-64" />
      <div className="grid gap-6 lg:grid-cols-2 [&>*]:min-w-0">
        <Skeleton className="h-72" />
        <Skeleton className="h-72" />
      </div>
      <Skeleton className="h-28" />
      <Skeleton className="h-[420px]" />
      <Skeleton className="h-64" />
    </div>
  );
}

/* ── Acceso denegado ─────────────────────────────────────────────────────── */
function AccessDenied({ name }: { name?: string | null }) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center gap-2 px-6 py-8 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-red-500/10">
            <Lock className="size-6 text-red-500" />
          </div>
          <h2 className="text-base font-semibold text-foreground">Acceso restringido</h2>
          <p className="text-sm text-muted-foreground">
            No tienes permisos{name ? ` (${name})` : ''} para ver esta página.
          </p>
          <p className="text-xs text-muted-foreground/70">
            Solo Administradores y Managers pueden acceder a la configuración de IA.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

/* ── Distribución principal ──────────────────────────────────────────────── */
function ConfigCard({
  config,
  saving,
  testing,
  onSave,
  onTest,
}: {
  config: AiConfigView | null;
  saving: boolean;
  testing: boolean;
  onSave: (dto: UpdateAiConfigPayload) => void;
  onTest: (dto: TestAiConfigPayload) => void;
}) {
  const [provider, setProvider] = useState<string>(() => config?.provider ?? 'openai');
  const [model, setModel] = useState<string>(() => config?.model ?? '');
  const [baseUrl, setBaseUrl] = useState<string>(() => (config?.usesDefaultBaseUrl ? '' : (config?.baseUrl ?? '')));
  const [apiKey, setApiKey] = useState('');

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="size-4 text-[#1877F2]" />
          Proveedor y modelo activo
        </CardTitle>
        {config?.apiKeyMasked ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
            <KeyRound className="size-3" />
            {config.apiKeyMasked}
          </span>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="provider">Proveedor</Label>
            <Select value={provider} onValueChange={setProvider}>
              <SelectTrigger id="provider">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROVIDERS.map((p) => (
                  <SelectItem key={p} value={p}>{PROVIDER_LABELS[p]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="model">Modelo</Label>
            <Input id="model" value={model} onChange={(e) => setModel(e.target.value)} placeholder="p. ej. gpt-4o-mini" />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="baseUrl">Base URL (Opcional)</Label>
          <Input
            id="baseUrl"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="Dejar vacío para el endpoint por defecto"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="apiKey">API Key</Label>
          <Input
            id="apiKey"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Nueva clave (dejar vacío para mantener actual)"
            autoComplete="off"
          />
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-end gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={testing}
            onClick={() => void onTest({
              provider,
              model: model.trim(),
              baseUrl: baseUrl.trim(),
              apiKey: apiKey.trim(),
            })}
            className="w-full sm:w-auto"
          >
            {testing ? <Loader2 className="animate-spin" /> : <Zap className="size-3.5" />}
            Probar conexión
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={saving}
            onClick={() => void onSave({
              provider,
              model: model.trim(),
              baseUrl: baseUrl.trim(),
              apiKey: apiKey.trim(),
            })}
            className="w-full sm:w-auto bg-[#1877F2] hover:bg-[#0A5BC4] text-white shadow-sm"
          >
            {saving ? <Loader2 className="animate-spin" /> : <Sparkles className="size-3.5" />}
            Guardar configuración
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Instrucciones generales opcionales ───────────────────────────────────── */
function GlobalInstructionsCard({
  initialValue,
  onSave,
}: {
  initialValue: string;
  onSave: (systemPrompt: string) => Promise<void>;
}) {
  const [value, setValue] = useState(initialValue);
  const [saving, setSaving] = useState(false);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-x-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <BookOpenCheck className="size-4 text-[#1877F2]" />
          Instrucciones generales (opcional)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Define el contexto general, como el tono de voz de tu marca. Se aplicará a todas las interacciones.
        </p>
        <PromptEditor
          value={value}
          onChange={setValue}
          minHeight="140px"
          placeholder="Ej: Eres un asistente amigable y profesional para [Nombre Empresa]..."
          title="Instrucciones generales"
        />
        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            size="sm"
            disabled={saving || value.trim() === initialValue.trim()}
            onClick={() => {
              setSaving(true);
              void onSave(value.trim()).finally(() => setSaving(false));
            }}
            className="bg-[#1877F2] hover:bg-[#0A5BC4] text-white shadow-sm"
          >
            {saving ? <Loader2 className="animate-spin" /> : <BookOpenCheck className="size-3.5" />}
            Guardar instrucciones
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Prompts por función ──────────────────────────────────────────────────── */
function PromptsCard({
  features,
  selectedFeature,
  onSelectFeature,
  view,
  onSave,
  onRestore,
}: {
  features: { value: AiPromptFeature; label: string; description: string }[];
  selectedFeature: AiPromptFeature;
  onSelectFeature: (f: AiPromptFeature) => void;
  view: PromptTemplateView | null;
  onSave: (feature: AiPromptFeature, dto: UpdatePromptPayload) => Promise<void>;
  onRestore: (feature: AiPromptFeature) => Promise<void>;
}) {
  const featureMeta = features.find((f) => f.value === selectedFeature) ?? features[0];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <SlidersHorizontal className="size-4 text-[#1877F2]" />
          Comportamiento por Función
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="prompt-feature">Función</Label>
          <Select
            value={selectedFeature}
            onValueChange={(v) => {
              onSelectFeature(v as AiPromptFeature);
            }}
          >
            <SelectTrigger id="prompt-feature" className="max-w-md">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {features.map((f) => (
                <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-foreground/50">{featureMeta?.description}</p>
        </div>

        {!view ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        ) : (
          <PromptEditorForm
            key={`${view.feature}:${view.version}`}
            view={view}
            selectedFeature={selectedFeature}
            onSave={onSave}
            onRestore={onRestore}
          />
        )}
      </CardContent>
    </Card>
  );
}

function PromptEditorForm({
  view,
  selectedFeature,
  onSave,
  onRestore,
}: {
  view: PromptTemplateView;
  selectedFeature: AiPromptFeature;
  onSave: (feature: AiPromptFeature, dto: UpdatePromptPayload) => Promise<void>;
  onRestore: (feature: AiPromptFeature) => Promise<void>;
}) {
  const [systemPrompt, setSystemPrompt] = useState(() => view.systemPrompt ?? '');
  const [temperature, setTemperature] = useState<string>(() => String(view.effectiveTemperature ?? 0.7));
  const [maxTokens, setMaxTokens] = useState<string>(() => String(view.effectiveMaxTokens ?? 1024));
  const [saving, setSaving] = useState(false);
  const [restoring, setRestoring] = useState(false);

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-foreground/50">
          <Badge variant="secondary">v{view.version}</Badge>
          <span>{view.isDefault ? 'Usa los valores por defecto' : 'Personalizado'}</span>
          {view.updatedAt ? <span>· editado {formatRelative(view.updatedAt)}</span> : null}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="prompt-text">Instrucciones Específicas</Label>
        <PromptEditor
          value={systemPrompt}
          onChange={setSystemPrompt}
          title="Prompt · Instrucciones específicas"
          placeholder="Describe el comportamiento esperado para esta función..."
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="prompt-temperature">Temperatura (Creatividad)</Label>
          <div className="flex items-center gap-3">
            <Input
              id="prompt-temperature"
              type="number"
              step="0.1"
              min={0}
              max={2}
              value={temperature}
              onChange={(e) => setTemperature(e.target.value)}
              className="w-24"
            />
            <span className="text-xs text-muted-foreground">0 = Preciso, 2 = Creativo</span>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="prompt-maxTokens">Límite de Tokens (Salida)</Label>
          <div className="flex items-center gap-3">
            <Input
              id="prompt-maxTokens"
              type="number"
              min={1}
              max={65536}
              value={maxTokens}
              onChange={(e) => setMaxTokens(e.target.value)}
              className="w-32"
            />
            <span className="text-xs text-muted-foreground">Longitud máx. de respuesta</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pt-2">
        <p className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 px-3 py-1.5 rounded-md">
          <Lock className="size-3 shrink-0" />
          Bloque de seguridad inyectado por defecto.
        </p>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={restoring || saving}
            onClick={() => {
              setRestoring(true);
              void onRestore(selectedFeature).finally(() => setRestoring(false));
            }}
          >
            {restoring ? <Loader2 className="animate-spin" /> : <RotateCcw className="size-3.5" />}
            Restaurar por defecto
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={saving}
            onClick={() => {
              const temp = Number(temperature);
              const max = Number(maxTokens);
              if (!Number.isFinite(temp) || temp < 0 || temp > 2) {
                toast.error('La creatividad debe ser un número entre 0 y 2');
                return;
              }
              if (!Number.isInteger(max) || max < 1 || max > 65536) {
                toast.error('El límite de escritura debe ser un número entre 1 y 65536');
                return;
              }
              setSaving(true);
              void onSave(selectedFeature, {
                systemPrompt,
                temperature: temp,
                maxTokens: max,
              }).finally(() => setSaving(false));
            }}
            className="bg-[#1877F2] hover:bg-[#0A5BC4] text-white shadow-sm"
          >
            {saving ? <Loader2 className="animate-spin" /> : <SlidersHorizontal className="size-3.5" />}
            Guardar
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ── Actividad reciente ───────────────────────────────────────────────────── */
function ActivityCard({
  usage,
  onPaginationChange,
}: {
  usage: Paginated<AiUsageRow> | null;
  onPaginationChange: (page: number, limit: number) => void;
}) {
  const columns: ColumnDef<AiUsageRow>[] = [
    {
      accessorKey: 'createdAt',
      header: 'Fecha',
      cell: ({ row }) => <span className="whitespace-nowrap text-muted-foreground">{formatRelative(row.original.createdAt)}</span>,
    },
    {
      accessorKey: 'feature',
      header: 'Función',
      cell: ({ row }) => FEATURE_LABELS[row.original.feature] ?? row.original.feature,
    },
    {
      accessorKey: 'provider',
      header: 'Proveedor',
      cell: ({ row }) => PROVIDER_LABELS[row.original.provider] ?? row.original.provider,
    },
    {
      accessorKey: 'model',
      header: 'Modelo',
      cell: ({ row }) => <span className="font-medium">{row.original.model}</span>,
    },
    {
      accessorKey: 'inputTokens',
      header: 'In',
      cell: ({ row }) => <span className="tabular-nums">{fmt(row.original.inputTokens)}</span>,
    },
    {
      accessorKey: 'outputTokens',
      header: 'Out',
      cell: ({ row }) => <span className="tabular-nums">{fmt(row.original.outputTokens)}</span>,
    },
    {
      accessorKey: 'latencyMs',
      header: 'Latencia',
      cell: ({ row }) => <span className="tabular-nums">{fmtMs(row.original.latencyMs)}</span>,
    },
    {
      accessorKey: 'status',
      header: 'Estado',
      cell: ({ row }) => {
        const r = row.original;
        return r.status === 'SUCCESS' ? (
          <div className="flex justify-end"><CircleCheck className="size-4 text-emerald-600 dark:text-emerald-400" /></div>
        ) : (
          <div className="flex items-center justify-end gap-1 text-red-600 dark:text-red-400">
            <CircleX className="size-4 shrink-0" />
            <span className="truncate max-w-[150px]" title={r.errorMessage ?? ''}>
              {r.errorMessage ? r.errorMessage.split('\n')[0] : 'ERROR'}
            </span>
          </div>
        );
      },
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Actividad reciente de IA</CardTitle>
      </CardHeader>
      <CardContent>
        {usage?.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin actividad todavía.</p>
        ) : (
          <DataTable
            columns={columns}
            data={usage?.data ?? []}
            loading={!usage}
            manualPagination
            rowCount={usage?.meta.total ?? 0}
            onPaginationChange={(idx, size) => onPaginationChange(idx + 1, size)}
          />
        )}
      </CardContent>
    </Card>
  );
}