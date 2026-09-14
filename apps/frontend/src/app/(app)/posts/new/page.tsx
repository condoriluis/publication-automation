'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2, Sparkles } from 'lucide-react';

import { api } from '@/lib/api';
import type { Campaign, Paginated, PageListRow } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { EmptyState } from '@/components/empty-state';

export default function NewPostPage() {
  const router = useRouter();
  const [pages, setPages] = useState<Paginated<PageListRow> | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [form, setForm] = useState({
    pageId: '',
    campaignId: '',
    content: '',
    imageUrls: '',
    videoUrl: '',
    scheduledFor: '',
    aiGenerated: false,
  });

  useEffect(() => {
    Promise.all([api.get<Paginated<PageListRow>>('/pages?page=1&limit=100'), api.get<Paginated<Campaign>>('/campaigns?page=1&limit=100')])
      .then(([p, c]) => {
        setPages(p);
        setCampaigns(c.data);
        const first = p.data[0];
        if (first) setForm((f) => ({ ...f, pageId: first.id }));
      })
      .catch(() => setPages({ data: [], meta: { page: 1, limit: 100, total: 0, totalPages: 0, hasNext: false, hasPrev: false } }));
  }, []);

  const pageCampaigns = campaigns.filter((c) => c.pageId === form.pageId && ['DRAFT', 'SCHEDULED', 'RUNNING', 'PAUSED'].includes(c.status));

  async function generate() {
    if (!form.pageId) return toast.error('Selecciona una página primero');
    setGenerating(true);
    try {
      const res = await api.post<{ success: boolean; text: string }>('/ai/generate-post', {
        pageId: form.pageId,
        theme: form.content || 'contenido general para la página',
        length: 'medium',
      });
      setForm((f) => ({ ...f, content: res.text, aiGenerated: true }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo generar el contenido');
    } finally {
      setGenerating(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const created = await api.post<{ id: string }>('/posts', {
        pageId: form.pageId,
        campaignId: form.campaignId || undefined,
        content: form.content,
        imageUrls: form.imageUrls.split(',').map((s) => s.trim()).filter(Boolean),
        videoUrl: form.videoUrl.trim() || undefined,
        scheduledFor: form.scheduledFor ? new Date(form.scheduledFor).toISOString() : undefined,
        aiGenerated: form.aiGenerated,
      });
      toast.success('Publicación creada');
      router.push(`/posts/${created.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo crear la publicación');
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Nueva publicación" subtitle="Post individual programado o inmediato">
        <Button type="button" variant="outline" disabled={generating} onClick={() => void generate()}>
          {generating ? <Loader2 className="animate-spin" /> : <Sparkles className="size-4" />}
          {generating ? 'Generando…' : 'Generar con IA'}
        </Button>
      </PageHeader>

      {pages && pages.data.length === 0 ? (
        <EmptyState title="Conecta una página primero" description="Necesitas una página conectada para crear posts." />
      ) : (
        <form onSubmit={submit} className="mx-auto max-w-3xl space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Datos</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Página</Label>
                <select className="w-full rounded-md border bg-transparent px-3 py-2 text-sm" value={form.pageId} onChange={(e) => setForm({ ...form, pageId: e.target.value, campaignId: '' })} required>
                  {pages?.data.map((p) => <option key={p.id} value={p.id}>{p.name}</option>) ?? null}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Campaña (opcional)</Label>
                <select className="w-full rounded-md border bg-transparent px-3 py-2 text-sm" value={form.campaignId} onChange={(e) => setForm({ ...form, campaignId: e.target.value })}>
                  <option value="">Sin campaña</option>
                  {pageCampaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="content">Contenido</Label>
                <Textarea id="content" rows={6} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} required />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="img">URLs de imágenes (separadas por coma, máx. 8)</Label>
                <Input id="img" value={form.imageUrls} onChange={(e) => setForm({ ...form, imageUrls: e.target.value })} placeholder="https://…, https://…" />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="vid">URL de video (opcional)</Label>
                <Input id="vid" value={form.videoUrl} onChange={(e) => setForm({ ...form, videoUrl: e.target.value })} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="sched">Programar para (vacío = borrador)</Label>
                <Input id="sched" type="datetime-local" value={form.scheduledFor} onChange={(e) => setForm({ ...form, scheduledFor: e.target.value })} />
              </div>
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input type="checkbox" className="size-4" checked={form.aiGenerated} onChange={(e) => setForm({ ...form, aiGenerated: e.target.checked })} />
                Marcado como generado por IA
              </label>
            </CardContent>
            <CardFooter>
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? <Loader2 className="animate-spin" /> : null}
                {loading ? 'Creando…' : 'Guardar publicación'}
              </Button>
            </CardFooter>
          </Card>
        </form>
      )}
    </div>
  );
}