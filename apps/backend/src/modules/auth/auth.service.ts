import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { LogCategory, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { CryptoService } from '../../common/crypto/crypto.service';
import { AppLogger } from '../../common/logger/app-logger.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { PublicUser, UserWithRoles, UsersService } from '../users/users.service';

export interface AuthContext {
  ip?: string;
  userAgent?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResult {
  user: PublicUser;
  tokens: AuthTokens;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly crypto: CryptoService,
    private readonly auditService: AuditService,
    private readonly logger: AppLogger,
  ) {}

  private get secret(): string {
    return this.config.get<string>('JWT_SECRET', { infer: true })!;
  }

  private get expiresIn(): string {
    return this.config.get<string>('JWT_EXPIRES_IN', { infer: true })!;
  }

  private get refreshSecret(): string {
    return this.config.get<string>('jwt.refreshSecret', { infer: true })!;
  }

  private get refreshExpiresIn(): string {
    return this.config.get<string>('jwt.refreshExpiresIn', { infer: true })!;
  }

  private get rounds(): number {
    return this.config.get<number>('bcryptRounds', { infer: true });
  }

  async register(dto: RegisterDto, ctx: AuthContext): Promise<AuthResult> {
    const user = await this.users.create(dto, [Role.OPERATOR]);
    const session = await this.createSession(user);
    await this.audit('auth.register', user.id, ctx, { email: user.email });
    return { user: this.toPublic(user), tokens: session.tokens };
  }

  async login(dto: LoginDto, ctx: AuthContext): Promise<AuthResult> {
    if (!dto.email && !dto.username) {
      throw new BadRequestException('Indica email o username');
    }
    const user = await this.users.findByLogin(dto.email, dto.username);
    if (!user) {
      await this.audit('auth.login.failed', null, ctx, { email: dto.email, username: dto.username });
      throw new UnauthorizedException('Credenciales inválidas');
    }
    if (!user.isActive) {
      throw new UnauthorizedException('Cuenta desactivada');
    }
    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      await this.audit('auth.login.failed', user.id, ctx);
      throw new UnauthorizedException('Credenciales inválidas');
    }
    await this.users.updateLastLogin(user.id);
    const session = await this.createSession(user);
    await this.audit('auth.login', user.id, ctx, { email: user.email });
    return { user: this.toPublic(user), tokens: session.tokens };
  }

  async refresh(refreshToken: string, ctx: AuthContext): Promise<AuthResult> {
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.crypto.hash(refreshToken) },
    });
    if (!record) throw new UnauthorizedException('Refresh token inválido');
    if (record.revoked) throw new UnauthorizedException('Refresh token revocado');
    if (record.expiresAt.getTime() <= Date.now()) {
      await this.prisma.refreshToken.update({ where: { id: record.id }, data: { revoked: true } });
      throw new UnauthorizedException('Refresh token expirado');
    }
    const user = await this.users.findById(record.userId);
    if (!user || !user.isActive) throw new UnauthorizedException('Usuario no disponible');
    const session = await this.createSession(user);
    await this.prisma.refreshToken.update({
      where: { id: record.id },
      data: { revoked: true, replacedByTokenId: session.refreshId },
    });
    await this.audit('auth.refresh', user.id, ctx);
    return { user: this.toPublic(user), tokens: session.tokens };
  }

  async logout(refreshToken: string, ctx: AuthContext): Promise<{ success: boolean }> {
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: this.crypto.hash(refreshToken) },
    });
    if (record && !record.revoked) {
      await this.prisma.refreshToken.update({ where: { id: record.id }, data: { revoked: true } });
      await this.audit('auth.logout', record.userId, ctx);
    }
    return { success: true };
  }

  async me(userId: string): Promise<PublicUser> {
    return this.users.getProfile(userId);
  }

  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
    ctx: AuthContext,
  ): Promise<{ success: boolean }> {
    const user = await this.users.findById(userId);
    if (!user) throw new UnauthorizedException('Usuario no encontrado');
    const valid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Contraseña actual incorrecta');
    const passwordHash = await bcrypt.hash(dto.newPassword, this.rounds);
    await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    await this.audit('auth.change_password', userId, ctx);
    return { success: true };
  }

  private async createSession(user: UserWithRoles): Promise<{ tokens: AuthTokens; refreshId: string }> {
    const base = { sub: user.id, email: user.email, roles: user.roles.map((r) => r.role as string) };
    const accessToken = await this.jwt.signAsync(
      { ...base, type: 'access', jti: this.crypto.randomToken(12) },
      { secret: this.secret, expiresIn: this.expiresIn as JwtSignOptions['expiresIn'] },
    );
    const refreshToken = await this.jwt.signAsync(
      { ...base, type: 'refresh', jti: this.crypto.randomToken(12) },
      { secret: this.refreshSecret, expiresIn: this.refreshExpiresIn as JwtSignOptions['expiresIn'] },
    );
    const decoded = this.jwt.decode<{ exp?: number }>(refreshToken);
    const expiration = decoded?.exp
      ? new Date(decoded.exp * 1000)
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const record = await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: this.crypto.hash(refreshToken),
        expiresAt: expiration,
      },
    });
    return { tokens: { accessToken, refreshToken }, refreshId: record.id };
  }

  private toPublic(user: UserWithRoles): PublicUser {
    return this.users.toPublic(user);
  }

  private async audit(
    action: string,
    userId: string | null,
    ctx: AuthContext,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    this.logger.log(`auth action=${action} userId=${userId ?? 'system'}`, 'Auth');
    await this.auditService.record({
      action,
      category: LogCategory.AUTH,
      userId: userId ?? undefined,
      metadata,
      ip: ctx.ip,
      userAgent: ctx.userAgent,
    });
  }
}