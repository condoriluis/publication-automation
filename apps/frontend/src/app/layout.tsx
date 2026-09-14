import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from 'sonner';

import { cn } from '@/lib/utils';
import { LayoutProvider } from '@/components/layout-provider';
import '@/app/globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });

export const metadata: Metadata = {
  title: {
    default: 'Publication Automation',
    template: '%s · Publication Automation',
  },
  description:
    'Automatización ética de publicación e interacción en páginas de Facebook: campañas, IA y auditoría en un panel.',
  keywords: ['facebook', 'automatización', 'publicaciones', 'gestión de campañas', 'IA'],
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f8fafc' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0c12' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" suppressHydrationWarning className={inter.variable}>
      <body className={cn('min-h-screen bg-background font-sans antialiased')}>
        <LayoutProvider>{children}</LayoutProvider>
        <Toaster
          position="top-right"
          richColors
          closeButton
          toastOptions={{ className: 'font-sans' }}
        />
      </body>
    </html>
  );
}
