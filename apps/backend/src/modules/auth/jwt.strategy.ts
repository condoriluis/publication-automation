import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthUser } from '../../common/decorators/auth.decorators';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('JWT_SECRET', { infer: true })!,
    });
  }

  async validate(payload: AuthUser | { type?: string }): Promise<AuthUser> {
    if (!payload || payload.type !== 'access') {
      throw new UnauthorizedException('Token no válido');
    }
    return payload as AuthUser;
  }
}