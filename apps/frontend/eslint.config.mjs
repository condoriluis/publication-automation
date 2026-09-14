import { FlatCompat } from '@eslint/eslintrc';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * ESLint 9 flat config para Next.js: traducimos las presets legacy
 * "next/core-web-vitals" y "next/typescript" a FlatConfigArray.
 */
const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url)),
});

export default [
  { ignores: ['**/.next/**', '**/node_modules/**', '**/out/**', '**/dist/**', '**/build/**', '**/next-env.d.ts'] },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
];