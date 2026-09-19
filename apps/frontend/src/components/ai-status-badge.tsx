'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { useAuthAdmin } from '@/contexts/auth-context';

interface AiStatus {
  provider: string;
  model: string;
  configured: boolean;
}

const PROVIDER_SHORT: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  google: 'Gemini',
  groq: 'Groq',
  openrouter: 'OpenRouter',
};

const REFRESH_MS = 60_000;

/**
 * Indicador global del proveedor/modelo de IA activo.
 * Muestra un punto verde pulsante cuando está configurado y refresca solo el
 * estado cada minuto (sin exponer ninguna API key). Con rol admin/manager
 * actúa como acceso rápido a la página de configuración.
 */
export function AiStatusBadge({ className }: { className?: string }) {
  const { user } = useAuthAdmin();
  const canManage = Boolean(user?.roles.some((r) => r === 'ADMIN' || r === 'MANAGER'));
  const [status, setStatus] = useState<AiStatus | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = () =>
      api
        .get<AiStatus>('/ai/status')
        .then((s) => {
          if (!cancelled) setStatus(s);
        })
        .catch(() => {
          if (!cancelled) setStatus(null);
        });

    void load();
    const id = window.setInterval(load, REFRESH_MS);
    const onFocus = () => void load();
    window.addEventListener('focus', onFocus);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  const configured = Boolean(status?.configured);
  const provider = status?.provider ? (PROVIDER_SHORT[status.provider] ?? status.provider) : null;
  const model = status?.model && status.model !== '—' ? status.model : null;

  const content = (
    <span
      role="status"
      title={
        configured
          ? `IA activa: ${provider ?? 'Proveedor'}${model ? ` · ${model}` : ''}`
          : 'IA sin configurar'
      }
      className={cn(
        'inline-flex h-7 max-w-full items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-medium leading-none transition-colors',
        configured
          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
          : 'border bg-[var(--muted)]/50 text-[var(--muted-foreground)]',
        className,
      )}
    >
      <span className="relative flex size-1.5 shrink-0">
        {status === null ? (
          <span className="absolute inline-flex size-1.5 animate-pulse rounded-full bg-current opacity-50" />
        ) : configured ? (
          <>
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex size-1.5 rounded-full bg-emerald-500" />
          </>
        ) : (
          <span className="relative inline-flex size-1.5 rounded-full bg-[var(--muted-foreground)]" />
        )}
      </span>

      {status === null ? (
        <span className="text-[var(--muted-foreground)]">IA</span>
      ) : configured ? (
        <>
          <span className="hidden sm:inline">{provider ?? 'IA'}</span>
          <span className="hidden min-w-0 max-w-[150px] truncate font-semibold sm:inline">
            {model ? ` · ${model}` : ''}
          </span>
          <span className="sm:hidden">{provider ?? 'IA'}</span>
        </>
      ) : (
        <span>IA sin configurar</span>
      )}
    </span>
  );

  if (canManage) {
    return (
      <Link href="/ai-config" className="shrink-0" aria-label="Abrir configuración de IA">
        {content}
      </Link>
    );
  }

  return <span className="shrink-0">{content}</span>;
}