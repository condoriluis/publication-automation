import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, Role, User, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { AppLogger } from '../../common/logger/app-logger.service';
import { Paginated, PaginationHelper, PaginationOptions } from '../../common/pagination/pagination.helper';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ROLE_MATRIX } from './users.constants';

export type PublicUser = {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  isActive: boolean;
  roles: string[];
  createdAt: string;
  updatedAt: string;
};

export type UserWithRoles = User & { roles: UserRole[] };

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly helper: PaginationHelper,
    private readonly logger: AppLogger,
  ) {}

  private get rounds(): number {
    return this.config.get<number>('bcryptRounds', { infer: true });
  }

  async findAll(options: PaginationOptions): Promise<Paginated<PublicUser>> {
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        include: { roles: true },
        orderBy: { createdAt: 'desc' },
        skip: options.skip,
        take: options.limit,
      }),
      this.prisma.user.count(),
    ]);
    return this.helper.buildPaginated<PublicUser>(rows.map((u) => this.toPublic(u)), total, options);
  }

  async findById(id: string): Promise<UserWithRoles | null> {
    return this.prisma.user.findUnique({ where: { id }, include: { roles: true } });
  }

  async findByEmail(email: string): Promise<UserWithRoles | null> {
    return this.prisma.user.findUnique({ where: { email }, include: { roles: true } });
  }

  async findByUsername(username: string): Promise<UserWithRoles | null> {
    return this.prisma.user.findUnique({ where: { username }, include: { roles: true } });
  }

  async findByLogin(email?: string, username?: string): Promise<UserWithRoles | null> {
    if (email) return this.findByEmail(email);
    if (username) return this.findByUsername(username);
    return null;
  }

  async getProfile(id: string): Promise<PublicUser> {
    const user = await this.findById(id);
    if (!user) throw new NotFoundException('Usuario no encontrado');
    return this.toPublic(user);
  }

  async create(dto: CreateUserDto, roles: string[] = [Role.OPERATOR]): Promise<UserWithRoles> {
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email: dto.email }, { username: dto.username }] },
    });
    if (existing) throw new ConflictException('El email o username ya está registrado');
    const passwordHash = await bcrypt.hash(dto.password, this.rounds);
    const finalRoles = this.resolveRoles(roles);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        username: dto.username,
        passwordHash,
        displayName: dto.displayName ?? dto.username,
        isActive: dto.isActive ?? true,
        roles: { create: finalRoles.map((role) => ({ role })) },
      },
      include: { roles: true },
    });
    this.logger.log(`Usuario creado: ${user.email}`, 'Users');
    return user;
  }

  async update(id: string, dto: UpdateUserDto): Promise<PublicUser> {
    const existing = await this.findById(id);
    if (!existing) throw new NotFoundException('Usuario no encontrado');

    // Unicidad de credenciales frente a OTROS usuarios.
    if (dto.email !== undefined || dto.username !== undefined) {
      const conflict = await this.prisma.user.findFirst({
        where: {
          id: { not: id },
          OR: [{ email: dto.email }, { username: dto.username }],
        },
      });
      if (conflict) throw new ConflictException('El email o username ya está en uso por otro usuario');
    }

    // Seguridad: nunca dejar al sistema sin al menos un ADMIN activo.
    const isAdmin = this.hasRole(existing, Role.ADMIN);
    const removesAdminRole =
      Array.isArray(dto.roles) && !this.resolveRoles(dto.roles.map((r) => r as string)).includes(Role.ADMIN);
    if (isAdmin && existing.isActive && (dto.isActive === false || removesAdminRole)) {
      await this.assertNotLastActiveAdmin(id);
    }

    const data: Prisma.UserUpdateInput = {
      email: dto.email,
      username: dto.username,
      displayName: dto.displayName,
      bio: dto.bio,
      avatarUrl: dto.avatarUrl,
      isActive: dto.isActive,
      ...(dto.password ? { passwordHash: await bcrypt.hash(dto.password, this.rounds) } : {}),
    };

    return this.prisma.$transaction(async (tx) => {
      if (dto.roles) {
        await tx.userRole.deleteMany({ where: { userId: id } });
        const newRoles = this.resolveRoles(dto.roles.map((r) => r as string));
        await tx.userRole.createMany({ data: newRoles.map((role) => ({ userId: id, role })) });
      }
      const updated = await tx.user.update({ where: { id }, data, include: { roles: true } });
      return this.toPublic(updated);
    });
  }

  async remove(id: string): Promise<{ success: boolean }> {
    const existing = await this.findById(id);
    if (!existing) throw new NotFoundException('Usuario no encontrado');
    if (this.hasRole(existing, Role.ADMIN) && existing.isActive) {
      await this.assertNotLastActiveAdmin(id);
    }
    await this.prisma.user.delete({ where: { id } });
    this.logger.log(`Usuario eliminado: ${existing.email}`, 'Users');
    return { success: true };
  }

  async updateLastLogin(id: string): Promise<void> {
    await this.prisma.user.update({ where: { id }, data: { lastLoginAt: new Date() } });
  }

  toPublic(user: UserWithRoles): PublicUser {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      isActive: user.isActive,
      roles: user.roles.map((r) => r.role as string),
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }

  private resolveRoles(roles: string[]): Role[] {
    const source = roles.length ? roles : [Role.OPERATOR];
    const valid = Array.from(new Set(source)).filter((r): r is Role => r in ROLE_MATRIX);
    return valid.length ? valid : [Role.OPERATOR];
  }

  private hasRole(user: UserWithRoles, role: Role): boolean {
    return user.roles.some((r) => r.role === role);
  }

  /** Garantiza que no se deja el sistema sin al menos un administrador activo. */
  private async assertNotLastActiveAdmin(excludeId: string): Promise<void> {
    const otherAdmins = await this.prisma.user.count({
      where: {
        id: { not: excludeId },
        isActive: true,
        roles: { some: { role: Role.ADMIN } },
      },
    });
    if (otherAdmins === 0) {
      throw new BadRequestException('No se puede dejar el sistema sin al menos un administrador activo');
    }
  }
}