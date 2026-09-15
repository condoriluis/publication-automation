'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Reply, Bot, EyeOff, Eye, Trash2, MessageSquareOff, Loader2, Sparkles } from 'lucide-react';

import { api } from '@/lib/api';
import type { Paginated, CommentDetail, RiskLevel, CommentStatus } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { StatusBadge } from '@/components/status-badge';
import { EmptyState } from '@/components/empty-state';
import { LoadingRows, Pagination } from '@/components/pagination';
import { formatRelative } from '@/lib/utils';

const RISKS: (RiskLevel | '')[] = ['', 'NONE', 'LOW', 'MEDIUM', 'HIGH'];
const STATUSES: (CommentStatus | '')[] = ['', 'VISIBLE', 'HIDDEN', 'RESPONDED', 'DELETED'];

export default function CommentsPage() {
  const [data, setData] = useState<Paginated<CommentDetail> | null>(null);
  const [page, setPage] = useState(1);
  const [risk, setRisk] = useState('');
  const [status, setStatus] = useState('');
  const [onlyModeration, setOnlyModeration] = useState(false);
  const [replyId, setReplyId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [suggesting, setSuggesting] = useState<string | null>(null);

  const buildQuery = useCallback(
    () => `/comments?page=${page}&limit=10${risk ? `&riskLevel=${risk}` : ''}${status ? `&status=${status}` : ''}${onlyModeration ? '&needsModeration=true' : ''}`,
    [page, risk, status, onlyModeration],
  );

  const load = useCallback(async () => {
    api.get<Paginated<CommentDetail>>(buildQuery()).then(setData).catch((e) => setError(e instanceof Error ? e.message : 'No se pudieron cargar los comentarios'));
  }, [buildQuery]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = useCallback(
    async (id: string, actName: string, body?: unknown) => {
      setBusy(`${id}:${actName}`);
      const toastMap: Record<string, string> = {
        'moderate:hide': 'Comentario ocultado',
        'moderate:unhide': 'Comentario visible de nuevo',
        'moderate:delete': 'Comentario eliminado de Facebook',
        'reply': 'Respuesta enviada',
        'auto-reply': 'Respuesta automática enviada por IA',
      };
      const key = actName === 'moderate' ? `moderate:${(body as Record<string,string>)?.action}` : actName;
      try {
        await api.post(`/comments/${id}/${actName}`, body);
        toast.success(toastMap[key] ?? 'Acción ejecutada');
        await load();
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Acción fallida';
        // Facebook 403 = permiso no aprobado en la app de Meta
        const isFbPermission = msg.includes('403') || msg.includes('400') || msg.includes('422') || msg.toLowerCase().includes('permisos insuficientes') || msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('forbidden');
        toast.error(isFbPermission ? msg : msg);
      } finally {
        setBusy(null);
      }
    },
    [load],
  );

  async function sendReply(id: string) {
    await act(id, 'reply', { message: replyText });
    setReplyId(null);
    setReplyText('');
  }

  async function suggestReply(id: string) {
    setSuggesting(id);
    try {
      const res = await api.post<{ success: boolean; reply: string }>('/ai/comment-reply', { commentId: id, tone: 'amigable' });
      setReplyText(res.reply);
      setReplyId(id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Error al sugerir respuesta');
    } finally {
      setSuggesting(null);
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Comentarios" subtitle="Responde y modera los comentarios de tus páginas" />

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs font-medium text-foreground/50">Riesgo:</span>
        {RISKS.map((r, i) => (
          <Button key={r || `r${i}`} size="sm" variant={risk === r ? 'default' : 'outline'} onClick={() => { setRisk(r); setPage(1); }}>{r || 'Todos'}</Button>
        ))}
        <span className="ml-2 mr-1 text-xs font-medium text-foreground/50">Estado:</span>
        {STATUSES.map((s, i) => (
          <Button key={s || `s${i}`} size="sm" variant={status === s ? 'default' : 'outline'} onClick={() => { setStatus(s); setPage(1); }}>{s || 'Todos'}</Button>
        ))}
        <Button size="sm" variant={onlyModeration ? 'default' : 'outline'} onClick={() => { setOnlyModeration(!onlyModeration); setPage(1); }}>
          Solo moderación
        </Button>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {data === null && !error ? (
        <LoadingRows />
      ) : data && data.data.length === 0 ? (
        <EmptyState title="Sin comentarios" description="Sincroniza comentarios desde el detalle de una publicación." />
      ) : data ? (
        <Card>
          <ul className="divide-y">
            {data.data.map((c) => (
              <li key={c.id} className="flex flex-col gap-2 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {(c.fromName ?? '?').slice(0, 2).toUpperCase()}
                  </div>
                  <span className="text-sm font-medium">{c.fromName ?? 'Anónimo'}</span>
                  <span className="text-xs text-foreground/50">{formatRelative(c.createdAt)}</span>
                  <span 
                    className="ml-2 cursor-pointer rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                    title="Clic para copiar ID"
                    onClick={() => {
                      navigator.clipboard.writeText(c.id);
                      toast.success('ID copiado al portapapeles');
                    }}
                  >
                    {c.id}
                  </span>
                  <div className="ml-auto flex items-center gap-1.5">
                    <StatusBadge value={c.status} />
                    <StatusBadge value={c.riskLevel} className="!bg-amber-500/10 !text-amber-600 dark:!text-amber-400" />
                  </div>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{c.message || <span className="text-foreground/40">(sin texto)</span>}</p>
                <p className="text-xs text-foreground/50">
                  {c.page?.name} · {c.post?.content.slice(0, 60) ?? '—'}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => { setReplyId(replyId === c.id ? null : c.id); setReplyText(''); }}>
                    <Reply className="size-3.5" /> Responder
                  </Button>
                  <Button size="sm" variant="outline" disabled={busy !== null || suggesting === c.id} onClick={() => void suggestReply(c.id)}>
                    {suggesting === c.id ? <Loader2 className="animate-spin size-3.5" /> : <Sparkles className="size-3.5 text-[#1877F2]" />} Sugerir (IA)
                  </Button>
                  <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void act(c.id, 'auto-reply', { tone: 'friendly' })}>
                    <Bot className="size-3.5" /> Auto (IA)
                  </Button>
                  {c.isHidden ? (
                    <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void act(c.id, 'moderate', { action: 'unhide' })}>
                      <Eye className="size-3.5" /> Mostrar
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" disabled={busy !== null} onClick={() => void act(c.id, 'moderate', { action: 'hide' })}>
                      <EyeOff className="size-3.5" /> Ocultar
                    </Button>
                  )}
                  <Button size="sm" variant="outline" className="text-destructive" disabled={busy !== null} onClick={() => void act(c.id, 'moderate', { action: 'delete' })}>
                    <Trash2 className="size-3.5" /> Eliminar
                  </Button>
                  {c.replies.length > 0 ? (
                    <span className="ml-auto flex items-center gap-1 text-xs text-foreground/50">
                      <MessageSquareOff className="size-3.5" /> {c.replies.length} respuesta{c.replies.length > 1 ? 's' : ''}
                    </span>
                  ) : null}
                </div>
                {c.replies.length > 0 ? (
                  <div className="space-y-2 rounded-lg bg-muted/40 p-3">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-foreground/40">Respuestas</p>
                    {c.replies.map((r) => (
                      <div key={r.id} className="flex items-start gap-2">
                        <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#1877F2]/10 text-[10px] font-bold text-[#1877F2]">
                          {(r.fromName ?? 'P').slice(0, 1).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="text-xs font-semibold">{r.fromName ?? 'Página'}</span>
                          {r.isFromPage && (
                            <span className="ml-1.5 rounded bg-[#1877F2]/10 px-1.5 py-0.5 text-[10px] font-medium text-[#1877F2]">
                              Página
                            </span>
                          )}
                          <p className="text-xs text-foreground/70">{r.message || '(sin texto)'}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
                {replyId === c.id ? (
                  <div className="flex gap-2">
                    <Textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder="Escribe tu respuesta…" rows={2} className="flex-1" />
                    <Button size="sm" disabled={busy !== null || !replyText.trim()} onClick={() => void sendReply(c.id)}>
                      {busy ? <Loader2 className="animate-spin" /> : <Reply className="size-3.5" />} Enviar
                    </Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
          <Pagination data={data} onPage={setPage} />
        </Card>
      ) : null}
    </div>
  );
}