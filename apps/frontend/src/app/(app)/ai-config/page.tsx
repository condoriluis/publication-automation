'use client';

import { useEffect, useState } from 'react';
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
  Paginated,
  PromptTemplateView,
  UpdateAiConfigPayload,
  UpdatePromptPayload,
} from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuthAdmin } from '@/contexts/auth-context';
import { formatRelative } from '@/lib/utils';

const PROVIDERS = ['openai', 'anthropic', 'google', 'groq', 'openrouter'] as const;

const PROVIDER_LABELS: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Google (Gemini)',
  groq: 'Groq',
  openrouter: 'OpenRouter',
};

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
    label: 'Publicaciones en la página',
    description: 'El texto de los posts que creas desde el panel.',
  },
  {
    value: 'generate_campaign',
    label: 'Campañas',
    description: 'El contenido inicial (descripción, plantilla del post e intervalo) de una campaña.',
  },
  {
    value: 'comment_reply',
    label: 'Respuestas a comentarios',
    description: 'La respuesta sugerida cuando respondes un comentario de forma manual.',
  },
  {
    value: 'generate_reply',
    label: 'Respuestas automáticas',
    description: 'Las respuestas que las tareas automáticas publican solas cuando corresponde.',
  },
  {
    value: 'analyze_comment',
    label: 'Análisis de comentarios',
    description: 'Clasifica cada comentario (riesgo, si pregunta o si quiere comprar) para gestionarlo mejor.',
  },
  {
    value: 'moderate_comment',
    label: 'Moderación de comentarios',
    description: 'Sugiere si un comentario debe responderse, ocultarse o eliminarse.',
  },
];

function fmt(n: number): string {
  return n.toLocaleString('es');
}

function fmtMs(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
}

export default function AiConfigPage() {
  const { user } = useAuthAdmin();
  const canManage = Boolean(user?.roles.some((r) => r === 'ADMIN' || r === 'MANAGER'));

  const [config, setConfig] = useState<AiConfigView | null>(null);
  const [prompts, setPrompts] = useState<PromptTemplateView[] | null>(null);
  const [summary, setSummary] = useState<AiUsageSummaryRow[]>([]);
  const [usage, setUsage] = useState<Paginated<AiUsageRow> | null>(null);
  const [usagePage, setUsagePage] = useState(1);

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
    api
      .get<Paginated<AiUsageRow>>(`/ai/usage?page=${usagePage}&limit=12`)
      .then(setUsage)
      .catch(() => undefined);
  }, [canManage, usagePage]);

  if (!canManage) {
    return (
      <div className="space-y-6">
        No tienes permisos ({user?.displayName ?? '…'}) para ver esta página. Solo Administradores y Managers.
      </div>
    );
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

  async function testConnection(): Promise<void> {
    setTesting(true);
    try {
      const res = await api.post<AiConfigTestResult>('/ai/config/test', {});
      if (res.ok) toast.success(`Conexión OK · ${res.message} (${fmtMs(res.latencyMs)})`);
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
        title="IA · Gestión"
        subtitle="Proveedor y modelo, instrucciones de la IA y consumo real de tokens"
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <ConfigCard
          key={`${config?.provider ?? 'loading'}:${config?.model ?? ''}`}
          config={config}
          saving={saving}
          testing={testing}
          onSave={saveConfig}
          onTest={testConnection}
        />
        <SummaryCard summary={summary} />
      </div>

      <GlobalInstructionsCard key={config?.systemPrompt ?? 'loading'} initialValue={config?.systemPrompt ?? ''} onSave={saveGlobalInstructions} />

      <PromptsCard
        features={PROMPT_FEATURES}
        selectedFeature={selectedFeature}
        onSelectFeature={setSelectedFeature}
        view={selectedView}
        onSave={savePrompt}
        onRestore={restorePrompt}
      />

      <ActivityCard usage={usage} page={usagePage} onPage={setUsagePage} />
    </div>
  );
}

/* ── Configuración del proveedor ──────────────────────────────────────────── */
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
  onTest: () => void;
}) {
  const [provider, setProvider] = useState<string>(() => config?.provider ?? 'openai');
  const [model, setModel] = useState<string>(() => config?.model ?? '');
  const [baseUrl, setBaseUrl] = useState<string>(() => (config?.usesDefaultBaseUrl ? '' : (config?.baseUrl ?? '')));
  const [apiKey, setApiKey] = useState('');

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-x-2">
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
          <Label htmlFor="baseUrl">Base URL (opcional)</Label>
          <Input
            id="baseUrl"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="Vacío = endpoint por defecto del proveedor"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="apiKey">API key (déjalo vacío para conservar la actual)</Label>
          <Input
            id="apiKey"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Nueva API key del proveedor (vacío = conservar la actual)"
            autoComplete="off"
          />
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={testing}
            onClick={() => void onTest()}
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
            className="bg-[#1877F2] hover:bg-[#0A5BC4] text-white shadow-sm"
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
        <p className="text-sm text-foreground/60">
          Un texto corto que se aplica a <strong>todas</strong> las funciones, por ejemplo el tono o la voz de tu
          marca. Si no sabes qué escribir, déjalo vacío: no es obligatorio.
        </p>
        <Textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={3}
          placeholder="P. ej.: Habla siempre en tono cercano y con la voz de «Mi Negocio»."
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
  const [systemPrompt, setSystemPrompt] = useState(() => view?.systemPrompt ?? '');
  const [temperature, setTemperature] = useState<string>(() => String(view?.effectiveTemperature ?? 0.7));
  const [maxTokens, setMaxTokens] = useState<string>(() => String(view?.effectiveMaxTokens ?? 1024));
  const [saving, setSaving] = useState(false);
  const [restoring, setRestoring] = useState(false);

  function resetEditor(next: PromptTemplateView | null) {
    setSystemPrompt(next?.systemPrompt ?? '');
    setTemperature(String(next?.effectiveTemperature ?? 0.7));
    setMaxTokens(String(next?.effectiveMaxTokens ?? 1024));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <SlidersHorizontal className="size-4 text-[#1877F2]" />
          Cómo se comporta la IA en cada función
        </CardTitle>
        <p className="text-sm text-foreground/60">
          Las instrucciones de cada función son opcionales: si no editas nada, funcionan los valores recomendados.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="prompt-feature">Función</Label>
          <Select
            value={selectedFeature}
            onValueChange={(v) => {
              resetEditor(null);
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
          <div
            key={`${view.feature}:${view.version}`}
            className="space-y-4 rounded-lg border p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs text-foreground/50">
                <Badge variant="secondary">v{view.version}</Badge>
                <span>{view.isDefault ? 'Usa los valores por defecto' : 'Personalizado'}</span>
                {view.updatedAt ? <span>· editado {formatRelative(view.updatedAt)}</span> : null}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="prompt-text">Instrucciones para esta función</Label>
              <Textarea
                id="prompt-text"
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                rows={10}
                placeholder="Describe cómo quieres que escriba la IA en esta función…"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="prompt-temperature">Creatividad (temperatura 0–2)</Label>
                <Input
                  id="prompt-temperature"
                  type="number"
                  step="0.1"
                  min={0}
                  max={2}
                  value={temperature}
                  onChange={(e) => setTemperature(e.target.value)}
                />
                <p className="text-xs text-foreground/50">
                  Baja (0) = siempre igual y preciso · Alta (2) = más variado y creativo.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="prompt-maxTokens">Límite de escritura (tokens de salida)</Label>
                <Input
                  id="prompt-maxTokens"
                  type="number"
                  min={1}
                  max={65536}
                  value={maxTokens}
                  onChange={(e) => setMaxTokens(e.target.value)}
                />
                <p className="text-xs text-foreground/50">
                  Cuánto texto puede escribir como máximo. Un post largo usa unos 1000.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-start justify-between gap-3 pt-1">
              <p className="flex max-w-xl items-start gap-1.5 text-xs text-foreground/50">
                <Lock className="mt-0.5 size-3.5 shrink-0" />
                La aplicación añade automáticamente los datos de tu página, el tema y un bloque de seguridad que no
                puede editarse, para proteger tu información y cumplir las normas de Meta.
              </p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={restoring || saving}
                  onClick={() => {
                    setRestoring(true);
                    void onRestore(selectedFeature)
                      .then(() => resetEditor(view))
                      .finally(() => setRestoring(false));
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
        )}
      </CardContent>
    </Card>
  );
}

/* ── Uso por proveedor/modelo ─────────────────────────────────────────────── */
function SummaryCard({ summary }: { summary: AiUsageSummaryRow[] }) {
  const totalTokens = summary.reduce((acc, s) => acc + s.inputTokens + s.outputTokens, 0);
  const totalCalls = summary.reduce((acc, s) => acc + s.calls, 0);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-x-2">
        <CardTitle className="text-base">Uso por proveedor y modelo</CardTitle>
        <div className="flex items-center gap-3 text-xs text-foreground/50">
          <span>{fmt(totalCalls)} llamadas</span>
          <span>{fmt(totalTokens)} tokens</span>
        </div>
      </CardHeader>
      <CardContent className="p-0 sm:p-6">
        {summary.length === 0 ? (
          <p className="px-4 pb-4 text-sm text-foreground/50 sm:px-0">
            Sin registros todavía. El consumo se mide a partir de la primera llamada de IA.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-foreground/50">
                  <th className="px-4 py-2 font-medium sm:pl-0">Proveedor</th>
                  <th className="px-4 py-2 font-medium">Modelo</th>
                  <th className="px-4 py-2 text-right font-medium">Llamadas</th>
                  <th className="px-4 py-2 text-right font-medium">OK / Err</th>
                  <th className="px-4 py-2 text-right font-medium">Tokens in</th>
                  <th className="px-4 py-2 text-right font-medium">Tokens out</th>
                  <th className="px-4 py-2 text-right font-medium">Lat. media</th>
                  <th className="px-4 py-2 text-right font-medium">Último uso</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {summary.map((s) => (
                  <tr key={`${s.provider}::${s.model}`}>
                    <td className="px-4 py-2.5 sm:pl-0">{PROVIDER_LABELS[s.provider] ?? s.provider}</td>
                    <td className="px-4 py-2.5 font-medium">{s.model}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{fmt(s.calls)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      <span className="text-emerald-600 dark:text-emerald-400">{s.ok}</span>
                      <span className="mx-1 text-foreground/30">/</span>
                      <span className={s.errors > 0 ? 'text-red-600 dark:text-red-400' : ''}>{s.errors}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{fmt(s.inputTokens)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{fmt(s.outputTokens)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{fmtMs(s.avgLatencyMs)}</td>
                    <td className="px-4 py-2.5 text-right whitespace-nowrap text-foreground/50">{s.lastUsedAt ? formatRelative(s.lastUsedAt) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ── Actividad reciente ───────────────────────────────────────────────────── */
function ActivityCard({
  usage,
  page,
  onPage,
}: {
  usage: Paginated<AiUsageRow> | null;
  page: number;
  onPage: (p: number) => void;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle className="text-base">Actividad reciente de IA</CardTitle>
        {usage ? (
          <span className="text-xs text-foreground/50">
            {usage.meta.total} registros · página {usage.meta.page} de {usage.meta.totalPages}
          </span>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4 p-0 sm:p-6">
        {!usage ? (
          <div className="space-y-2 px-4 sm:px-0">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        ) : usage.data.length === 0 ? (
          <p className="px-4 pb-4 text-sm text-foreground/50 sm:px-0">Sin actividad todavía.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-foreground/50">
                    <th className="px-4 py-2 font-medium sm:pl-0">Fecha</th>
                    <th className="px-4 py-2 font-medium">Función</th>
                    <th className="px-4 py-2 font-medium">Proveedor</th>
                    <th className="px-4 py-2 font-medium">Modelo</th>
                    <th className="px-4 py-2 text-right font-medium">In</th>
                    <th className="px-4 py-2 text-right font-medium">Out</th>
                    <th className="px-4 py-2 text-right font-medium">Latencia</th>
                    <th className="px-4 py-2 text-right font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {usage.data.map((r) => (
                    <tr key={r.id}>
                      <td className="whitespace-nowrap px-4 py-2.5 text-foreground/50 sm:pl-0">{formatRelative(r.createdAt)}</td>
                      <td className="px-4 py-2.5">{FEATURE_LABELS[r.feature] ?? r.feature}</td>
                      <td className="px-4 py-2.5">{PROVIDER_LABELS[r.provider] ?? r.provider}</td>
                      <td className="px-4 py-2.5 font-medium">{r.model}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{fmt(r.inputTokens)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{fmt(r.outputTokens)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{fmtMs(r.latencyMs)}</td>
                      <td className="px-4 py-2.5 text-right">
                        {r.status === 'SUCCESS' ? (
                          <CircleCheck className="ml-auto size-4 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <span className="inline-flex items-center justify-end gap-1 text-right text-red-600 dark:text-red-400">
                            <CircleX className="size-4" />
                            {r.errorMessage ? (r.errorMessage.split('\n')[0] ?? '').slice(0, 60) : 'ERROR'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {usage.meta.totalPages > 1 ? (
              <div className="flex items-center justify-between px-4 sm:px-0">
                <Button variant="outline" size="sm" disabled={!usage.meta.hasPrev} onClick={() => onPage(page - 1)}>
                  Anterior
                </Button>
                <Button variant="outline" size="sm" disabled={!usage.meta.hasNext} onClick={() => onPage(page + 1)}>
                  Siguiente
                </Button>
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}