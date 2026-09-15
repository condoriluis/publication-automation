'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Sparkles, Loader2, Bot, ArrowRight, ChevronDown, ChevronUp, Cpu, RefreshCw, CheckCircle2 } from 'lucide-react';

import { api } from '@/lib/api';
import type { CommentAnalysisResult, CommentClassification, Paginated, PageListRow, CommentDetail } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StatusBadge } from '@/components/status-badge';
import { EmptyState } from '@/components/empty-state';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { formatRelative } from '@/lib/utils';

const CLASSIFICATION_LABELS: Record<CommentClassification, { label: string; className: string }> = {
  INSULTO: { label: 'Insulto', className: '!bg-red-500/10 !text-red-600 dark:!text-red-400' },
  PREGUNTA: { label: 'Pregunta', className: '!bg-sky-500/10 !text-sky-600 dark:!text-sky-400' },
  SPAM: { label: 'Spam', className: '!bg-orange-500/10 !text-orange-600 dark:!text-orange-400' },
  NORMAL: { label: 'Normal', className: '!bg-emerald-500/10 !text-emerald-600 dark:!text-emerald-400' },
  OPORTUNIDAD: { label: 'Oportunidad', className: '!bg-violet-500/10 !text-violet-600 dark:!text-violet-400' },
};

export default function AiPage() {
  const router = useRouter();
  const [pages, setPages] = useState<Paginated<PageListRow> | null>(null);
  const [genForm, setGenForm] = useState({ pageId: '', theme: '', audience: '', tone: 'amigable', length: 'medium' as 'short' | 'medium' | 'long' });
  const [generating, setGenerating] = useState(false);
  const [generatedText, setGeneratedText] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [aiStatus, setAiStatus] = useState<{ provider: string; model: string; configured: boolean } | null>(null);

  const [pending, setPending] = useState<Paginated<CommentDetail> | null>(null);
  const [pendingPage, setPendingPage] = useState('all');
  const [analyzing, setAnalyzing] = useState(false);
  const [results, setResults] = useState<CommentAnalysisResult[]>([]);

  useEffect(() => {
    api.get<{ provider: string; model: string; configured: boolean }>('/ai/status')
      .then(setAiStatus)
      .catch(() => { });
  }, []);

  useEffect(() => {
    api.get<Paginated<PageListRow>>('/pages?page=1&limit=100').then((p) => {
      setPages(p);
      const first = p.data[0];
      if (first) setGenForm((f) => ({ ...f, pageId: f.pageId || first.id }));
    }).catch(() => { });
  }, []);

  const loadPending = useCallback(async () => {
    const q = pendingPage === 'all' ? '' : `&pageId=${pendingPage}`;
    try {
      const data = await api.get<Paginated<CommentDetail>>(`/comments?needsAnalysis=true&limit=100${q}`);
      setPending(data);
    } catch { /* ignore */ }
  }, [pendingPage]);

  useEffect(() => { void loadPending(); }, [loadPending]);

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    setGenerating(true);
    try {
      const res = await api.post<{ success: boolean; text: string }>('/ai/generate-post', genForm);
      setGeneratedText(res.text);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al generar');
    } finally {
      setGenerating(false);
    }
  }

  async function analyzeAll(e: React.FormEvent) {
    e.preventDefault();
    setAnalyzing(true);
    try {
      const payload = pendingPage === 'all' ? {} : { pageId: pendingPage };
      const res = await api.post<{ success: boolean; requested: number; analyzed: CommentAnalysisResult[] }>('/ai/analyze-pending-comments', payload);
      setResults(res.analyzed);
      if (res.analyzed.length > 0) {
        toast.success(`Analizados ${res.analyzed.length} comentario${res.analyzed.length === 1 ? '' : 's'}`);
      } else {
        toast.info('No hay comentarios pendientes de análisis');
      }
      void loadPending();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al analizar');
    } finally {
      setAnalyzing(false);
    }
  }

  const pendingCount = pending?.data.length ?? 0;

  return (
    <div className="space-y-4">
      <PageHeader title="Inteligencia" subtitle="Genera contenido y analiza comentarios con IA">
        {aiStatus && (
          <span className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium ${aiStatus.configured
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              : 'border-destructive/30 bg-destructive/10 text-destructive'
            }`}>
            <Cpu className="size-3" />
            {aiStatus.configured ? (
              <><span className="capitalize">{aiStatus.provider}</span> · <span className="font-mono text-[11px]">{aiStatus.model}</span></>
            ) : 'IA no configurada'}
          </span>
        )}
      </PageHeader>

      <Tabs defaultValue="generate">
        <TabsList>
          <TabsTrigger value="generate"><Sparkles className="mr-1 size-3.5" /> Generar publicación</TabsTrigger>
          <TabsTrigger value="analyze">
            <Bot className="mr-1 size-3.5" /> Analizar comentarios
            {pendingCount > 0 && (
              <span className="ml-1.5 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                {pendingCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="generate">
          <Card>
            <form onSubmit={generate}>
              <CardHeader><CardTitle className="text-base">Generar texto para publicación</CardTitle></CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Página</Label>
                  <Select value={genForm.pageId} onValueChange={(val) => setGenForm({ ...genForm, pageId: val })} required>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecciona una página" />
                    </SelectTrigger>
                    <SelectContent>
                      {pages?.data.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Tema / instrucción <span className="text-foreground/40 font-normal text-xs">(la IA decidirá el tono y la extensión)</span></Label>
                  <Textarea rows={3} value={genForm.theme} onChange={(e) => setGenForm({ ...genForm, theme: e.target.value })} required placeholder="Ej. Promoción de fin de semana con 20% off en todos los servicios" />
                </div>

                <div className="sm:col-span-2">
                  <button
                    type="button"
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => setShowAdvanced((v) => !v)}
                  >
                    {showAdvanced ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                    Opciones avanzadas (tono, extensión, público)
                  </button>
                </div>

                {showAdvanced && (
                  <>
                    <div className="space-y-2">
                      <Label>Tono</Label>
                      <Select value={genForm.tone} onValueChange={(val) => setGenForm({ ...genForm, tone: val })}>
                        <SelectTrigger className="w-full"><SelectValue placeholder="Selecciona un tono" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="amigable">Amigable</SelectItem>
                          <SelectItem value="formal">Formal</SelectItem>
                          <SelectItem value="breve">Breve</SelectItem>
                          <SelectItem value="neutral">Neutral</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Extensión</Label>
                      <Select value={genForm.length} onValueChange={(val) => setGenForm({ ...genForm, length: val as 'short' | 'medium' | 'long' })}>
                        <SelectTrigger className="w-full"><SelectValue placeholder="Extensión" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="short">Corto</SelectItem>
                          <SelectItem value="medium">Medio</SelectItem>
                          <SelectItem value="long">Largo</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label>Público objetivo</Label>
                      <Input value={genForm.audience} onChange={(e) => setGenForm({ ...genForm, audience: e.target.value })} placeholder="Ej. emprendedores jóvenes" />
                    </div>
                  </>
                )}
              </CardContent>
              <CardFooter className="flex flex-wrap items-center gap-2">
                <Button type="submit" disabled={generating}>
                  {generating ? <Loader2 className="animate-spin" /> : <Sparkles className="size-4" />}
                  {generating ? 'Generando…' : 'Generar texto'}
                </Button>
                {generatedText ? (
                  <>
                    <Button type="button" variant="outline" onClick={() => { void navigator.clipboard.writeText(generatedText); toast.success('Texto copiado'); }}>Copiar al portapapeles</Button>
                    <Button type="button" variant="secondary" onClick={() => router.push(`/campaigns/new?content=${encodeURIComponent(generatedText)}`)}>
                      Usar este texto <ArrowRight className="ml-1.5 size-3.5" />
                    </Button>
                  </>
                ) : null}
              </CardFooter>
            </form>
          </Card>

          {generatedText ? (
            <Card>
              <CardHeader><CardTitle className="text-sm">Resultado generado</CardTitle></CardHeader>
              <CardContent>
                <pre className="whitespace-pre-wrap text-sm leading-relaxed">{generatedText}</pre>
              </CardContent>
            </Card>
          ) : null}
        </TabsContent>

        <TabsContent value="analyze">
          <Card>
            <form onSubmit={analyzeAll}>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <span>Analizar comentarios pendientes</span>
                  {pendingCount > 0 && (
                    <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-bold text-amber-600 dark:text-amber-400">
                      {pendingCount} pendiente{pendingCount !== 1 ? 's' : ''}
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-xs text-foreground/50">
                  La IA clasificará automáticamente los comentarios por riesgo, sentimiento, y si requieren acción.
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Filtrar por página</Label>
                    <Select value={pendingPage} onValueChange={(val) => { setPendingPage(val); setResults([]); }}>
                      <SelectTrigger className="w-[220px]"><SelectValue placeholder="Todas las páginas" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas las páginas</SelectItem>
                        {pages?.data.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-2 pt-5">
                    <Button type="submit" disabled={analyzing || pendingCount === 0}>
                      {analyzing ? <Loader2 className="animate-spin" /> : <Bot className="size-4" />}
                      {analyzing ? 'Analizando…' : `Analizar ${pendingCount || ''} pendiente${pendingCount !== 1 ? 's' : ''}`}
                    </Button>
                    <Button type="button" variant="outline" onClick={() => void loadPending()} disabled={analyzing}>
                      <RefreshCw className="size-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </form>
          </Card>

          {results.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-medium text-foreground/60">
                <CheckCircle2 className="inline-block size-3.5 mr-1 text-emerald-500" />
                {results.length} comentario{results.length !== 1 ? 's' : ''} analizado{results.length !== 1 ? 's' : ''}
              </p>
              {results.map((r) => (
                <Card key={r.commentId} className="overflow-hidden">
                  <div className={`h-1 w-full ${r.riskLevel === 'HIGH' ? 'bg-red-500' :
                      r.riskLevel === 'MEDIUM' ? 'bg-orange-400' :
                        r.riskLevel === 'LOW' ? 'bg-emerald-500' : 'bg-muted'
                    }`} />
                  <CardContent className="pt-4 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge value={r.riskLevel} />
                      {r.classification ? (
                        <span title={`Confianza: ${r.confidence ?? 'n/d'}%`} className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${CLASSIFICATION_LABELS[r.classification].className}`}>
                          {CLASSIFICATION_LABELS[r.classification].label}
                          {typeof r.confidence === 'number' && <span className="ml-1 font-mono text-[9px] text-foreground/40">{r.confidence}%</span>}
                        </span>
                      ) : null}
                      {r.sentiment && (
                        <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground capitalize">
                          {r.sentiment}
                        </span>
                      )}
                      {r.suggestedAction && r.suggestedAction !== 'none' && (
                        <span className="rounded-full border px-2.5 py-0.5 text-[11px] font-medium">
                          Acción sugerida: <strong>{r.suggestedAction}</strong>
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-foreground/80 leading-relaxed border-l-2 border-muted pl-3 italic">"{r.message}"</p>
                    {r.explanation && (
                      <p className="text-xs text-foreground/55">{r.explanation}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {!analyzing && pendingCount === 0 && results.length === 0 && (
            <EmptyState title="Todo analizado" description="No hay comentarios nuevos pendientes de clasificación. Los comentarios entrantes se analizan automáticamente." />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}