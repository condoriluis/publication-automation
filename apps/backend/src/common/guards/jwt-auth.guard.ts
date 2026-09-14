import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY, AuthUser, RequestWithUser } from '../decorators/auth.decorators';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest() as RequestWithUser;
    const headers = request.headers as unknown as Record<string, string | string[] | undefined>;
    const authHeader = headers['authorization'];
    const token = typeof authHeader === 'string' ? this.extractToken(authHeader) : null;
    if (!token) throw new UnauthorizedException('Falta el token de autenticación');

    try {
      const payload = await this.jwt.verifyAsync<AuthUser>(token, {
        secret: this.config.get<string>('JWT_SECRET'),
      });
      if (payload.type !== 'access') throw new Error('tipo de token no permitido');
      request.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Token inválido o expirado');
    }
  }

  private extractToken(header?: string): string | null {
    const [scheme, token] = (header ?? '').split(' ');
    return scheme?.toLowerCase() === 'bearer' && token ? token : null;
  }
}
