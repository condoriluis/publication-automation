'use client';

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  X,
  ExternalLink,
  BookOpen,
  Check,
  Globe,
  AppWindow,
  KeyRound,
  Settings2,
  ShieldCheck,
  Webhook,
  Link2,
  Rocket,
  Lock,
  Info,
  RefreshCw,
  Loader2,
  ImagePlus,
} from 'lucide-react';

import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import type { FacebookPublicConfig } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { FacebookIcon } from '@/components/facebook-icon';

interface TutorialStep {
  id: number;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  content?: string[];
  scopes?: { scope: string; desc: string }[];
  tip?: string;
  url?: string;
  urlLabel?: string;
}

function buildSteps(cfg: FacebookPublicConfig, origin: string): TutorialStep[] {
  const host = new URL(origin).host;
  const privacyUrl = `${origin}/privacy`;
  const useCasesUrl = `https://developers.facebook.com/apps/${cfg.appId}/use_cases/`;
  const appSettingsUrl = `https://developers.facebook.com/apps/${cfg.appId}/settings/`;
  const loginSettingsUrl = `https://developers.facebook.com/apps/${cfg.appId}/fb-login/settings/`;

  const scopes: TutorialStep['scopes'] = (cfg.scopes.length > 0 ? cfg.scopes : ['pages_read_engagement', 'pages_manage_posts']).map((scope) => {
    const desc =
      ({
        business_management: 'Acceder a los activos del Portafolio empresarial (no es necesario para publicar).',
        email: 'Identificar el correo de la cuenta conectada.',
        pages_manage_engagement: 'Responder y moderar comentarios desde el panel.',
        pages_manage_metadata: 'Suscribir las páginas a webhooks y renovar permisos.',
        pages_manage_posts: 'Publicar posts y programar campañas.',
        pages_read_engagement: 'Leer comentarios, reacciones y métricas de tus páginas.',
        pages_read_user_content: 'Requisito que agrega el caso de uso: actívala o el login falla.',
        pages_show_list: 'Ver la lista de páginas de la cuenta conectada.',
        public_profile: 'Datos básicos del perfil (nombre e identificador). Se otorga solo.',
      }) as Record<string, string>;
    return { scope, desc: desc[scope] ?? 'Permiso solicitado por la integración.' };
  });

  return [
    {
      id: 1,
      icon: <Globe className="size-4" />,
      title: 'Entrar a Meta for Developers',
      subtitle: 'Inicia sesión con la cuenta de Facebook de tu página',
      content: [
        'Abre Meta for Developers e inicia sesión con la cuenta de Facebook que administra tu página.',
        'Todavía no configures nada en el panel: primero creamos la aplicación desde Meta.',
      ],
      tip: 'De preferencia usa la misma cuenta que administra la página que vas a publicar.',
      url: 'https://developers.facebook.com/',
      urlLabel: 'Abrir Meta for Developers',
    },
    {
      id: 2,
      icon: <AppWindow className="size-4" />,
      title: 'Crear la app (experiencia nueva)',
      subtitle: 'Caso de uso: Administrar todos los aspectos de tu página',
      content: [
        'En Mis aplicaciones pulsa Crear app.',
        'Elige el caso de uso "Administrar todos los aspectos de tu página" (Manage everything on your Page).',
        'Es el único caso de uso correcto: entrega los permisos de publicación y permite publicar la app después con verificación individual.',
        'NO elijas "Otros" (esa app legacy no trae los permisos de página) ni vincules negocios o portafolios.',
      ],
      tip: 'La web de Meta puede verse en inglés o español; es el mismo caso de uso. Así la app queda en el panel nuevo con el menú "Casos de uso" y puede publicarse luego con verificación individual.',
      url: useCasesUrl,
      urlLabel: 'Abrir casos de uso de tu app',
    },
    {
      id: 3,
      icon: <AppWindow className="size-4" />,
      title: 'Agregar el producto Facebook Login',
      subtitle: 'Habilita el flujo OAuth para conectar la cuenta',
      content: [
        'En los casos de uso, Meta ya incluye el producto Inicio de sesión con Facebook (Facebook Login). Si no aparece, agrégalo desde el catálogo de productos.',
        'Activa la opción "Inicio de sesión de OAuth web".',
        'Con este producto, la cuenta puede autorizarse desde este panel.',
      ],
      tip: 'Sin este producto no aparece el flujo de "Continuar con Facebook" ni el botón Conectar.',
      url: 'https://developers.facebook.com/docs/facebook-login/web',
      urlLabel: 'Documentación de Facebook Login',
    },
    {
      id: 4,
      icon: <KeyRound className="size-4" />,
      title: 'Configuración básica de la app',
      subtitle: 'App ID, App Secret, dominio y políticas',
      content: [
        'Entra a Configuración de la app → Información básica en Meta.',
        `Identificador de la app (App ID): ${cfg.appId}`,
        `Dominios de la app: ${host}`,
        `URL de la política de privacidad: ${privacyUrl}`,
        'La Clave secreta (App Secret) aparece oculta (●●●●●●●●): cópiala una sola vez y pégala en el servidor como FACEBOOK_APP_SECRET.',
      ],
      tip: 'El App Secret es una contraseña. Se guarda cifrado en el servidor; nunca debe vivir en el navegador ni en el tutorial.',
      url: appSettingsUrl,
      urlLabel: 'Abrir configuración básica de tu app',
    },
    {
      id: 5,
      icon: <Settings2 className="size-4" />,
      title: 'URL de redirección OAuth',
      subtitle: 'A dónde vuelve Facebook tras autorizar',
      content: [
        'En la configuración de Facebook Login agrega una URL válida de redireccionamiento de OAuth:',
        cfg.redirectUri,
        'Si la app corre también en producción, agrega además la URL de tu dominio desplegado terminada en /oauth/callback.',
        'Debe coincidir exactamente con META_OAUTH_REDIRECT_URI del servidor; si difiere, Facebook rechaza la conexión.',
      ],
      tip: 'Guarda los cambios y reinicia la ventana de Facebook si estabas autorizando.',
      url: loginSettingsUrl,
      urlLabel: 'Abrir configuración de Facebook Login',
    },
    {
      id: 6,
      icon: <ShieldCheck className="size-4" />,
      title: 'Permisos que solicita el panel',
      subtitle: 'Publicar, moderar y medir tus páginas',
      content: [
        'En Casos de uso → Administrar páginas → Permisos y funciones, activa estos permisos:',
        'Además activa pages_read_user_content (el caso de uso la exige: si falta, el login falla con "Invalid Scopes").',
      ],
      scopes,
      tip: 'En Modo desarrollo los permisos funcionan solo con cuentas que tienen rol en la app (la tuya). No necesitas business_management ni Advanced Access para publicar en tu propia página.',
      url: 'https://developers.facebook.com/docs/permissions/reference',
      urlLabel: 'Referencia de permisos',
    },
    {
      id: 7,
      icon: <Webhook className="size-4" />,
      title: 'Configurar el Webhook (opcional)',
      subtitle: 'Recibe comentarios en tiempo real',
      content: [
        'Solo si quieres la funcionalidad de comentarios automáticos. Para publicar no es necesario.',
        'En el producto Webhooks crea una suscripción para tu aplicación:',
        `URL de callback: ${cfg.webhookUrl}`,
        'Token de verificación: el valor que definiste en META_WEBHOOK_VERIFY_TOKEN del servidor (debe coincidir).',
      ],
      tip: 'Hasta que la app no esté publicada, los webhooks de producción no llegan; el panel detecta comentarios por sondeo ante un error 403.',
      url: 'https://developers.facebook.com/docs/graph-api/webhooks',
      urlLabel: 'Documentación de Webhooks',
    },
    {
      id: 8,
      icon: <Link2 className="size-4" />,
      title: 'Conectar tu cuenta desde Páginas',
      subtitle: 'Autoriza con el botón del panel',
      content: [
        'Vuelve a la página Páginas de este panel y pulsa Conectar cuenta de Facebook.',
        'Se abrirá la ventana de Facebook: revisa los permisos y pulsa Continuar.',
        'El panel guarda el token (válido ~60 días). Si expira, reconecta para renovarlo automáticamente.',
      ],
      tip: 'Puedes cerrar la ventana de Facebook: el panel se actualiza solo al completar la conexión.',
    },
    {
      id: 9,
      icon: <Rocket className="size-4" />,
      title: 'Modo desarrollo vs. producción',
      subtitle: 'Por qué otras cuentas no ven las publicaciones',
      content: [
        'Con la app En desarrollo, las publicaciones creadas desde este sistema solo las ven la cuenta con rol en la app (la tuya) y los administradores de la página.',
        'Para que todos vean los posts: publica la app (botón Publicar del panel superior). Solo la puede publicar una app creada con el caso de uso del paso 2.',
        'Para publicarla necesitas una verificación de identidad: individual (solo tu documento, sin empresa) o de negocio.',
      ],
      tip: 'Si al publicar te exige verificación de negocio, asegúrate de haber creado la app sin portafolio y usa la verificación individual.',
    },
    {
      id: 10,
      icon: <Check className="size-4" />,
      title: '¡Cuenta conectada y páginas listas!',
      subtitle: 'Panel listo para operar',
      content: [
        'Verás la tarjeta de la cuenta conectada y el listado de sus páginas.',
        'Si la cuenta aún no tiene páginas o quieres otra, crea una desde Facebook y actualiza con Refrescar.',
        'Ya puedes crear campañas, publicar posts, responder comentarios y ver métricas.',
      ],
      url: 'https://www.facebook.com/pages/creation/',
      urlLabel: 'Crear una página de Facebook',
    },
  ];
}

export function TutorialFacebookGuide({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [current, setCurrent] = useState(0);
  const [config, setConfig] = useState<FacebookPublicConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // El origin real solo existe en el cliente; el servidor y la hidratación usan
  // la misma snapshot (URL pública) y tras hidratar se lee window.location.origin
  // (evita #418/#425 por discrepancias de origen).
  const origin = useSyncExternalStore(
    () => () => {},
    () => window.location.origin,
    () => 'https://automation-fb.vercel.app',
  );

  const fetchConfig = useCallback(() => {
    return api
      .get<FacebookPublicConfig>('/facebook/config', { auth: false })
      .then(setConfig)
      .catch((e) => setError(e instanceof Error ? e.message : 'No se pudo cargar la configuración'));
  }, []);

  // Reinicia el paso visible al abrir (render-adjust, SSR-safe).
  const [lastOpen, setLastOpen] = useState(open);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) setCurrent(0);
  }

  useEffect(() => {
    if (!open) return;
    if (!config) {
      void fetchConfig();
    }
  }, [open, config, fetchConfig]);

  if (!open) return null;

  const retry = () => {
    setLoading(true);
    setError(null);
    void fetchConfig().finally(() => setLoading(false));
  };

  const steps = config ? buildSteps(config, origin) : null;
  const step = steps?.[current] as TutorialStep | undefined;
  const isFirst = current === 0;
  const isLast = step ? current === steps!.length - 1 : false;
  const progress = step ? ((current + 1) / steps!.length) * 100 : 0;
  const showSpinner = !config && !error;

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 animate-in fade-in duration-200" role="dialog" aria-modal="true" aria-label="Guía de conexión con Facebook">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[6px]" onClick={onClose} aria-hidden="true" />

      <div className="relative z-10 mx-auto flex w-full max-w-2xl max-h-[90vh] flex-col overflow-hidden rounded-2xl border bg-card shadow-2xl animate-in zoom-in-95 duration-300">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-b px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#1877F2]/10 text-[#1877F2]">
              <BookOpen className="size-4" />
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-sm font-bold">Guía: conectar cuenta de Facebook</h3>
              <p className="text-[11px] text-muted-foreground">{steps ? `Paso ${current + 1} de ${steps.length}` : 'Cargando configuración…'}</p>
            </div>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar guía">
            <X className="size-4" />
          </Button>
        </div>

        {/* Progress */}
        <div className="h-0.5 w-full shrink-0 bg-border/60">
          <div className="h-full bg-[#1877F2] transition-all duration-500 ease-out" style={{ width: `${progress}%` }} />
        </div>

        {showSpinner || (loading && !config) ? (
          <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
            <Loader2 className="size-6 animate-spin text-[#1877F2]" />
            <p className="text-sm text-muted-foreground">Cargando la configuración de tu integración…</p>
          </div>
        ) : error && !config ? (
          <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
            <p className="text-sm text-destructive">{error}</p>
            <Button type="button" variant="outline" onClick={retry}>
              <RefreshCw className="mr-1 size-4" />
              Reintentar
            </Button>
          </div>
        ) : step ? (
          <>
            {/* Step selector */}
            <div className="shrink-0 overflow-x-auto px-5 pt-4 pb-1">
              <div className="flex min-w-max items-center gap-1.5">
                {steps!.map((s, i) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setCurrent(i)}
                    title={s.title}
                    aria-label={`Ir al paso ${s.id}: ${s.title}`}
                    className={cn(
                      'flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold transition-all',
                      i === current
                        ? 'scale-110 bg-[#1877F2] text-white shadow-md shadow-[#1877F2]/30'
                        : i < current
                          ? 'bg-[#1877F2]/15 text-[#1877F2]'
                          : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {i < current ? <Check className="size-3" strokeWidth={3} /> : i + 1}
                  </button>
                ))}
              </div>
            </div>

            {/* Content */}
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              <div key={step.id} className="animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#1877F2]/10 text-[#1877F2]">
                    {step.icon}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold leading-tight">{step.title}</h4>
                    <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">{step.subtitle}</p>
                  </div>
                </div>

                {step.content && step.content.length > 0 ? (
                  <div className="mb-4 space-y-3">
                    {step.content.map((text, i) => (
                      <div key={i} className="flex items-start gap-2.5">
                        <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-[#1877F2]/10 text-[9px] font-bold text-[#1877F2]">
                          {i + 1}
                        </span>
                        {text.startsWith('https://') ? (
                          <code className="rounded-md bg-muted px-2 py-0.5 break-all font-mono text-[11px] text-[#0A5BC4] dark:text-[#93BCEC]">{text}</code>
                        ) : (
                          <p className="text-[12px] font-medium leading-relaxed text-muted-foreground">{text}</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : null}

                {step.scopes ? (
                  <div className="mb-4 overflow-hidden rounded-xl border">
                    {step.scopes.map((s, i) => (
                      <div key={s.scope} className={cn('flex items-start gap-2 px-3 py-2', i !== step.scopes!.length - 1 && 'border-b')}>
                        <code className="mt-0.5 shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-foreground">{s.scope}</code>
                        <p className="text-[11px] leading-relaxed text-muted-foreground">{s.desc}</p>
                      </div>
                    ))}
                  </div>
                ) : null}

                {step.tip ? (
                  <div className="mb-4 rounded-xl border border-[#1877F2]/15 bg-[#1877F2]/5 p-3">
                    <p className="flex items-start gap-2 text-[11px] font-medium leading-relaxed text-[#0A5BC4] dark:text-[#93BCEC]">
                      <Info className="mt-0.5 size-3.5 shrink-0" />
                      {step.tip}
                    </p>
                  </div>
                ) : null}

                {step.id === 4 ? (
                  <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
                    <Lock className="mt-0.5 size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                    <p className="text-[11px] font-medium leading-relaxed text-amber-700 dark:text-amber-400">
                      Seguridad: el App Secret se guarda cifrado en el servidor. No se muestra ni se usa en el frontend.
                    </p>
                  </div>
                ) : null}

                {step.id === 10 ? (
                  <div className="mb-4 flex items-start gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                    <ImagePlus className="mt-0.5 size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <p className="text-[11px] font-medium leading-relaxed text-emerald-700 dark:text-emerald-400">
                      Para publicar necesitas que la cuenta conectada tenga al menos una página de Facebook.
                    </p>
                  </div>
                ) : null}

                {step.url ? (
                  <a
                    href={step.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg border bg-background px-3 py-2 text-[11px] font-bold text-muted-foreground transition-all hover:border-[#1877F2]/40 hover:bg-[#1877F2]/5 hover:text-foreground"
                  >
                    <ExternalLink className="size-3" />
                    {step.urlLabel ?? 'Abrir en Meta'}
                  </a>
                ) : null}
              </div>
            </div>
          </>
        ) : null}

        {/* Footer */}
        {step ? (
          <div className="flex shrink-0 items-center justify-between gap-3 border-t bg-muted/30 px-6 py-4">
            <Button type="button" variant="outline" onClick={() => setCurrent((c) => c - 1)} disabled={isFirst}>
              <ChevronLeft className="mr-1 size-4" />
              Atrás
            </Button>
            <div className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground">
              <FacebookIcon className="size-3.5 text-[#1877F2]" />
              {current + 1} / {steps!.length}
            </div>
            {isLast ? (
              <Button type="button" className="bg-[#1877F2] hover:bg-[#0A5BC4] text-white" onClick={onClose}>
                <Check className="mr-1 size-4" strokeWidth={3} />
                Entendido
              </Button>
            ) : (
              <Button type="button" className="bg-[#1877F2] hover:bg-[#0A5BC4] text-white" onClick={() => setCurrent((c) => c + 1)}>
                Siguiente
                <ChevronRight className="ml-1 size-4" />
              </Button>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}