import { SetMetadata, createParamDecorator, ExecutionContext } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
/** Marca un handler como público (acceso sin token JWT). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const ROLES_KEY = 'roles';
/** Introduce el guard de roles: @Roles('ADMIN', 'MANAGER') */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

export const PERMISSIONS_KEY = 'permissions';
/** Permisos finos sobre recursos: @Permissions('pages:write') */
export const Permissions = (...perms: string[]) => SetMetadata(PERMISSIONS_KEY, perms);

export interface AuthUser {
  sub: string;
  email: string;
  roles: string[];
  type: 'access';
  jti: string;
  iat?: number;
  exp?: number;
}

/** @CurrentUser() → AuthUser | null ; @CurrentUser('sub') → string */
export const CurrentUser = createParamDecorator(
  (field: keyof AuthUser | undefined, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest();
    const user = req.user as AuthUser | undefined;
    return field ? user?.[field] : user;
  },
);

export interface RequestWithUser extends Request {
  user: AuthUser;
}
