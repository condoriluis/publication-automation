'use client';

import * as React from 'react';
import { useTheme } from 'next-themes';

const SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY ?? '';
/** Tamaño nativo del checkbox de reCAPTCHA v2. */
const WIDGET_WIDTH = 304;
const WIDGET_HEIGHT = 80;
const MIN_SCALE = 0.55;
const MAX_SCALE = 1.12;

declare global {
  interface Window {
    paRecaptchaLoaded?: () => void;
    grecaptcha?: {
      render(el: HTMLElement, options: Record<string, unknown>): number;
      getResponse(widgetId?: number): string | null;
      reset(widgetId?: number): void;
    };
  }
}

interface RecaptchaCheckboxProps {
  /** Notifica el token cuando el usuario resuelve el reto (o null al resetear). */
  onToken: (token: string | null) => void;
  /** Incrementar fuerza un reset del widget (p. ej. tras un error de login). */
  resetSignal?: number;
}

/**
 * Checkbox reCAPTCHA v2 con tema acorde al esquema del sistema y ancho
 * fluido (se escala al contenedor para igualar los inputs del formulario).
 */
export function RecaptchaCheckbox({ onToken, resetSignal = 0 }: RecaptchaCheckboxProps) {
  const { resolvedTheme } = useTheme();
  const theme = resolvedTheme === 'dark' ? 'dark' : 'light';

  const wrapRef = React.useRef<HTMLDivElement>(null);
  const slotRef = React.useRef<HTMLDivElement>(null);
  const widgetIdRef = React.useRef<number | null>(null);
  const onTokenRef = React.useRef(onToken);

  // Mantiene el callback de token actualizado sin escribirlo durante el render.
  React.useEffect(() => {
    onTokenRef.current = onToken;
  });

  // El widget se re-renderiza con `key` al cambiar el tema (reCAPTCHA no
  // permite cambiar theme sobre el mismo elemento).
  const [scale, setScale] = React.useState(1);

  // Escala el widget al ancho real del contenedor (igual al de los inputs).
  React.useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      const width = el.clientWidth;
      setScale(Math.min(Math.max(width / WIDGET_WIDTH, MIN_SCALE), MAX_SCALE));
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Renderiza el widget dentro del slot (cada vez que cambia el key/tema).
  React.useEffect(() => {
    const el = slotRef.current;
    if (!el || !SITE_KEY) return;

    const render = () => {
      if (el.childElementCount > 0) return;
      const id = window.grecaptcha!.render(el, {
        sitekey: SITE_KEY,
        theme,
        size: 'normal',
        hl: 'es',
        callback: () => {
          onTokenRef.current(window.grecaptcha?.getResponse(id) ?? null);
        },
      });
      widgetIdRef.current = id;
    };

    if (window.grecaptcha?.render) {
      render();
    } else {
      const existing = document.getElementById('pa-recaptcha') as HTMLScriptElement | null;
      if (!existing) {
        const script = document.createElement('script');
        script.id = 'pa-recaptcha';
        script.src =
          'https://www.google.com/recaptcha/api.js?render=explicit&onload=paRecaptchaLoaded';
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }
      window.paRecaptchaLoaded = render;
    }
  }, [theme]);

  // Reset controlado desde el padre (p. ej. tras un login fallido).
  React.useEffect(() => {
    if (resetSignal === 0) return;
    const id = widgetIdRef.current;
    if (id != null) window.grecaptcha?.reset(id);
    onTokenRef.current(null);
  }, [resetSignal]);

  if (!SITE_KEY) return null;

  return (
    <div
      ref={wrapRef}
      className="overflow-hidden rounded-md"
      style={{ height: Math.round(WIDGET_HEIGHT * scale) }}
    >
      <div
        ref={slotRef}
        key={theme}
        className="rounded-md"
        style={{
          width: WIDGET_WIDTH,
          height: WIDGET_HEIGHT,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
        }}
      />
    </div>
  );
}