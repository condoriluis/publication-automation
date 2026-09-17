"use client"

import React from "react"
import { cn } from "@/lib/utils"

interface MessageProps {
  /** incoming = seguidor (izquierda), outgoing = la página (derecha). */
  variant?: "incoming" | "outgoing"
  author?: string
  time?: string
  /** Etiqueta opcional junto al autor (p.ej. "Página"). */
  label?: string
  className?: string
  children: React.ReactNode
}

function initials(name?: string): string {
  return (name ?? "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase()
}

export function Message({
  variant = "incoming",
  author,
  time,
  label,
  className,
  children,
}: MessageProps) {
  const incoming = variant === "incoming"
  return (
    <div className={cn("flex w-full items-start gap-2.5", !incoming && "flex-row-reverse", className)}>
      <div
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
          incoming ? "bg-primary/10 text-primary" : "bg-[#1877F2]/10 text-[#1877F2]"
        )}
      >
        {initials(author)}
      </div>
      <div className={cn("flex max-w-[85%] flex-col gap-1", !incoming && "items-end")}>
        <div
          className={cn(
            "flex flex-wrap items-center gap-x-1.5 text-[11px] text-muted-foreground",
            !incoming && "flex-row-reverse"
          )}
        >
          <span className="font-semibold text-foreground/70">{author ?? "Anónimo"}</span>
          {label ? (
            <span className="rounded bg-[#1877F2]/10 px-1.5 py-px text-[10px] font-medium text-[#1877F2]">
              {label}
            </span>
          ) : null}
          {time ? <span>· {time}</span> : null}
        </div>
        <div
          className={cn(
            "whitespace-pre-wrap break-words rounded-2xl border px-3.5 py-2 text-sm leading-relaxed",
            incoming
              ? "rounded-tl-sm border-border bg-muted/60 text-foreground"
              : "rounded-tr-sm border-transparent bg-[#1877F2] text-white"
          )}
        >
          {children}
        </div>
      </div>
    </div>
  )
}