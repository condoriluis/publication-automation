import Link from 'next/link';
import { Compass, LayoutDashboard, Link2, Search, Users } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { MetaLogo } from '@/components/meta-logo';

const QUICK_LINKS = [
  { title: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { title: 'Páginas', href: '/pages', icon: Link2 },
  { title: 'Control de Acceso', href: '/users', icon: Users },
];

export default function NotFound() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-background via-background to-primary/10 p-4">
      {/* Decorative background */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 -right-24 size-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -bottom-40 -left-24 size-96 rounded-full bg-accent/60 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.35] dark:opacity-[0.15]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, var(--border) 1px, transparent 0)',
            backgroundSize: '48px 48px',
            maskImage: 'radial-gradient(ellipse at center, black 0%, transparent 70%)',
          }}
        />
      </div>

      <div className="relative z-10 flex w-full max-w-xl animate-fade-up flex-col items-center text-center">
        <Link href="/dashboard" className="mb-10 inline-flex items-center gap-2.5">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-[#1877F2] shadow-lg shadow-[#1877F2]/30">
            <MetaLogo className="size-6" />
          </div>
          <span className="text-sm font-semibold tracking-tight text-foreground/80 hidden sm:inline">
            Publication Automation
          </span>
        </Link>

        <p className="text-sm font-semibold uppercase tracking-[0.35em] text-primary">
          Error 404
        </p>
        <h1
          className="mt-4 animate-scale-in bg-gradient-to-br from-primary via-primary/80 to-accent-foreground bg-clip-text text-8xl font-black leading-none tracking-tight text-transparent sm:text-9xl"
          style={{ animationDelay: '120ms' }}
        >
          404
        </h1>

        {/* Copy */}
        <h2 className="mt-6 text-2xl font-bold tracking-tight sm:text-3xl">
          Página no encontrada
        </h2>
        <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base">
          La página que buscas no existe, fue movida o nunca estuvo aquí. Verifica
          la dirección o vuelve al panel para continuar con tus campañas.
        </p>

        {/* Actions */}
        <div
          className="mt-8 flex w-full animate-fade-up flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center"
          style={{ animationDelay: '200ms' }}
        >
          <Button asChild size="lg" className="shadow-lg shadow-primary/20">
            <Link href="/dashboard">
              <LayoutDashboard />
              Volver al inicio
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/pages">
              <Compass />
              Explorar páginas
            </Link>
          </Button>
        </div>

        {/* Quick links */}
        <div
          className="mt-10 w-full max-w-md animate-fade-up border-t border-border pt-6"
          style={{ animationDelay: '280ms' }}
        >
          <p className="mb-3 flex items-center justify-center gap-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
            <Search className="size-3.5" />
            Destinos útiles
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {QUICK_LINKS.map(({ title, href, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="group inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5 text-sm font-medium text-foreground/80 transition-colors hover:border-primary/40 hover:bg-accent hover:text-accent-foreground"
              >
                <Icon className="size-4 text-primary transition-transform group-hover:scale-110" />
                {title}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <p className="relative z-10 mt-10 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Publication Automation
      </p>
    </div>
  );
}