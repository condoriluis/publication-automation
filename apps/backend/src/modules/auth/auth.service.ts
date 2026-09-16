import { BadRequestException, ConflictException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { LogCategory, Prisma, Role } from '@prisma/client';
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

const RECAPTCHA_VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify';
/** Puntuación mínima de reCAPTCHA v3. Por debajo se considera bot (0 = bot, 1 = humano). */
const RECAPTCHA_MIN_SCORE = 0.5;

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

  private get recaptchaSecret(): string | undefined {
    return this.config.get<string>('RECAPTCHA_SECRET_KEY');
  }

  /**
   * Valida el token de reCAPTCHA v3 contra la API de Google.
   * Solo se aplica en producción o si el secret está configurado.
   * Lanza BadRequestException si el token es inválido o el score es bajo.
   */
  private async verifyRecaptcha(token: string | undefined): Promise<void> {
    const secret = this.recaptchaSecret;
    if (!secret || this.config.get('NODE_ENV') !== 'production') return;

    if (!token) {
      throw new BadRequestException('Se requiere validación de reCAPTCHA');
    }

    const params = new URLSearchParams({ secret, response: token });
    const res = await fetch(`${RECAPTCHA_VERIFY_URL}?${params.toString()}`, { method: 'POST' });

    if (!res.ok) {
      this.logger.warn('reCAPTCHA verify request failed', 'Auth');
      throw new BadRequestException('Error al verificar reCAPTCHA');
    }

    const data = (await res.json()) as { success: boolean; score: number; 'error-codes'?: string[] };

    if (!data.success || data.score < RECAPTCHA_MIN_SCORE) {
      this.logger.warn(`reCAPTCHA failed: success=${data.success} score=${data.score}`, 'Auth');
      throw new BadRequestException('Verificación de seguridad fallida. Inténtalo de nuevo.');
    }
  }

  /**
   * ¿El sistema requiere configuración inicial? `true` solo si no existe ningún usuario.
   * El frontend lo usa para mostrar la página de creación del primer administrador.
   */
  async setupStatus(): Promise<{ requiresSetup: boolean }> {
    const count = await this.prisma.user.count();
    return { requiresSetup: count === 0 };
  }

  /**
   * Registro del PRIMER usuario (bootstrap del administrador).
   * Solo es válido mientras la base está vacía; en cuanto existe un usuario la ruta
   * queda cerrada (403). El chequeo corre dentro de una transacción Serializable para
   * evitar la carrera de dos registros simultáneos (mismo patrón que ai-engineering).
   */
  async register(dto: RegisterDto, ctx: AuthContext): Promise<AuthResult> {
    let user: UserWithRoles;
    try {
      user = await this.prisma.$transaction(
        async (tx) => {
          const count = await tx.user.count();
          if (count > 0) {
            throw new ForbiddenException('El registro está cerrado. El sistema ya tiene un administrador configurado.');
          }
          return tx.user.create({
            data: {
              email: dto.email,
              username: dto.username,
              passwordHash: await bcrypt.hash(dto.password, this.rounds),
              displayName: dto.displayName ?? dto.username,
              isActive: true,
              roles: { create: [{ role: Role.ADMIN }] },
            },
            include: { roles: true },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Ya existe una cuenta con ese email o username');
      }
      throw error;
    }
    const session = await this.createSession(user);
    await this.audit('auth.register', user.id, ctx, { email: user.email });
    return { user: this.toPublic(user), tokens: session.tokens };
  }

  async login(dto: LoginDto, ctx: AuthContext): Promise<AuthResult> {
    if (!dto.email && !dto.username) {
      throw new BadRequestException('Indica email o username');
    }

    await this.verifyRecaptcha(dto.recaptchaToken);

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