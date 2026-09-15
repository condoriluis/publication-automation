'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Plus, Trash2, Loader2, Sparkles } from 'lucide-react';

import { api } from '@/lib/api';
import type { Campaign, CampaignGroupInput, Paginated, PageListRow } from '@/lib/types';
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

interface GroupDraft {
  percentage: string;
  intervalSeconds: string;
  waitAfterSeconds: string;
}

const EMPTY_GROUP: GroupDraft = { percentage: '100', intervalSeconds: '10', waitAfterSeconds: '30' };

export default function NewCampaignPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center"><Loader2 className="mx-auto size-6 animate-spin text-muted-foreground" /></div>}>
      <NewCampaignContent />
    </Suspense>
  );
}

function NewCampaignContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pages, setPages] = useState<Paginated<PageListRow> | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [form, setForm] = useState({
    pageId: '',
    name: '',
    description: '',
    contentTemplate: searchParams.get('content') || '',
    totalActions: '10',
    intervalSeconds: '5',
    groupsWaitSeconds: '1800',
    startAt: '',
    endsAt: '',
    imageUrls: '',
    videoUrl: '',
    aiGenerated: searchParams.has('content'),
  });
  const [groups, setGroups] = useState<GroupDraft[]>([EMPTY_GROUP]);

  useEffect(() => {
    api
      .get<Paginated<PageListRow>>('/pages?page=1&limit=100')
      .then((p) => {
        setPages(p);
        const first = p.data[0];
        if (first) setForm((f) => (f.pageId ? f : { ...f, pageId: first.id }));
      })
      .catch(() => setPages({ data: [], meta: { page: 1, limit: 100, total: 0, totalPages: 0, hasNext: false, hasPrev: false } }));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const payloadGroups: CampaignGroupInput[] = groups
      .map((g) => ({
        percentage: Number(g.percentage),
        intervalSeconds: Number(g.intervalSeconds),
        waitAfterSeconds: g.waitAfterSeconds !== '' ? Number(g.waitAfterSeconds) : 0,
      }))
      .filter((g) => g.percentage > 0);

    if (payloadGroups.length === 0) return toast.error('Agrega al menos un grupo con porcentaje');
    if (payloadGroups.reduce((a, g) => a + g.percentage, 0) !== 100) {
      return toast.error('La suma de porcentajes debe ser 100');
    }
    if (!form.startAt) return toast.error('Indica la fecha de inicio');

    setLoading(true);
    try {
      const created = await api.post<Campaign>('/campaigns', {
        pageId: form.pageId,
        name: form.name,
        description: form.description || undefined,
        contentTemplate: form.contentTemplate,
        groups: payloadGroups,
        totalActions: Number(form.totalActions),
        intervalSeconds: Number(form.intervalSeconds),
        groupsWaitSeconds: Number(form.groupsWaitSeconds),
        startAt: new Date(form.startAt).toISOString(),
        endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : undefined,
        imageUrls: form.imageUrls ? form.imageUrls.split(',').map((u) => u.trim()) : undefined,
        videoUrl: form.videoUrl || undefined,
        aiGenerated: form.aiGenerated,
      });
      toast.success('Campaña creada');
      router.push(`/campaigns/${created.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo crear la campaña');
      setLoading(false);
    }
  }

  async function autocompleteWithAI() {
    if (!form.pageId) return toast.error('Selecciona una página primero');
    if (!form.name || form.name.length < 3) return toast.error('Escribe al menos 3 caracteres en el título');
    setGenerating(true);
    try {
      const { config } = await api.post<{ success: boolean; config: { description: string; contentTemplate: string; intervalSeconds: number } }>('/ai/generate-campaign', {
        pageId: form.pageId,
        title: form.name,
      });
      setForm((f) => ({
        ...f,
        description: config.description || f.description,
        contentTemplate: config.contentTemplate || f.contentTemplate,
        intervalSeconds: config.intervalSeconds ? String(config.intervalSeconds) : f.intervalSeconds,
        aiGenerated: true,
      }));
      toast.success('✨ IA completó la campaña automáticamente');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al generar la campaña');
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Nueva campaña" subtitle="Distribución de acciones por grupos automáticos" />
      {pages && pages.data.length === 0 ? (
        <EmptyState title="Conecta una página primero" description="Necesitas una página conectada para crear campañas." />
      ) : (
        <form onSubmit={submit} className="mx-auto max-w-3xl space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Configuración</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label>Página</Label>
                <Select value={form.pageId} onValueChange={(val) => setForm({ ...form, pageId: val })} required>
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
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="name">Título (Tema)</Label>
                <div className="flex gap-2">
                  <Input id="name" minLength={3} maxLength={120} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej. Promoción de Invierno" className="flex-1" required />
                  <Button type="button" variant="secondary" onClick={autocompleteWithAI} disabled={generating || !form.name}>
                    {generating ? <Loader2 className="animate-spin size-4 mr-2" /> : <Sparkles className="size-4 mr-2 text-[#1877F2]" />}
                    {generating ? 'Generando...' : 'Autocompletar'}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Escribe de qué trata y dale a Autocompletar para que la IA llene el resto.</p>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="desc">Descripción (opcional)</Label>
                <Textarea id="desc" rows={2} maxLength={500} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="content">Contenido base del post</Label>
                <Textarea id="content" rows={4} value={form.contentTemplate} onChange={(e) => setForm({ ...form, contentTemplate: e.target.value })} required />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="img">URLs de imágenes (separadas por coma, máx. 8)</Label>
                <Input id="img" value={form.imageUrls} onChange={(e) => setForm({ ...form, imageUrls: e.target.value })} placeholder="https://…, https://…" />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="vid">URL de video (opcional)</Label>
                <Input id="vid" value={form.videoUrl} onChange={(e) => setForm({ ...form, videoUrl: e.target.value })} />
              </div>
              <Field label="Número de publicaciones" hint="Máx. 10.000">
                <Input type="number" min={1} max={10000} value={form.totalActions} onChange={(e) => setForm({ ...form, totalActions: e.target.value })} required />
              </Field>
              <Field label="Intervalo (seg)" hint="Espera entre posts">
                <Input type="number" min={1} max={3600} value={form.intervalSeconds} onChange={(e) => setForm({ ...form, intervalSeconds: e.target.value })} required />
              </Field>
              <Field label="Pausa grupos (seg)" hint="Descanso entre grupos">
                <Input type="number" min={0} max={604800} value={form.groupsWaitSeconds} onChange={(e) => setForm({ ...form, groupsWaitSeconds: e.target.value })} required />
              </Field>
              <Field label="Inicio">
                <DateTimePicker value={form.startAt} onChange={(val) => setForm({ ...form, startAt: val })} />
              </Field>
              <Field label="Fin (opcional)">
                <DateTimePicker value={form.endsAt} onChange={(val) => setForm({ ...form, endsAt: val })} />
              </Field>
              <div className="flex items-center space-x-2 sm:col-span-2 mt-2">
                <Checkbox id="aiGenerated" checked={form.aiGenerated} onCheckedChange={(checked) => setForm({ ...form, aiGenerated: checked === true })} />
                <Label htmlFor="aiGenerated" className="text-sm font-normal cursor-pointer">
                  Contenido generado por IA
                </Label>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Grupos</CardTitle>
              <Button type="button" size="sm" variant="outline" onClick={() => setGroups([...groups, EMPTY_GROUP])}>
                <Plus className="size-4" /> Agregar grupo
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              {groups.map((g, i) => (
                <div key={i} className="relative rounded-lg border p-4 pt-5">
                  <span className="absolute -top-2.5 left-3 bg-card px-1 text-xs font-semibold text-muted-foreground">Grupo {i + 1}</span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <Field label="% del total" hint={groups.length > 1 ? 'Suma debe ser 100' : '100 = todo'}>
                      <Input type="number" min={1} max={100} value={g.percentage} placeholder="100" onChange={(e) => updateGroup(i, { percentage: e.target.value })} required />
                    </Field>
                    <Field label="Intervalo (s)" hint="Pausa entre posts">
                      <Input type="number" min={1} max={3600} value={g.intervalSeconds} onChange={(e) => updateGroup(i, { intervalSeconds: e.target.value })} required />
                    </Field>
                    <Field label="Descanso (s)" hint="Pausa tras grupo">
                      <Input type="number" min={0} value={g.waitAfterSeconds} onChange={(e) => updateGroup(i, { waitAfterSeconds: e.target.value })} />
                    </Field>
                  </div>
                  {groups.length > 1 ? (
                    <Button type="button" size="icon" variant="ghost" className="absolute top-1 right-1 size-7 text-muted-foreground hover:text-destructive" onClick={() => setGroups(groups.filter((_, j) => j !== i))}>
                      <Trash2 className="size-4" />
                    </Button>
                  ) : null}
                </div>
              ))}
            </CardContent>
            <CardFooter>
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? <Loader2 className="animate-spin" /> : null}
                {loading ? 'Creando…' : 'Crear campaña'}
              </Button>
            </CardFooter>
          </Card>
        </form>
      )}
    </div>
  );

  function updateGroup(i: number, patch: Partial<GroupDraft>) {
    setGroups(groups.map((g, j) => (j === i ? { ...g, ...patch } : g)));
  }
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label className="text-xs text-foreground/70">
        {label}
        {hint ? <span className="ml-1 text-foreground/40">({hint})</span> : null}
      </Label>
      {children}
    </div>
  );
}