import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/auth.decorators';

/**
 * Matriz de roles → permisos granulares.
 * Un ADMIN siempre puede todo; los roles inferiores dependen de su fila.
 */
const ROLE_MATRIX: Record<string, string[]> = {
  ADMIN: ['*'],
  MANAGER: [
    'pages:read', 'pages:write',
    'campaigns:read', 'campaigns:write',
    'posts:read', 'posts:write',
    'comments:read', 'comments:write', 'comments:moderate',
    'ai:use', 'dashboard:read', 'audit:read',
  ],
  OPERATOR: [
    'pages:read', 'campaigns:read', 'posts:read',
    'comments:read', 'comments:write', 'ai:use', 'dashboard:read',
  ],
};

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) return true;
    const roles: string[] | undefined = context.switchToHttp().getRequest().user?.roles;
    if (!roles?.length) throw new ForbiddenException('Sin credenciales de usuario');

    for (const role of roles) {
      const granted = ROLE_MATRIX[role];
      if (!granted) continue;
      if (granted.includes('*')) return true;
      if (required.every((p) => granted.includes(p))) return true;
    }
    throw new ForbiddenException('Permisos insuficientes para esta operación');
  }
}
