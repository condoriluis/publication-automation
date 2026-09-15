'use client';

import * as React from 'react';
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import { GoogleReCaptchaProvider } from 'react-google-recaptcha-v3';

import { AuthProvider } from '@/contexts/auth-context';

const RECAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY ?? '';

export function LayoutProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <GoogleReCaptchaProvider reCaptchaKey={RECAPTCHA_SITE_KEY} language="es">
        <AuthProvider>{children}</AuthProvider>
      </GoogleReCaptchaProvider>
    </NextThemesProvider>
  );
}
