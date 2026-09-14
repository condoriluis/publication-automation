'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, Loader2, XCircle, Link2 } from 'lucide-react';

import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

const OAUTH_RESULT_CHANNEL = 'pa-fb-oauth';
const CLOSE_DELAY_MS = 1500;

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = React.useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    if (!code || !state) {
      setStatus('error');
      setError('Faltan los parámetros de autorización. Vuelve a intentar conectar la cuenta.');
      return;
    }

    let closed = false;
    (async () => {
      try {
        await api.get(`/facebook/oauth/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`);
        setStatus('success');
        try {
          new BroadcastChannel(OAUTH_RESULT_CHANNEL).postMessage({ type: 'connected' });
        } catch {
          /* sin soporte de BroadcastChannel: el usuario cierra y reintenta */
        }
        window.setTimeout(() => {
          window.close();
          closed = true;
        }, CLOSE_DELAY_MS);
      } catch (e) {
        setStatus('error');
        setError(e instanceof Error ? e.message : 'No se pudo conectar la cuenta de Facebook');
      }
    })();
  }, [searchParams]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-primary/10 p-4">
      <Card className="w-full max-w-sm animate-scale-in">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            {status === 'loading' ? (
              <Loader2 className="size-6 animate-spin" />
            ) : status === 'success' ? (
              <CheckCircle2 className="size-6" />
            ) : (
              <XCircle className="size-6" />
            )}
          </div>
          <CardTitle>
            {status === 'loading' ? 'Conectando cuenta…' : status === 'success' ? '¡Cuenta conectada!' : 'Error al conectar'}
          </CardTitle>
          <CardDescription>
            {status === 'loading'
              ? 'Canjeando el código de acceso con Facebook…'
              : status === 'success'
                ? 'Tu cuenta de Facebook quedó vinculada correctamente. Esta ventana se cerrará sola.'
                : 'No se pudo completar la conexión con Facebook.'}
          </CardDescription>
        </CardHeader>
        {status === 'error' && error ? (
          <CardContent className="text-center text-sm text-destructive">{error}</CardContent>
        ) : null}
        {status === 'success' ? (
          <CardContent className="flex justify-center">
            <Button onClick={() => window.close()}>
              <Link2 className="mr-2 size-4" />
              Cerrar esta ventana
            </Button>
          </CardContent>
        ) : null}
        {status === 'error' ? (
          <CardFooter className="justify-center pt-2">
            <Button variant="outline" onClick={() => router.push('/pages')}>
              Volver a páginas
            </Button>
          </CardFooter>
        ) : null}
      </Card>
    </div>
  );
}

export default function OAuthCallbackPage() {
  return (
    <React.Suspense fallback={<div className="flex min-h-screen items-center justify-center">Cargando…</div>}>
      <CallbackContent />
    </React.Suspense>
  );
}