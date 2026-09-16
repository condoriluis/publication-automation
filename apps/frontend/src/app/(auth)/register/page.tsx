'use client';

import * as React from 'react';
import { notFound, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ArrowRight, Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react';

import { useAuthAdmin } from '@/contexts/auth-context';
import { ApiError, fetchSetupStatus, getAccessToken } from '@/lib/api';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MetaLogo } from '@/components/meta-logo';

const EMPTY = { email: '', username: '', password: '', displayName: '' };

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuthAdmin();
  const [checking, setChecking] = React.useState(true);
  const [loading, setLoading] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);
  const [form, setForm] = React.useState(EMPTY);

  React.useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      if (getAccessToken()) {
        router.replace('/dashboard');
        return;
      }
      const requiresSetup = await fetchSetupStatus();
      if (cancelled) return;
      if (!requiresSetup) {
        // El primer administrador ya existe: esta ruta deja de existir.
        notFound();
        return;
      }
      setChecking(false);
    };
    void boot();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await register({
        email: form.email.trim().toLowerCase(),
        username: form.username.trim(),
        password: form.password,
        displayName: form.displayName.trim() || undefined,
      });
      toast.success('Administrador configurado correctamente');
      router.push('/dashboard');
    } catch (err) {
      const status = err instanceof ApiError ? err.status : undefined;
      if (status === 403) {
        toast.error('El registro está cerrado: el sistema ya tiene un administrador.');
        router.replace('/login');
        return;
      }
      toast.error(err instanceof Error ? err.message : 'No se pudo completar el registro');
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-primary/10 p-4">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
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
            Bienvenido. Todo listo para configurar tu primer administrador.
          </p>
        </div>

        <Card className="animate-scale-in">
          <form onSubmit={onSubmit}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="size-5 text-[#1877F2]" /> Configuración inicial
              </CardTitle>
              <CardDescription>
                Este es el paso único de instalación: crea la cuenta administradora del sistema. Una vez creada,
                esta página desaparece.
              </CardDescription>
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
                  placeholder="admin@tuempresa.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="username">Nombre de usuario</Label>
                <Input
                  id="username"
                  type="text"
                  autoComplete="username"
                  required
                  placeholder="admin"
                  pattern="[a-zA-Z0-9_.-]{3,32}"
                  title="De 3 a 32 caracteres (letras, números, _ . -)"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="displayName">Nombre para mostrar (opcional)</Label>
                <Input
                  id="displayName"
                  type="text"
                  maxLength={80}
                  placeholder="Administrador"
                  value={form.displayName}
                  onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    minLength={8}
                    maxLength={72}
                    placeholder="Mínimo 8 caracteres"
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
            </CardContent>

            <CardFooter className="pt-2">
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="animate-spin" /> : <ArrowRight />}
                {loading ? 'Configurando…' : 'Crear administrador'}
              </Button>
            </CardFooter>
          </form>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Publication Automation
        </p>
      </div>
    </div>
  );
}