'use client';

import * as React from 'react';
import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { Reply, Bot, EyeOff, Eye, Trash2, MessageSquareOff, Loader2, Sparkles, X } from 'lucide-react';

import { api } from '@/lib/api';
import type { Paginated, CommentDetail, RiskLevel, CommentStatus, CommentClassification } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { EmptyState } from '@/components/empty-state';
import { LoadingRows, Pagination } from '@/components/pagination';
import { formatRelative } from '@/lib/utils';

const RISKS: (RiskLevel | '')[] = ['', 'NONE', 'LOW', 'MEDIUM', 'HIGH'];
const STATUSES: (CommentStatus | '')[] = ['', 'VISIBLE', 'HIDDEN', 'RESPONDED', 'DELETED'];
const CLASSIFICATIONS: (CommentClassification | '')[] = ['', 'INSULTO', 'PREGUNTA', 'SPAM', 'NORMAL', 'OPORTUNIDAD'];

const CLASSIFICATION_LABELS: Record<CommentClassification, { label: string; className: string }> = {
  INSULTO: { label: 'Insulto', className: '!bg-red-500/10 !text-red-600 dark:!text-red-400' },
  PREGUNTA: { label: 'Pregunta', className: '!bg-sky-500/10 !text-sky-600 dark:!text-sky-400' },
  SPAM: { label: 'Spam', className: '!bg-orange-500/10 !text-orange-600 dark:!text-orange-400' },
  NORMAL: { label: 'Normal', className: '!bg-emerald-500/10 !text-emerald-600 dark:!text-emerald-400' },
  OPORTUNIDAD: { label: 'Oportunidad', className: '!bg-violet-500/10 !text-violet-600 dark:!text-violet-400' },
};

const STATUS_LABELS: Record<CommentStatus, { label: string; className: string }> = {
  VISIBLE: { label: 'Visible', className: '!bg-emerald-500/10 !text-emerald-600 dark:!text-emerald-400' },
  HIDDEN: { label: 'Oculto', className: '!bg-amber-500/10 !text-amber-600 dark:!text-amber-400' },
  RESPONDED: { label: 'Respondido', className: '!bg-sky-500/10 !text-sky-600 dark:!text-sky-400' },
  DELETED: { label: 'Eliminado', className: '!bg-destructive/10 !text-destructive' },
};

const RISK_LABELS: Record<RiskLevel, { label: string; className: string }> = {
  NONE: { label: 'Sin riesgo', className: '!bg-emerald-500/10 !text-emerald-600 dark:!text-emerald-400' },
  LOW: { label: 'Riesgo bajo', className: '!bg-amber-500/10 !text-amber-600 dark:!text-amber-400' },
  MEDIUM: { label: 'Riesgo medio', className: '!bg-orange-500/10 !text-orange-600 dark:!text-orange-400' },
  HIGH: { label: 'Riesgo alto', className: '!bg-destructive/10 !text-destructive' },
};

export default function CommentsPage() {
  return (
    <React.Suspense fallback={<LoadingRows rows={4} />}>
      <CommentsContent />
    </React.Suspense>
  );
}

function CommentsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [data, setData] = useState<Paginated<CommentDetail> | null>(null);
  const [page, setPage] = useState(1);
  const [risk, setRisk] = useState('');
  const [status, setStatus] = useState('');
  const [classification, setClassification] = useState('');
  const [onlyModeration, setOnlyModeration] = useState(false);
  const [onlyReview, setOnlyReview] = useState(false);
  const [postId, setPostId] = useState<string | null>(searchParams.get('postId'));
  const [replyId, setReplyId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [suggesting, setSuggesting] = useState<string | null>(null);

  const buildQuery = useCallback(
    () => `/comments?page=${page}&limit=10${risk ? `&riskLevel=${risk}` : ''}${status ? `&status=${status}` : ''}${classification ? `&classification=${classification}` : ''}${onlyReview ? '&needsReview=true' : ''}${onlyModeration ? '&needsModeration=true' : ''}${postId ? `&postId=${postId}` : ''}`,
    [page, risk, status, classification, onlyModeration, onlyReview, postId],
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
        <span className="ml-2 mr-1 text-xs font-medium text-foreground/50">Clasificación:</span>
        {CLASSIFICATIONS.map((cl, i) => (
          <Button key={cl || `cl${i}`} size="sm" variant={classification === cl ? 'default' : 'outline'} onClick={() => { setClassification(cl); setPage(1); }}>{cl || 'Todas'}</Button>
        ))}
        <Button size="sm" variant={onlyModeration ? 'default' : 'outline'} onClick={() => { setOnlyModeration(!onlyModeration); setPage(1); }}>
          Solo moderación
        </Button>
        <Button size="sm" variant={onlyReview ? 'default' : 'outline'} onClick={() => { setOnlyReview(!onlyReview); setPage(1); }}>
          Solo revisión
        </Button>
        {postId ? (
          <Button
            size="sm"
            variant="secondary"
            className="gap-1"
            onClick={() => { setPostId(null); router.replace('/comments'); setPage(1); }}
          >
            Publicación {postId.slice(0, 8)}…
            <X className="size-3" />
          </Button>
        ) : null}
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
                  <div className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {(c.fromName ?? '?').slice(0, 2).toUpperCase()}
                  </div>
                  <span className="text-sm font-medium">{c.fromName ?? 'Anónimo'}</span>
                  <span className="text-xs text-foreground/50">·</span>
                  <span className="text-xs text-foreground/50">{formatRelative(c.createdAt)}</span>
                  <div className="ml-auto flex flex-wrap items-center gap-1.5">
                    {c.classification ? (
                      <span title={`Confianza: ${c.confidence ?? 'n/d'}%`} className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${CLASSIFICATION_LABELS[c.classification].className}`}>
                        {CLASSIFICATION_LABELS[c.classification].label}
                        {typeof c.confidence === 'number' && <span className="ml-1 font-mono text-[9px] opacity-60">{c.confidence}%</span>}
                      </span>
                    ) : null}
                    {STATUS_LABELS[c.status] ? (
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_LABELS[c.status].className}`}>
                        {STATUS_LABELS[c.status].label}
                      </span>
                    ) : null}
                    {RISK_LABELS[c.riskLevel] ? (
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${RISK_LABELS[c.riskLevel].className}`}>
                        {RISK_LABELS[c.riskLevel].label}
                      </span>
                    ) : null}
                    {c.needsReview && (
                      <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                        Revisar
                      </span>
                    )}
                  </div>
                </div>
                <p className="break-words whitespace-pre-wrap text-sm leading-relaxed">{c.message || <span className="text-foreground/40">(sin texto)</span>}</p>
                <p className="flex flex-wrap items-center gap-1.5 text-xs text-foreground/50">
                  <span className="font-medium text-foreground/70">{c.page?.name ?? 'Página'}</span>
                  <span>·</span>
                  <Link href={`/posts/${c.post?.id}`} className="min-w-0 truncate text-[#1877F2] hover:underline">
                    {c.post?.content.slice(0, 60) ?? 'Ver publicación'}
                  </Link>
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
                          <p className="break-words text-xs text-foreground/70">{r.message || '(sin texto)'}</p>
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