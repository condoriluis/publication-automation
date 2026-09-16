import type { NextConfig } from 'next';
import path from 'node:path';

/**
 * URL base de la API (contrato del backend).
 * Se inyecta en NEXT_PUBLIC_API_URL en build/runtime, con fallback local.
 */
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

/**
 * Origen permitido en connect-src: en producción la API puede estar en el
 * mismo dominio (self) o en un subdominio/externo, por lo que se usa solo el
 * origen (sin path) para evitar bloqueos de CSP por prefijos de ruta.
 */
const apiSource = /^https?:\/\//.test(apiUrl) ? new URL(apiUrl).origin : 'self';

/**
 * CSP básico de referencia.
 * Se permiten los dominios de Google necesarios para reCAPTCHA v2
 * (www.google.com y www.gstatic.com). Mientras exista 'unsafe-inline'/'unsafe-eval'
 * será una CSP de partida; se puede afinar después perdiendo esos comodines.
 */
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.google.com https://www.gstatic.com",
  "style-src 'self' 'unsafe-inline' https://www.gstatic.com",
  "img-src 'self' blob: data: https:",
  "font-src 'self' data:",
  `connect-src 'self' ${apiSource} https:`,
  "frame-src 'self' https://www.facebook.com https://www.google.com https://www.gstatic.com",
].join('; ');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: path.join(__dirname, '..', '..'),
  env: {
    NEXT_PUBLIC_API_URL: apiUrl,
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Content-Security-Policy', value: csp },
        ],
      },
    ];
  },
};

export default nextConfig;