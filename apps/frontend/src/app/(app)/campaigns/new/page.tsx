'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus, Trash2, Loader2 } from 'lucide-react';

import { api } from '@/lib/api';
import type { Campaign, CampaignGroupInput, Paginated, PageListRow } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { EmptyState } from '@/components/empty-state';

interface GroupDraft {
  percentage: string;
  intervalSeconds: string;
  waitAfterSeconds: string;
}

const EMPTY_GROUP: GroupDraft = { percentage: '', intervalSeconds: '10', waitAfterSeconds: '30' };

export default function NewCampaignPage() {
  const router = useRouter();
  const [pages, setPages] = useState<Paginated<PageListRow> | null>(null);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    pageId: '',
    name: '',
    description: '',
    contentTemplate: '',
    totalActions: '10',
    intervalSeconds: '5',
    groupsWaitSeconds: '1800',
    startAt: '',
    endsAt: '',
    aiGenerated: false,
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
        aiGenerated: form.aiGenerated,
      });
      toast.success('Campaña creada');
      router.push(`/campaigns/${created.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo crear la campaña');
      setLoading(false);
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
                <select
                  className="w-full rounded-md border bg-transparent px-3 py-2 text-sm"
                  value={form.pageId}
                  onChange={(e) => setForm({ ...form, pageId: e.target.value })}
                  required
                >
                  {pages?.data.map((p) => <option key={p.id} value={p.id}>{p.name}</option>) ?? null}
                </select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="name">Título</Label>
                <Input id="name" minLength={3} maxLength={120} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="desc">Descripción (opcional)</Label>
                <Textarea id="desc" rows={2} maxLength={500} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="content">Contenido base del post</Label>
                <Textarea id="content" rows={4} value={form.contentTemplate} onChange={(e) => setForm({ ...form, contentTemplate: e.target.value })} required />
              </div>
              <Field label="Acciones totales" hint="Máx. 10.000">
                <Input type="number" min={1} max={10000} value={form.totalActions} onChange={(e) => setForm({ ...form, totalActions: e.target.value })} required />
              </Field>
              <Field label="Intervalo base (s)">
                <Input type="number" min={1} max={3600} value={form.intervalSeconds} onChange={(e) => setForm({ ...form, intervalSeconds: e.target.value })} required />
              </Field>
              <Field label="Espera entre grupos (s)">
                <Input type="number" min={0} max={604800} value={form.groupsWaitSeconds} onChange={(e) => setForm({ ...form, groupsWaitSeconds: e.target.value })} required />
              </Field>
              <Field label="Inicio">
                <Input type="datetime-local" value={form.startAt} onChange={(e) => setForm({ ...form, startAt: e.target.value })} required />
              </Field>
              <Field label="Fin (opcional)">
                <Input type="datetime-local" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} />
              </Field>
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input type="checkbox" className="size-4" checked={form.aiGenerated} onChange={(e) => setForm({ ...form, aiGenerated: e.target.checked })} />
                Contenido generado por IA
              </label>
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
                <div key={i} className="flex flex-wrap items-end gap-3 rounded-lg border p-3">
                  <span className="text-xs font-medium text-foreground/50">Grupo {i + 1}</span>
                  <Field label="% acciones" hint="Suma = 100">
                    <Input type="number" min={1} max={100} value={g.percentage} onChange={(e) => updateGroup(i, { percentage: e.target.value })} required />
                  </Field>
                  <Field label="Intervalo (s)">
                    <Input type="number" min={1} max={3600} value={g.intervalSeconds} onChange={(e) => updateGroup(i, { intervalSeconds: e.target.value })} required />
                  </Field>
                  <Field label="Espera tras grupo (s)">
                    <Input type="number" min={0} value={g.waitAfterSeconds} onChange={(e) => updateGroup(i, { waitAfterSeconds: e.target.value })} />
                  </Field>
                  {groups.length > 1 ? (
                    <Button type="button" size="sm" variant="ghost" className="ml-auto text-destructive" onClick={() => setGroups(groups.filter((_, j) => j !== i))}>
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