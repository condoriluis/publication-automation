export const ROLE_MATRIX: Record<string, string[]> = {
  ADMIN: ['*'],
  MANAGER: [
    'pages:read',
    'pages:write',
    'campaigns:read',
    'campaigns:write',
    'posts:read',
    'posts:write',
    'comments:read',
    'comments:write',
    'comments:moderate',
    'ai:use',
    'dashboard:read',
    'audit:read',
  ],
  OPERATOR: ['pages:read', 'campaigns:read', 'posts:read', 'comments:read', 'ai:use', 'dashboard:read'],
};

export const DEFAULT_ROLE = 'OPERATOR';