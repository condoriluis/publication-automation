'use client';

import * as React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { Reply, Bot, EyeOff, Eye, Trash2, MessageSquareOff, Loader2, Sparkles, X } from 'lucide-react';
import { type ColumnDef, type Row } from '@tanstack/react-table';

import { api } from '@/lib/api';
import type { Paginated, CommentDetail, RiskLevel, CommentStatus, CommentClassification } from '@/lib/types';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { EmptyState } from '@/components/empty-state';
import { LoadingRows } from '@/components/pagination';
import { DataTable } from '@/components/ui/data-table';
import { Message } from '@/components/ui/message';
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

function Chip({ className, title, children }: { className?: string; title?: string; children: React.ReactNode }) {
  return (
    <span title={title} className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${className ?? ''}`}>
      {children}
    </span>
  );
}

const needsModeration = (c: CommentDetail): boolean =>
  c.status === 'VISIBLE' && (c.riskLevel === 'MEDIUM' || c.riskLevel === 'HIGH' || c.needsReview);

function AuthorCell({ comment }: { comment: CommentDetail }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
        {(comment.fromName ?? '?').slice(0, 2).toUpperCase()}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{comment.fromName ?? 'Anónimo'}</p>
        <p className="text-xs text-muted-foreground">{formatRelative(comment.createdAt)}</p>
      </div>
    </div>
  );
}

function PageCell({ comment }: { comment: CommentDetail }) {
  return (
    <div className="min-w-0">
      <p className="max-w-[160px] truncate text-sm font-medium">{comment.page?.name ?? 'Página'}</p>
      <Link href={`/posts/${comment.post?.id}`} className="block max-w-[220px] truncate text-xs text-[#1877F2] hover:underline">
        {comment.post?.content.slice(0, 60) ?? 'Ver publicación'}
      </Link>
    </div>
  );
}

function MetaCell({ comment }: { comment: CommentDetail }) {
  return (
    <div className="flex max-w-[270px] flex-wrap items-center gap-1">
      {STATUS_LABELS[comment.status] ? (
        <Chip className={STATUS_LABELS[comment.status].className}>{STATUS_LABELS[comment.status].label}</Chip>
      ) : null}
      {RISK_LABELS[comment.riskLevel] ? (
        <Chip className={RISK_LABELS[comment.riskLevel].className}>{RISK_LABELS[comment.riskLevel].label}</Chip>
      ) : null}
      {comment.classification ? (
        <Chip className={CLASSIFICATION_LABELS[comment.classification].className}>
          {CLASSIFICATION_LABELS[comment.classification].label}
        </Chip>
      ) : null}
      {comment.needsReview ? (
        <Chip className="!bg-amber-500/10 !text-amber-600 dark:!text-amber-400">Revisar</Chip>
      ) : null}
    </div>
  );
}

const columns: ColumnDef<CommentDetail>[] = [
  {
    accessorKey: 'fromName',
    header: 'Autor',
    cell: ({ row }) => <AuthorCell comment={row.original} />,
  },
  {
    accessorKey: 'message',
    header: 'Comentario',
    cell: ({ row }) => (
      <p className="line-clamp-2 max-w-md whitespace-pre-wrap break-words text-sm text-muted-foreground">
        {row.original.message || <span className="italic">(sin texto)</span>}
      </p>
    ),
  },
  {
    accessorKey: 'page.name',
    header: 'Página',
    cell: ({ row }) => <PageCell comment={row.original} />,
  },
  {
    accessorKey: 'status',
    header: 'Metadatos',
    enableSorting: false,
    cell: ({ row }) => <MetaCell comment={row.original} />,
  },
];

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
  const postId = searchParams.get('postId');
  const [all, setAll] = useState<CommentDetail[] | null>(null);
  const [risk, setRisk] = useState('');
  const [status, setStatus] = useState('');
  const [classification, setClassification] = useState('');
  const [onlyModeration, setOnlyModeration] = useState(false);
  const [onlyReview, setOnlyReview] = useState(false);
  const [replyId, setReplyId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [suggesting, setSuggesting] = useState<string | null>(null);

  const load = useCallback(() => {
    api
      .get<Paginated<CommentDetail>>(`/comments?page=1&limit=100${postId ? `&postId=${postId}` : ''}`)
      .then((res) => setAll(res.data))
      .catch((e) => setError(e instanceof Error ? e.message : 'No se pudieron cargar los comentarios'));
  }, [postId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!all) return [];
    return all.filter((c) => {
      if (risk && c.riskLevel !== risk) return false;
      if (status && c.status !== status) return false;
      if (classification && c.classification !== classification) return false;
      if (onlyReview && !c.needsReview) return false;
      if (onlyModeration && !needsModeration(c)) return false;
      return true;
    });
  }, [all, risk, status, classification, onlyModeration, onlyReview]);

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
      const key = actName === 'moderate' ? `moderate:${(body as Record<string, string>)?.action}` : actName;
      try {
        await api.post(`/comments/${id}/${actName}`, body);
        toast.success(toastMap[key] ?? 'Acción ejecutada');
        await load();
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Acción fallida';
        // Facebook 403 = permiso no aprobado en la app de Meta
        const isFbPermission =
          msg.includes('403') ||
          msg.includes('400') ||
          msg.includes('422') ||
          msg.toLowerCase().includes('permisos insuficientes') ||
          msg.toLowerCase().includes('permission') ||
          msg.toLowerCase().includes('forbidden');
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

  const renderDetail = ({ row }: { row: Row<CommentDetail> }) => {
    const c = row.original;
    return (
      <div className="flex flex-col gap-3 p-4">
        {/* Conversación: comentario del seguidor + respuestas de la página */}
        <div className="space-y-2">
          <Message variant="incoming" author={c.fromName ?? 'Anónimo'} time={formatRelative(c.createdAt)}>
            {c.message || <span className="italic text-foreground/40">(sin texto)</span>}
          </Message>
          {c.replies.map((r) => (
            <Message
              key={r.id}
              variant={r.isFromPage ? 'outgoing' : 'incoming'}
              author={r.fromName ?? (r.isFromPage ? 'Nuestra página' : 'Anónimo')}
              time={formatRelative(r.createdAt)}
              label={r.isFromPage ? 'Página' : undefined}
            >
              {r.message || '(sin texto)'}
            </Message>
          ))}
        </div>

        {/* Contexto: página y publicación de origen */}
        <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
          <span className="font-medium text-foreground/80">{c.page?.name ?? 'Página'}</span>
          <span>·</span>
          <Link href={`/posts/${c.post?.id}`} className="min-w-0 truncate text-[#1877F2] hover:underline">
            {c.post?.content.slice(0, 60) ?? 'Ver publicación'}
          </Link>
        </div>

        {/* Metadatos: estado, riesgo y clasificación */}
        <div className="flex flex-wrap items-center gap-1.5 border-t border-border/60 pt-3">
          {STATUS_LABELS[c.status] ? (
            <Chip className={STATUS_LABELS[c.status].className}>{STATUS_LABELS[c.status].label}</Chip>
          ) : null}
          {RISK_LABELS[c.riskLevel] ? (
            <Chip className={RISK_LABELS[c.riskLevel].className}>{RISK_LABELS[c.riskLevel].label}</Chip>
          ) : null}
          {c.classification ? (
            <Chip
              title={`Confianza: ${c.confidence ?? 'n/d'}%`}
              className={CLASSIFICATION_LABELS[c.classification].className}
            >
              {CLASSIFICATION_LABELS[c.classification].label}
              {typeof c.confidence === 'number' && (
                <span className="ml-1 font-mono text-[9px] opacity-60">{c.confidence}%</span>
              )}
            </Chip>
          ) : null}
          {c.needsReview && (
            <Chip className="!bg-amber-500/10 !text-amber-600 dark:!text-amber-400">Revisar</Chip>
          )}
          {c.replies.length > 0 ? (
            <Chip className="!bg-muted !text-foreground/60">
              <MessageSquareOff className="mr-1 size-3" />
              {c.replies.length} respuesta{c.replies.length > 1 ? 's' : ''}
            </Chip>
          ) : null}
        </div>

        {/* Acciones */}
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
        </div>

        {replyId === c.id ? (
          <div className="flex gap-2">
            <Textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder="Escribe tu respuesta…" rows={2} className="flex-1" />
            <Button size="sm" disabled={busy !== null || !replyText.trim()} onClick={() => void sendReply(c.id)}>
              {busy ? <Loader2 className="animate-spin" /> : <Reply className="size-3.5" />} Enviar
            </Button>
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Comentarios" subtitle="Responde y modera los comentarios de tus páginas" />

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-xs font-medium text-foreground/50">Riesgo:</span>
        {RISKS.map((r, i) => (
          <Button key={r || `r${i}`} size="sm" variant={risk === r ? 'default' : 'outline'} onClick={() => setRisk(r)}>{r || 'Todos'}</Button>
        ))}
        <span className="ml-2 mr-1 text-xs font-medium text-foreground/50">Estado:</span>
        {STATUSES.map((s, i) => (
          <Button key={s || `s${i}`} size="sm" variant={status === s ? 'default' : 'outline'} onClick={() => setStatus(s)}>{s || 'Todos'}</Button>
        ))}
        <span className="ml-2 mr-1 text-xs font-medium text-foreground/50">Clasificación:</span>
        {CLASSIFICATIONS.map((cl, i) => (
          <Button key={cl || `cl${i}`} size="sm" variant={classification === cl ? 'default' : 'outline'} onClick={() => setClassification(cl)}>{cl || 'Todas'}</Button>
        ))}
        <Button size="sm" variant={onlyModeration ? 'default' : 'outline'} onClick={() => setOnlyModeration(!onlyModeration)}>
          Solo moderación
        </Button>
        <Button size="sm" variant={onlyReview ? 'default' : 'outline'} onClick={() => setOnlyReview(!onlyReview)}>
          Solo revisión
        </Button>
        {postId ? (
          <Button
            size="sm"
            variant="secondary"
            className="gap-1"
            onClick={() => router.replace('/comments')}
          >
            Publicación {postId.slice(0, 8)}…
            <X className="size-3" />
          </Button>
        ) : null}
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {all === null && !error ? (
        <LoadingRows />
      ) : all && all.length === 0 ? (
        <EmptyState title="Sin comentarios" description="Sincroniza comentarios desde el detalle de una publicación." />
      ) : (
        <DataTable<CommentDetail, unknown>
          columns={columns}
          data={filtered}
          getRowCanExpand={() => true}
          renderSubComponent={renderDetail}
        />
      )}
    </div>
  );
}