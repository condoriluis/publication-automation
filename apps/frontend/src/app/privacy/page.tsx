import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowLeft, ShieldCheck } from 'lucide-react';

import { MetaLogo } from '@/components/meta-logo';

export const metadata: Metadata = {
  title: 'Política de Privacidad',
  description:
    'Política de privacidad de Publication Automation: qué datos recopilamos, cómo los usamos y tus derechos.',
};

const sections: { id: string; title: string; body: React.ReactNode }[] = [
  {
    id: 'resumen',
    title: '1. Resumen',
    body: (
      <p>
        Publication Automation gestiona la publicación e interacción de contenido en páginas de
        Facebook que tú autorizas. Esta política explica qué información procesamos, con qué
        finalidad y los derechos que te corresponden. Al usar la plataforma aceptas este tratamiento.
      </p>
    ),
  },
  {
    id: 'datos',
    title: '2. Datos que recopilamos',
    body: (
      <ul className="list-disc space-y-2 pl-5">
        <li>
          <strong>Cuenta y perfil:</strong> nombre, correo, usuario y roles para operar el panel.
        </li>
        <li>
          <strong>Cuentas y páginas de Facebook:</strong> los identificadores, nombre y permisos que
          autorizas vía el inicio de sesión de Meta (posts, comentarios, métricas).
        </li>
        <li>
          <strong>Contenido que produces:</strong> textos, imágenes, videos y enlaces de tus
          publicaciones y campañas, así como su estado y resultados.
        </li>
        <li>
          <strong>Datos de auditoría:</strong> registro de acciones (autor, IP, fecha y resultado)
          para trazabilidad y seguridad de la cuenta.
        </li>
        <li>
          <strong>Técnicos de sesión:</strong> tokens de acceso y refresco almacenados de forma
          segura y cookies necesarias para mantener tu autenticación.
        </li>
      </ul>
    ),
  },
  {
    id: 'uso',
    title: '3. Cómo usamos la información',
    body: (
      <ul className="list-disc space-y-2 pl-5">
        <li>Ejecutar las publicaciones, programaciones y campañas que configures.</li>
        <li>Leer y responder comentarios en las páginas que autorices.</li>
        <li>Generar métricas, historial y paneles de resultado.</li>
        <li>Garantizar la seguridad: detección de accesos anómalos, auditoría y abuse.</li>
        <li>Cumplir obligaciones legales. Nunca vendemos tus datos a terceros.</li>
      </ul>
    ),
  },
  {
    id: 'facebook',
    title: '4. Permisos de Facebook y revocación',
    body: (
      <p>
        Solo accedemos a las páginas y permisos que tú consientes mediante el diálogo de autorización
        de Meta. Puedes revisar y revocar el acceso en cualquier momento desde{' '}
        <strong>Configuración de la página → Integraciones</strong> o desde tu cuenta de Facebook
        (&quot;Apps y sitios web&quot;). Al revocarlos, la plataforma deja de operar esas páginas.
      </p>
    ),
  },
  {
    id: 'seguridad',
    title: '5. Almacenamiento y seguridad',
    body: (
      <ul className="list-disc space-y-2 pl-5">
        <li>Las contraseñas se guardan cifradas (bcrypt); nunca en texto plano.</li>
        <li>Los tokens de Facebook se almacenan cifrados con clave derivada (AES).</li>
        <li>Las sesiones usan tokens firmados con expiración corta y refresco rotativo.</li>
        <li>Transporte íntegro bajo HTTPS, CSP estricta y protección contra CSRF/XSS.</li>
        <li>Los datos residen en proveedores con certificaciones de seguridad (Supabase, Render, Vercel).</li>
      </ul>
    ),
  },
  {
    id: 'retencion',
    title: '6. Retención y eliminación',
    body: (
      <p>
        Conservamos la información mientras tu cuenta esté activa y sea necesaria para el servicio.
        Puedes solicitar la exportación o eliminación de tus datos y los de tus páginas; el
        procesamiento se completa en un máximo de 30 días, salvo obligación legal de retención.
      </p>
    ),
  },
  {
    id: 'terceros',
    title: '7. Servicios de terceros',
    body: (
      <p>
        La operación del servicio depende de proveedores de infraestructura (hosting y base de
        datos), de la API oficial de Facebook y de reCAPTCHA de Google para proteger el ingreso.
        Cada uno aplica su propia política de privacidad sobre los datos que procesa en nuestro
        nombre.
      </p>
    ),
  },
  {
    id: 'derechos',
    title: '8. Tus derechos',
    body: (
      <p>
        Tienes derecho a acceder, rectificar, suprimir, limitar y oponerte al tratamiento de tus
        datos, así como a la portabilidad. Puedes ejercerlos escribiéndonos al correo oficial del
        servicio indicando tu cuenta. También puedes presentar una reclamación ante la autoridad de
        protección de datos de tu país.
      </p>
    ),
  },
  {
    id: 'contacto',
    title: '9. Contacto',
    body: (
      <p>
        Para cualquier consulta sobre esta política o el tratamiento de tus datos, contáctanos a
        través del correo de soporte del servicio. Las actualizaciones de esta política se publicarán
        en esta misma página.
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <div className="flex min-h-screen justify-center bg-gradient-to-br from-background via-background to-primary/10 p-4 py-10">
      <div className="w-full max-w-3xl animate-fade-up">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-[#1877F2] shadow-lg shadow-[#1877F2]/30">
            <MetaLogo className="size-10" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Publication Automation</h1>
          <p className="text-sm text-muted-foreground">
            Gestiona y automatiza tus publicaciones en Facebook
          </p>
        </div>

        <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
          <div className="border-b bg-muted/30 px-6 py-6 sm:px-10">
            <div className="flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#1877F2]/10">
                <ShieldCheck className="size-5 text-[#1877F2]" />
              </div>
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-foreground">
                  Política de Privacidad
                </h2>
                <p className="text-xs text-muted-foreground">Última actualización: septiembre de 2026</p>
              </div>
            </div>
          </div>

          <div className="space-y-6 px-6 py-6 sm:px-10 sm:py-8">
            {sections.map((s) => (
              <section key={s.id} className="space-y-2">
                <h3 className="text-sm font-semibold tracking-tight text-foreground">{s.title}</h3>
                <div className="text-sm leading-relaxed text-muted-foreground">{s.body}</div>
              </section>
            ))}
          </div>
        </div>

        <div className="mt-6 flex justify-center">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Volver al inicio de sesión
          </Link>
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Publication Automation · Todos los derechos reservados
        </p>
      </div>
    </div>
  );
}