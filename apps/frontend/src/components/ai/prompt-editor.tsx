"use client";

import { memo, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Editor, { loader as monacoLoader, type OnMount } from "@monaco-editor/react";
import * as monaco from "monaco-editor";
import { useTheme } from "next-themes";
import { Check, Maximize2, Minimize2, Wand2, X } from "lucide-react";

import { cn } from "@/lib/utils";

// Self-hosted: se empaqueta monaco-editor en el bundle en vez de descargarlo
// desde el CDN de jsdelivr (bloqueado por la Content-Security-Policy).
monacoLoader.config({ monaco });

/** Deja el texto ordenado: sin espacios finales ni párrafos colgados. */
export function normalizePrompt(text: string): string {
  return text
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const MONO_FONT =
  "'JetBrains Mono', ui-monospace, 'SFMono-Regular', Menlo, Monaco, Consolas, 'Liberation Mono', monospace";

interface PromptEditorProps {
  value: string;
  onChange: (value: string) => void;
  minHeight?: string;
  placeholder?: string;
  title?: string;
  className?: string;
}

function useTaskDone(): [boolean, () => void] {
  const [done, setDone] = useState(false);
  const mark = () => {
    setDone(true);
    window.setTimeout(() => setDone(false), 1500);
  };
  return [done, mark];
}

export function PromptEditor({
  value,
  onChange,
  minHeight = "260px",
  placeholder = "Escribe aquí...",
  title = "Editor de prompt",
  className,
}: PromptEditorProps) {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded]);

  if (expanded) {
    return createPortal(
      <PromptEditorDialog
        value={value}
        onChange={onChange}
        title={title}
        onClose={() => setExpanded(false)}
      />,
      document.body,
    );
  }

  return (
    <PromptEditorSurface
      value={value}
      onChange={onChange}
      minHeight={minHeight}
      placeholder={placeholder}
      title={title}
      className={className}
      onExpand={() => setExpanded(true)}
    />
  );
}

/* ── Superficie embebida ─────────────────────────────────────────────────── */
function PromptEditorSurface({
  value,
  onChange,
  minHeight,
  placeholder,
  title,
  className,
  onExpand,
}: {
  value: string;
  onChange: (value: string) => void;
  minHeight: string;
  placeholder: string;
  title: string;
  className?: string;
  onExpand: () => void;
}) {
  const { resolvedTheme } = useTheme();
  const [focused, setFocused] = useState(false);
  const [done, markDone] = useTaskDone();

  const handleMount: OnMount = (editor) => {
    editor.onDidFocusEditorText(() => setFocused(true));
    editor.onDidBlurEditorText(() => setFocused(false));
  };

  const format = () => {
    const next = normalizePrompt(value);
    if (next !== value) onChange(next);
    markDone();
  };

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-xl border bg-muted/20 shadow-sm transition-colors focus-within:border-ring",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b bg-muted/40 px-2.5 py-1.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="inline-flex h-5 shrink-0 items-center rounded border bg-muted/60 px-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            txt
          </span>
          <span className="truncate pr-1 text-[11px] font-medium text-muted-foreground">{title}</span>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <EditorBarButton
            onClick={format}
            title="Formatear (quita espacios y líneas colgadas)"
            label={done ? "Listo" : "Formatear"}
            active={done}
          >
            {done ? <Check className="size-3.5" /> : <Wand2 className="size-3.5" />}
          </EditorBarButton>
          <EditorBarButton onClick={onExpand} title="Expandir a pantalla completa">
            <Maximize2 className="size-3.5" />
          </EditorBarButton>
        </div>
      </div>

      <div className="relative" style={{ height: minHeight }}>
        <Editor
          width="100%"
          height="100%"
          language="plaintext"
          theme={resolvedTheme === "dark" ? "vs-dark" : "light"}
          value={value}
          onChange={(v) => onChange(v ?? "")}
          onMount={handleMount}
          loading={
            <div className="flex h-full w-full items-center justify-center bg-muted/5 text-xs text-muted-foreground">
              Cargando editor…
            </div>
          }
          options={{
            readOnly: false,
            fontSize: 13.5,
            fontFamily: MONO_FONT,
            minimap: { enabled: false },
            scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
            scrollBeyondLastLine: false,
            lineNumbers: "on",
            lineNumbersMinChars: 3,
            lineDecorationsWidth: 8,
            roundedSelection: false,
            automaticLayout: true,
            padding: { top: 12, bottom: 12 },
            fixedOverflowWidgets: true,
            folding: true,
            glyphMargin: false,
            bracketPairColorization: { enabled: true },
            wordWrap: "on",
            dragAndDrop: false,
            dropIntoEditor: { enabled: false },
            tabSize: 2,
          }}
        />
        {value === "" && !focused && (
          <div className="pointer-events-none absolute left-3 top-2 z-10 select-none text-sm text-muted-foreground/60">
            {placeholder}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Modal a pantalla completa ───────────────────────────────────────────── */
function PromptEditorDialog({
  value,
  onChange,
  title,
  onClose,
}: {
  value: string;
  onChange: (value: string) => void;
  title: string;
  onClose: () => void;
}) {
  const { resolvedTheme } = useTheme();

  return (
    <div className="fixed inset-0 z-[900] flex items-center justify-center p-3 sm:p-5 md:p-8 animate-in fade-in duration-200">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative flex h-[92dvh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border bg-card shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b bg-muted/40 px-4 py-3">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold text-foreground">{title}</h2>
            <p className="truncate text-[11px] text-muted-foreground">
              Cambios en vivo · usa “Guardar” del formulario para persistir
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-2 rounded-lg bg-foreground px-3.5 py-1.5 text-xs font-bold text-background shadow-sm transition-all hover:opacity-90 active:scale-95"
            >
              <Check className="size-3.5" />
              Listo
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar"
              title="Cerrar (Esc)"
              className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1">
          <Editor
            width="100%"
            height="100%"
            language="plaintext"
            theme={resolvedTheme === "dark" ? "vs-dark" : "light"}
            value={value}
            onChange={(v) => onChange(v ?? "")}
            loading={
              <div className="flex h-full w-full items-center justify-center bg-muted/5 text-xs text-muted-foreground">
                Cargando editor…
              </div>
            }
            options={{
              fontSize: 14,
              fontFamily: MONO_FONT,
              minimap: { enabled: true, maxColumn: 80 },
              scrollbar: { verticalScrollbarSize: 12, horizontalScrollbarSize: 12 },
              scrollBeyondLastLine: false,
              lineNumbers: "on",
              roundedSelection: false,
              automaticLayout: true,
              padding: { top: 20, bottom: 20 },
              fixedOverflowWidgets: true,
              folding: true,
              bracketPairColorization: { enabled: true },
              wordWrap: "on",
              dragAndDrop: false,
              dropIntoEditor: { enabled: false },
              tabSize: 2,
              stickyScroll: { enabled: true },
            }}
          />
        </div>
      </div>
    </div>
  );
}

/* ── Botón pequeño de la barra ───────────────────────────────────────────── */
function EditorBarButton({
  children,
  onClick,
  title,
  label,
  active,
}: {
  children: ReactNode;
  onClick: () => void;
  title: string;
  label?: string;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        "inline-flex h-6 items-center gap-1.5 rounded-md px-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
        active && "text-emerald-600 dark:text-emerald-400",
      )}
    >
      {children}
      {label ? <span className="hidden sm:inline">{label}</span> : null}
    </button>
  );
}

export default memo(PromptEditor);