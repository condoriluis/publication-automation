'use client';

import { useState } from 'react';
import { ThumbsUp, MessageCircle, Share2, MoreHorizontal, Globe } from 'lucide-react';

type Fragment = { type: 'text' | 'link' | 'tag'; value: string };

function parseContent(content: string): Fragment[] {
  const re = /(https?:\/\/[^\s]+)|(#[A-Za-z0-9_áéíóúñÁÉÍÓÚÑ]+)/g;
  const parts = content.split(re);
  return parts
    .filter((p): p is string => Boolean(p))
    .map((p) => {
      if (/^https?:\/\//.test(p)) return { type: 'link' as const, value: p };
      if (/^#/.test(p)) return { type: 'tag' as const, value: p };
      return { type: 'text' as const, value: p };
    });
}

function ImageGrid({ images, expanded, onToggle }: { images: string[]; expanded: boolean; onToggle: () => void }) {
  if (images.length === 0) return null;

  const overlay =
    images.length > 4 && !expanded ? (
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/55 text-xl font-bold text-white">
        +{images.length - 4}
      </div>
    ) : null;

  const Img = ({ src, label }: { src: string; label: string }) => (
    <div className="relative h-full w-full overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={label} className="h-full w-full object-cover" />
    </div>
  );

  const single = images.length === 1;
  const wrapClass = expanded ? 'w-full cursor-zoom-out' : 'w-full cursor-zoom-in';
  const wrapStyle = expanded ? undefined : { maxHeight: single ? 'none' : '480px' };

  return (
    <div
      onClick={onToggle}
      className={`mt-3 ${single ? '' : 'overflow-hidden'} rounded-lg border border-black/5 ${wrapClass}`}
      style={wrapStyle}
    >
      {images.length === 1 ? (
        <div className="w-full bg-zinc-900">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={images[0]!}
            alt="Imagen"
            className="mx-auto h-full w-full object-contain"
            style={expanded ? { maxHeight: 'none' } : { maxHeight: '560px' }}
          />
        </div>
      ) : images.length === 2 ? (
        <div className="grid h-full grid-cols-2 gap-px bg-black/5" style={expanded ? undefined : { aspectRatio: '16 / 9', maxHeight: '360px' }}>
          <Img src={images[0]!} label="Imagen 1" />
          <Img src={images[1]!} label="Imagen 2" />
        </div>
      ) : images.length === 3 ? (
        <div className="grid h-full grid-cols-2 gap-px bg-black/5" style={expanded ? undefined : { maxHeight: '360px' }}>
          <div className="row-span-2 overflow-hidden">
            <Img src={images[0]!} label="Imagen 1" />
          </div>
          <Img src={images[1]!} label="Imagen 2" />
          <Img src={images[2]!} label="Imagen 3" />
        </div>
      ) : (
        <div className="grid h-full grid-cols-2 gap-px bg-black/5" style={expanded ? undefined : { maxHeight: '360px' }}>
          <Img src={images[0]!} label="Imagen 1" />
          <Img src={images[1]!} label="Imagen 2" />
          <Img src={images[2]!} label="Imagen 3" />
          <div className="relative">
            <Img src={images[3]!} label="Imagen 4" />
            {overlay}
          </div>
        </div>
      )}
    </div>
  );
}

interface FacebookPostPreviewProps {
  pageName: string;
  pagePicture?: string | null;
  content: string;
  imageUrls?: string[];
  videoUrl?: string | null;
  linkUrl?: string | null;
  timeLabel?: string;
  feedLabel?: string;
  headerExtra?: React.ReactNode;
}

function LinkCard({ url }: { url: string }) {
  let hostname = url;
  try {
    hostname = new URL(url).hostname;
  } catch {
    // URL aún incompleta durante el tipeo: se muestra como está
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="mx-4 mt-3 block overflow-hidden rounded-lg border border-black/5 bg-zinc-100 dark:bg-zinc-800"
    >
      <div className="flex h-[110px]">
        <div className="flex w-28 shrink-0 items-center justify-center self-stretch bg-zinc-900">
          <span className="line-clamp-2 px-2 text-center text-xs font-semibold text-white/80">{hostname}</span>
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1 px-3 py-2">
          <p className="truncate text-sm font-semibold text-foreground">{hostname}</p>
          <p className="line-clamp-2 text-[13px] leading-snug text-muted-foreground">{url}</p>
        </div>
      </div>
      <div className="border-t border-black/5 px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Enlace
      </div>
    </a>
  );
}

export function FacebookPostPreview({
  pageName,
  pagePicture,
  content,
  imageUrls = [],
  videoUrl = null,
  linkUrl = null,
  timeLabel = 'Justo ahora',
  feedLabel = 'Publicación de la página',
  headerExtra,
}: FacebookPostPreviewProps) {
  const fragments = parseContent(content);
  const initials = (pageName ?? 'P').slice(0, 2).toUpperCase();
  const [expanded, setExpanded] = useState(false);
  const hasMedia = imageUrls.length > 0 || !!videoUrl;

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pb-3 pt-4">
        <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#1877F2]">
          {pagePicture ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={pagePicture} alt="" className="size-full object-cover" />
          ) : (
            <span className="text-sm font-bold text-white">{initials}</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 truncate text-[15px] font-semibold leading-tight">
            <span className="truncate">{pageName || 'Página'}</span>
            <svg viewBox="0 0 16 16" className="size-4 shrink-0 fill-[#1877F2]" aria-label="Verificado">
              <path d="M8 0a8 8 0 108 8 8 8 0 00-8-8zm3.53 5.85l-4.05 4.06a1 1 0 01-1.42 0l-2-2a1 1 0 111.42-1.41l1.31 1.3 3.34-3.35a1 1 0 111.4 1.4z" />
            </svg>
          </p>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            {timeLabel}
            <span className="text-[8px]">·</span>
            <Globe className="size-3" />
          </p>
        </div>
        {headerExtra}
        <button type="button" className="rounded-full p-2 text-muted-foreground hover:bg-black/5 dark:hover:bg-white/10" aria-label="Más">
          <MoreHorizontal className="size-5" />
        </button>
      </div>

      {/* Body */}
      <p className="whitespace-pre-wrap px-4 text-[15px] leading-relaxed">
        {fragments.map((f, i) =>
          f.type === 'link' ? (
            <a key={i} href={f.value} target="_blank" rel="noopener noreferrer" className="text-[#1877F2] hover:underline">
              {f.value}
            </a>
          ) : f.type === 'tag' ? (
            <span key={i} className="text-[#1877F2]">{f.value}</span>
          ) : (
            <span key={i}>{f.value}</span>
          ),
        )}
      </p>

      {linkUrl && !hasMedia ? <LinkCard url={linkUrl} /> : null}

      {/* Media */}
      {videoUrl ? (
        <div className="mt-3 w-full overflow-hidden rounded-lg border border-black/5" style={expanded ? undefined : { maxHeight: '480px' }}>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video src={videoUrl} controls className="h-full w-full object-cover" style={expanded ? undefined : { aspectRatio: '16 / 9' }} />
        </div>
      ) : null}
      {imageUrls.length > 0 ? (
        <ImageGrid
          images={imageUrls}
          expanded={expanded}
          onToggle={() => setExpanded((v) => !v)}
        />
      ) : null}

      {/* Footer */}
      <div className="mt-1 px-4 pb-2 pt-1">
        <div className="flex items-center justify-between border-t py-2.5">
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <span className="flex size-5 items-center justify-center rounded-full bg-[#1877F2]">
              <ThumbsUp className="size-3 fill-white text-white" />
            </span>
            <span>{feedLabel}</span>
          </div>
          {/* href="#" inert */}
        </div>
        <div className="flex border-t pt-1">
          <span className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium text-muted-foreground hover:bg-black/5 dark:hover:bg-white/10">
            <ThumbsUp className="size-[18px]" /> Me gusta
          </span>
          <span className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium text-muted-foreground hover:bg-black/5 dark:hover:bg-white/10">
            <MessageCircle className="size-[18px]" /> Comentar
          </span>
          <span className="flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium text-muted-foreground hover:bg-black/5 dark:hover:bg-white/10">
            <Share2 className="size-[18px]" /> Compartir
          </span>
        </div>
      </div>
    </div>
  );
}