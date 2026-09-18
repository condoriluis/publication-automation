'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowRight, Eye, EyeOff, Loader2 } from 'lucide-react';

import { useAuthAdmin } from '@/contexts/auth-context';
import { fetchSetupStatus, getAccessToken } from '@/lib/api';
import { RecaptchaCheckbox } from '@/components/recaptcha-checkbox';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { MetaLogo } from '@/components/meta-logo';

const REMEMBER_KEY = 'pa.rememberedEmail';
const RECAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY ?? '';

/* Almacenamiento solo-cliente: servidor y hidratación usan la misma snapshot
   (null); tras hidratar se lee el valor real sin romper el SSR (evita #418). */
const subscribe = () => () => {};

function getSavedEmail(): string | null {
  try {
    return localStorage.getItem(REMEMBER_KEY);
  } catch {
    return null;
  }
}

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuthAdmin();
  const [loading, setLoading] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);
  const [rememberMe, setRememberMe] = React.useState(false);
  const [form, setForm] = React.useState({ email: '', password: '' });

  /* Correo recordado: se aplica cuando el cliente ya conoce localStorage. */
  const savedEmail = React.useSyncExternalStore(subscribe, getSavedEmail, () => null);
  const [emailApplied, setEmailApplied] = React.useState(false);
  if (!emailApplied && savedEmail) {
    setEmailApplied(true);
    setRememberMe(true);
    setForm((f) => ({ ...f, email: savedEmail }));
  }

  /* --- reCAPTCHA v2: token + reset controlado por el padre --- */
  const [captchaToken, setCaptchaToken] = React.useState<string | null>(null);
  const [captchaReset, setCaptchaReset] = React.useState(0);

  /* Redirige a /register si la BD está vacía */
  React.useEffect(() => {
    let cancelled = false;
    void fetchSetupStatus().then((requiresSetup) => {
      if (cancelled || !requiresSetup) return;
      if (getAccessToken()) return;
      router.replace('/register');
    });
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    /* Validar token si el widget está activo */
    let recaptchaToken: string | undefined;
    if (RECAPTCHA_SITE_KEY) {
      if (!captchaToken) {
        toast.error("Marca la casilla 'No soy un robot' para continuar.");
        setLoading(false);
        return;
      }
      recaptchaToken = captchaToken;
    }

    try {
      if (rememberMe) {
        localStorage.setItem(REMEMBER_KEY, form.email);
      } else {
        localStorage.removeItem(REMEMBER_KEY);
      }

      await login(form.email, form.password, recaptchaToken);
      toast.success('Bienvenido de vuelta');
      router.push('/dashboard');
    } catch (err) {
      if (RECAPTCHA_SITE_KEY) setCaptchaReset((n) => n + 1);
      toast.error(err instanceof Error ? err.message : 'No se pudo iniciar sesión');
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-primary/10 p-4">
      <div className="w-full max-w-sm animate-fade-up">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-[#1877F2] shadow-lg shadow-[#1877F2]/30">
            <MetaLogo className="size-10" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Publication Automation</h1>
          <p className="text-sm text-muted-foreground">
            Gestiona y automatiza tus publicaciones en Facebook
          </p>
        </div>

        <Card className="animate-scale-in">
          <form onSubmit={onSubmit}>
            <CardHeader>
              <CardTitle>Iniciar sesión</CardTitle>
              <CardDescription>Ingresa tus credenciales para continuar</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Correo</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  autoFocus
                  required
                  placeholder="admin@example.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    placeholder="••••••••"
                    className="pr-10"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="remember"
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(Boolean(checked))}
                />
                <Label htmlFor="remember" className="cursor-pointer text-sm font-normal text-muted-foreground">
                  Recordar ingreso
                </Label>
              </div>

              {RECAPTCHA_SITE_KEY ? (
                <RecaptchaCheckbox onToken={setCaptchaToken} resetSignal={captchaReset} />
              ) : null}
            </CardContent>

            <CardFooter className="pt-2">
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="animate-spin" /> : <ArrowRight />}
                {loading ? 'Entrando…' : 'Entrar'}
              </Button>
            </CardFooter>
          </form>
        </Card>

        <footer className="mt-6 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} Publication Automation</span>
          <span aria-hidden="true" className="text-muted-foreground/50">·</span>
          <Link href="/privacy" className="transition-colors hover:text-foreground underline-offset-4 hover:underline">
            Política de Privacidad
          </Link>
        </footer>
      </div>
    </div>
  );
}