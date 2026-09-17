import { globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

/**
 * ESLint 9 flat config para Next.js.
 * eslint-config-next (v16) ya exporta la configuración en formato flat
 * (arrays de FlatConfig); usarlos directamente evita la doble conversión
 * de FlatCompat, que provocaba una referencia circular en plugins.react.
 */
export default [
  globalIgnores(['**/.next/**', '**/node_modules/**', '**/out/**', '**/dist/**', '**/build/**', '**/next-env.d.ts']),
  ...nextVitals,
  ...nextTypescript,
];