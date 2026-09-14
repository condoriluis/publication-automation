import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const EMAIL = process.env.SEED_ADMIN_EMAIL || 'admin@example.com';
const USERNAME = process.env.SEED_ADMIN_USERNAME || 'admin';
const PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'Admin12345!';

async function main() {
  const existing = await prisma.user.findFirst({
    where: { OR: [{ email: EMAIL }, { username: USERNAME }] },
  });

  if (existing) {
    console.log(`⚠️  Usuario admin ya existe (${existing.email}) — seed omitido.`);
    return;
  }

  const rounds = Number(process.env.BCRYPT_ROUNDS || 12);
  const passwordHash = await bcrypt.hash(PASSWORD, rounds);

  await prisma.user.create({
    data: {
      email: EMAIL,
      username: USERNAME,
      passwordHash,
      displayName: 'Administrador',
      isActive: true,
      roles: {
        create: [{ role: Role.ADMIN }],
      },
    },
  });

  console.log(`✅ Usuario administrador creado: ${EMAIL} / ${PASSWORD}`);
}

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
