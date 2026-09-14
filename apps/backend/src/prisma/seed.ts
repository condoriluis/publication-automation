import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { AppLogger } from '../common/logger/app-logger.service';
import { PrismaService } from './prisma.service';

const prisma = new PrismaService(new AppLogger());

async function main(): Promise<void> {
  const rounds = parseInt(process.env.BCRYPT_ROUNDS ?? '12', 10);

  const adminHash = await bcrypt.hash('Admin12345!', rounds);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: { passwordHash: adminHash, isActive: true },
    create: {
      email: 'admin@example.com',
      username: 'admin',
      passwordHash: adminHash,
      displayName: 'Administrador',
      roles: { create: [{ role: Role.ADMIN }] },
    },
  });
  await prisma.userRole.upsert({
    where: { userId_role: { userId: admin.id, role: Role.ADMIN } },
    update: {},
    create: { userId: admin.id, role: Role.ADMIN },
  });
  console.log(`[seed] Admin listo: admin@example.com / Admin12345! (${admin.id})`);

  if (process.env.SEED_DEMO === 'true') {
    const managerHash = await bcrypt.hash('Manager12345!', rounds);
    const manager = await prisma.user.upsert({
      where: { email: 'manager@example.com' },
      update: {},
      create: {
        email: 'manager@example.com',
        username: 'manager',
        passwordHash: managerHash,
        displayName: 'Manager Demo',
        roles: { create: [{ role: Role.MANAGER }] },
      },
    });
    await prisma.userRole.upsert({
      where: { userId_role: { userId: manager.id, role: Role.MANAGER } },
      update: {},
      create: { userId: manager.id, role: Role.MANAGER },
    });

    const operatorHash = await bcrypt.hash('Operator12345!', rounds);
    const operator = await prisma.user.upsert({
      where: { email: 'operator@example.com' },
      update: {},
      create: {
        email: 'operator@example.com',
        username: 'operator',
        passwordHash: operatorHash,
        displayName: 'Operador Demo',
        roles: { create: [{ role: Role.OPERATOR }] },
      },
    });
    await prisma.userRole.upsert({
      where: { userId_role: { userId: operator.id, role: Role.OPERATOR } },
      update: {},
      create: { userId: operator.id, role: Role.OPERATOR },
    });
    console.log('[seed] Usuarios demo: manager@example.com / Manager12345!, operator@example.com / Operator12345!');

    const existingAccount = await prisma.facebookAccount.findFirst({
      where: { facebookUserId: 'demo-fb-user' },
    });
    if (!existingAccount) {
      const account = await prisma.facebookAccount.create({
        data: {
          userId: admin.id,
          facebookUserId: 'demo-fb-user',
          facebookUserName: 'Demo Admin FB',
          accessTokenEncrypted: 'v1:dev:dev:placeholder',
          scopes: [],
        },
      });
      await prisma.page.create({
        data: {
          accountId: account.id,
          userId: admin.id,
          facebookPageId: 'demo-page-1',
          name: 'Página Demo',
          accessTokenEncrypted: 'v1:dev:dev:placeholder',
          followersCount: 0,
        },
      });
      console.log('[seed] Página demo creada (cuenta de Facebook demo)');
    } else {
      console.log('[seed] Cuenta/página demo ya existente, se omite');
    }
  } else {
    console.log('[seed] SEED_DEMO !== true, sin usuarios/páginas demo');
  }
}

main()
  .catch((err) => {
    console.error('[seed] Error:', err);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });