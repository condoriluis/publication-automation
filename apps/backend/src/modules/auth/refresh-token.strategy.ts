import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Request } from 'express';
import { AuthUser } from '../../common/decorators/auth.decorators';

@Injectable()
export class RefreshTokenStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(config: ConfigService) {
    const secret = config.get<string>('jwt.refreshSecret', { infer: true })!;
    super({
      jwtFromRequest: ExtractJwt.fromBodyField('refreshToken'),
      ignoreExpiration: false,
      secretOrKey: secret,
      passReqToCallback: true,
    } as unknown as ConstructorParameters<typeof Strategy>[0]);
  }

  async validate(req: Request, payload: AuthUser | { type?: string }): Promise<AuthUser> {
    if (!payload || payload.type !== 'refresh') {
      throw new UnauthorizedException('Token de refresco inválido');
    }
    return payload as AuthUser;
  }
}