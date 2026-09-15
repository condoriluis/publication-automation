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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { DateTimePicker } from '@/components/ui/date-time-picker';
import { EmptyState } from '@/components/empty-state';
import { FacebookPostPreview } from '@/components/facebook-post-preview';

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
        <div className="grid gap-4 lg:grid-cols-[1fr_420px]">
          <form onSubmit={submit} className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Datos</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Página</Label>
                <Select value={form.pageId} onValueChange={(val) => setForm({ ...form, pageId: val, campaignId: '' })} required>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecciona una página" />
                  </SelectTrigger>
                  <SelectContent>
                    {pages?.data.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Campaña (opcional)</Label>
                <Select value={form.campaignId} onValueChange={(val) => setForm({ ...form, campaignId: val === 'none' ? '' : val })}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Sin campaña" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin campaña</SelectItem>
                    {pageCampaigns.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="content">Contenido</Label>
                <Textarea id="content" rows={6} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} required />
                <p className="text-[11px] text-muted-foreground">
                  <strong>Tip IA:</strong> Escribe un tema específico (ej. "Agentes de IA") para guiar a la IA. Si lo dejas en blanco y haces clic en "Generar con IA", se creará un post general basado en la categoría de tu página.
                </p>
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
                <DateTimePicker value={form.scheduledFor} onChange={(val) => setForm({ ...form, scheduledFor: val })} />
              </div>
              <div className="flex items-center space-x-2 sm:col-span-2 mt-2">
                <Checkbox id="aiGenerated" checked={form.aiGenerated} onCheckedChange={(checked) => setForm({ ...form, aiGenerated: checked === true })} />
                <Label htmlFor="aiGenerated" className="text-sm font-normal cursor-pointer">
                  Marcado como generado por IA
                </Label>
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? <Loader2 className="animate-spin" /> : null}
                {loading ? 'Creando…' : 'Guardar publicación'}
              </Button>
            </CardFooter>
          </Card>
          </form>

          <div className="lg:sticky lg:top-20 lg:self-start space-y-3">
            <p className="text-xs font-medium uppercase tracking-wide text-foreground/50">Vista previa</p>
            <FacebookPostPreview
              pageName={pages?.data.find((p) => p.id === form.pageId)?.name ?? 'Página'}
              pagePicture={pages?.data.find((p) => p.id === form.pageId)?.pictureUrl ?? null}
              content={form.content}
              imageUrls={form.imageUrls.split(',').map((s) => s.trim()).filter(Boolean)}
              videoUrl={form.videoUrl.trim() || null}
              timeLabel={form.scheduledFor ? `Programada para ${new Date(form.scheduledFor).toLocaleString('es')}` : 'Borrador'}
            />
          </div>
        </div>
      )}
    </div>
  );
}