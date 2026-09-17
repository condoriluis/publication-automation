'use client';

import { useState } from 'react';
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
} from 'lucide-react';

import { cn } from '@/lib/utils';
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

const STEPS: TutorialStep[] = [
  {
    id: 1,
    icon: <Globe className="size-4" />,
    title: 'Entrar a Meta for Developers',
    subtitle: 'Inicia sesión con la cuenta de Facebook de tu página',
    content: [
      'Abre Meta for Developers e inicia sesión con la cuenta de Facebook que administra tu página.',
      'Todavía no configures nada en el panel. Primero creamos la aplicación desde Meta.',
    ],
    url: 'https://developers.facebook.com/',
    urlLabel: 'Abrir Meta for Developers',
  },
  {
    id: 2,
    icon: <AppWindow className="size-4" />,
    title: 'Crear una aplicación',
    subtitle: 'Registra tu app y elige el caso de uso',
    content: [
      'En Mis aplicaciones pulsa Crear aplicación y, cuando Meta pregunte qué tipo, elige la opción de tipo Negocio (Business).',
      'Este tipo de app permite gestionar páginas, publicar contenido y leer comentarios con la API.',
      'Completa los datos iniciales (nombre, correo de contacto) y confirma. Ya tendrás tu app creada.',
    ],
    url: 'https://developers.facebook.com/apps/',
    urlLabel: 'Ir a Mis aplicaciones',
  },
  {
    id: 3,
    icon: <AppWindow className="size-4" />,
    title: 'Agregar el producto Facebook Login',
    subtitle: 'Habilita el flujo OAuth para conectar la cuenta',
    content: [
      'Dentro de tu app, en Casos de uso o Agregar producto, selecciona Inicio de sesión con Facebook (Facebook Login).',
      'Este producto habilita la pantalla de autorización que los usuarios ven al conectar su cuenta desde el panel.',
    ],
    tip: 'También puedes agregar el producto Webhooks en el mismo lugar; lo configuraremos un paso más adelante.',
    url: 'https://developers.facebook.com/docs/facebook-login/web',
    urlLabel: 'Documentación de Facebook Login',
  },
  {
    id: 4,
    icon: <KeyRound className="size-4" />,
    title: 'Obtener App ID y App Secret',
    subtitle: 'Las credenciales de tu aplicación',
    content: [
      'Ve a Configuración de la app → Información básica.',
      'Copia el ID de la aplicación (App ID) y la Clave secreta (App Secret).',
      'Estos valores se escriben en el servidor (FACEBOOK_APP_ID y FACEBOOK_APP_SECRET). El panel los usa internamente; jamás se exponen en el navegador.',
    ],
    tip: 'Trata el App Secret como una contraseña. Nunca lo compartas ni lo pongas en código del frontend.',
    url: 'https://developers.facebook.com/docs/facebook-login/web',
    urlLabel: 'Dónde se almacena (documentación)',
  },
  {
    id: 5,
    icon: <Settings2 className="size-4" />,
    title: 'Configurar la URL de redirección OAuth',
    subtitle: 'A dónde vuelve Facebook tras autorizar',
    content: [
      'En Configuración avanzada (o en la sección Business Login de tu app), agrega la URL válida de redirección:',
      'https://automation-fb.vercel.app/oauth/callback',
      'Debe coincidir exactamente con META_OAUTH_REDIRECT_URI de tu servidor; si difiere, Facebook rechaza la conexión.',
    ],
    url: 'https://developers.facebook.com/apps/',
    urlLabel: 'Abrir configuración de tu app',
  },
  {
    id: 6,
    icon: <ShieldCheck className="size-4" />,
    title: 'Permisos que solicita el panel',
    subtitle: 'Para publicar, moderar y medir tus páginas',
    scopes: [
      { scope: 'pages_show_list', desc: 'Ver las páginas de la cuenta conectada.' },
      { scope: 'pages_read_engagement', desc: 'Leer comentarios, reacciones y métricas.' },
      { scope: 'pages_manage_posts', desc: 'Publicar posts y programar campañas.' },
      { scope: 'pages_manage_engagement', desc: 'Responder comentarios desde el panel.' },
      { scope: 'pages_manage_metadata', desc: 'Suscribir las páginas a webhooks y renovar permisos.' },
      { scope: 'business_management', desc: 'Acceder a los activos del Portafolio empresarial.' },
    ],
    tip: 'En Modo desarrollo solo las cuentas con rol en la app pueden usarlos; para producción hay que aprobarlos en Revisión de la app.',
    url: 'https://developers.facebook.com/docs/permissions/reference',
    urlLabel: 'Referencia de permisos',
  },
  {
    id: 7,
    icon: <Webhook className="size-4" />,
    title: 'Configurar el Webhook',
    subtitle: 'Recibe comentarios en tiempo real',
    content: [
      'Agrega el producto Webhooks y crea una suscripción.',
      'URL de callback:',
      'https://automation-fb-p6tu.onrender.com/webhooks/meta',
      'Token de verificación: el valor que definiste en META_WEBHOOK_VERIFY_TOKEN del servidor (debe coincidir).',
      'Suscríbete al campo feed para que las páginas envíen los comentarios nuevos.',
    ],
    tip: 'Si tu app está en Modo desarrollo y aún no se publica, los webhooks de producción no llegan; el panel detecta comentarios por sondeo ante un error 403 hasta publicar la app.',
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
      'Se abrirá la ventana de Facebook: revisa los permisos y autoriza.',
      'El panel guarda el token (válido ~60 días). Si expira, reconecta para renovarlo automáticamente.',
    ],
    tip: 'Usa el estado automático de la app: puedes cerrar la ventana y el panel se actualiza solo al conectar.',
  },
  {
    id: 9,
    icon: <Rocket className="size-4" />,
    title: 'Modo desarrollo vs. producción',
    subtitle: 'De tu cuenta personal a cualquier usuario',
    content: [
      'Con la app en Modo desarrollo, conectar tu cuenta (con rol en la app) funciona sin revisión.',
      'Para que cualquier persona conecte su cuenta, publica la app y completa la Revisión: aprueba los permisos con acceso avanzado (Advanced Access) y añade la política de privacidad (ya la tienes en /privacy).',
      'La aplicación de Meta en modo no publicada es la que provoca varios errores 403 en webhooks y sondeos.',
    ],
    tip: 'Recomendado: desarrolla y prueba con tu cuenta, y crea nuevos usuarios desde Control de Acceso antes de abrir la app al público.',
  },
  {
    id: 10,
    icon: <Check className="size-4" />,
    title: '¡Cuenta conectada!',
    subtitle: 'Panel listo para operar',
    content: [
      'Verás la tarjeta de la cuenta de Facebook y el listado de sus páginas.',
      'Ya puedes crear campañas, publicar posts, responder comentarios y ver métricas desde el panel.',
    ],
  },
];

export function TutorialFacebookGuide({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [current, setCurrent] = useState(0);

  if (!open) return null;

  const step = STEPS[current]!;
  const isFirst = current === 0;
  const isLast = current === STEPS.length - 1;
  const progress = ((current + 1) / STEPS.length) * 100;

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
              <p className="text-[11px] text-muted-foreground">Paso {current + 1} de {STEPS.length}</p>
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

        {/* Step selector */}
        <div className="shrink-0 overflow-x-auto px-5 pt-4 pb-1">
          <div className="flex min-w-max items-center gap-1.5">
            {STEPS.map((s, i) => (
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

        {/* Footer */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-t bg-muted/30 px-6 py-4">
          <Button type="button" variant="outline" onClick={() => setCurrent((c) => c - 1)} disabled={isFirst}>
            <ChevronLeft className="mr-1 size-4" />
            Atrás
          </Button>
          <div className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground">
            <FacebookIcon className="size-3.5 text-[#1877F2]" />
            {current + 1} / {STEPS.length}
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
      </div>
    </div>
  );
}