'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Sparkles, Loader2, Bot } from 'lucide-react';

import { api } from '@/lib/api';
import type { CommentAnalysisResult, Paginated, PageListRow } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { StatusBadge } from '@/components/status-badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

export default function AiPage() {
  const [pages, setPages] = useState<Paginated<PageListRow> | null>(null);
  const [genForm, setGenForm] = useState({ pageId: '', theme: '', audience: '', tone: 'amigable', length: 'medium' as 'short' | 'medium' | 'long' });
  const [generating, setGenerating] = useState(false);
  const [generatedText, setGeneratedText] = useState('');

  const [commentIds, setCommentIds] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [results, setResults] = useState<CommentAnalysisResult[]>([]);

  useEffect(() => {
    api.get<Paginated<PageListRow>>('/pages?page=1&limit=100').then((p) => {
      setPages(p);
      const first = p.data[0];
      if (first) setGenForm((f) => ({ ...f, pageId: f.pageId || first.id }));
    }).catch(() => {});
  }, []);

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

  async function analyze(e: React.FormEvent) {
    e.preventDefault();
    const ids = commentIds.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
    if (!ids.length) return toast.error('Ingresa al menos un ID de comentario');
    setAnalyzing(true);
    try {
      const res = await api.post<{ success: boolean; results: CommentAnalysisResult[] }>('/ai/analyze-comments', { commentIds: ids });
      setResults(res.results);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error al analizar');
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Inteligencia" subtitle="Genera contenido y analiza comentarios con IA" />

      <Tabs defaultValue="generate">
        <TabsList>
          <TabsTrigger value="generate"><Sparkles className="mr-1 size-3.5" /> Generar publicación</TabsTrigger>
          <TabsTrigger value="analyze"><Bot className="mr-1 size-3.5" /> Analizar comentarios</TabsTrigger>
        </TabsList>

        <TabsContent value="generate">
          <Card>
            <form onSubmit={generate}>
              <CardHeader><CardTitle className="text-base">Generar texto para publicación</CardTitle></CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Página</Label>
                  <select className="w-full rounded-md border bg-transparent px-3 py-2 text-sm" value={genForm.pageId} onChange={(e) => setGenForm({ ...genForm, pageId: e.target.value })} required>
                    {pages?.data.map((p) => <option key={p.id} value={p.id}>{p.name}</option>) ?? null}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Tono</Label>
                  <select className="w-full rounded-md border bg-transparent px-3 py-2 text-sm" value={genForm.tone} onChange={(e) => setGenForm({ ...genForm, tone: e.target.value })}>
                    <option value="amigable">Amigable</option>
                    <option value="formal">Formal</option>
                    <option value="breve">Breve</option>
                    <option value="neutral">Neutral</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Extensión</Label>
                  <select className="w-full rounded-md border bg-transparent px-3 py-2 text-sm" value={genForm.length} onChange={(e) => setGenForm({ ...genForm, length: e.target.value as 'short' | 'medium' | 'long' })}>
                    <option value="short">Corto</option>
                    <option value="medium">Medio</option>
                    <option value="long">Largo</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Público objetivo</Label>
                  <Input value={genForm.audience} onChange={(e) => setGenForm({ ...genForm, audience: e.target.value })} placeholder="Ej. emprendedores jóvenes" />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Tema / instrucción</Label>
                  <Textarea rows={3} value={genForm.theme} onChange={(e) => setGenForm({ ...genForm, theme: e.target.value })} required placeholder="Describe el tema que quieres que aborde el post" />
                </div>
              </CardContent>
              <CardFooter className="flex flex-wrap items-center gap-2">
                <Button type="submit" disabled={generating}>
                  {generating ? <Loader2 className="animate-spin" /> : <Sparkles className="size-4" />}
                  {generating ? 'Generando…' : 'Generar texto'}
                </Button>
                {generatedText ? (
                  <Button type="button" variant="outline" onClick={() => { void navigator.clipboard.writeText(generatedText); toast.success('Texto copiado'); }}>Copiar al portapapeles</Button>
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
            <form onSubmit={analyze}>
              <CardHeader><CardTitle className="text-base">Análisis de riesgo de comentarios</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <Label>IDs de comentarios (separados por coma o espacio)</Label>
                <Textarea rows={3} value={commentIds} onChange={(e) => setCommentIds(e.target.value)} required placeholder="clshd1x2, clyxz..." />
              </CardContent>
              <CardFooter>
                <Button type="submit" disabled={analyzing}>
                  {analyzing ? <Loader2 className="animate-spin" /> : <Bot className="size-4" />}
                  {analyzing ? 'Analizando…' : 'Analizar'}
                </Button>
              </CardFooter>
            </form>
          </Card>

          {results.length > 0 ? (
            <Card>
              <ul className="divide-y">
                {results.map((r) => (
                  <li key={r.commentId} className="flex items-start gap-3 p-4">
                    <StatusBadge value={r.riskLevel} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">{r.message}</p>
                      {r.explanation ? <p className="mt-1 text-xs text-foreground/60">{r.explanation}</p> : null}
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}