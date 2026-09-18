import 'reflect-metadata';
import { PrismaClient } from '@prisma/client';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { config as loadEnv } from 'dotenv';

/**
 * Migración puntual de cifrado en reposo.
 *
 * Los tokens de Facebook y las claves de IA se cifran con AES-256-GCM usando
 * TOKEN_ENCRYPTION_KEY. Versiones anteriores persistían secretos con una clave
 * de fallback pública/por defecto. Este script los re-cifra en el sitio con la
 * clave actual (TOKEN_ENCRYPTION_KEY) y es IDEMPOTENTE: las filas que ya se
 * descifran con la clave actual se omiten.
 *
 * USO:
 *   tsx scripts/rekey-encryption.ts                  # solo clave legacy de desarrollo
 *   tsx scripts/rekey-encryption.ts --old-key <H64>  # añade una clave antigua (hex)
 *   tsx scripts/rekey-encryption.ts --dry-run        # solo reporta, sin escribir
 *
 * Precaución: respaldar la BD antes y ejecutar durante una ventana de mantenimiento.
 */

loadEnv({ path: '.env' });

const prisma = new PrismaClient();

interface SecretRow {
  id: string;
  encrypted?: string | null;
}

type ModelWithSecrets = {
  findMany: () => Promise<Array<Record<string, unknown>>>;
  update: (args: { where: { id: string }; data: Record<string, string> }) => Promise<unknown>;
}

const HEX_KEY = /^[0-9a-fA-F]{64}$/;

function currentKeyHex(): string {
  const token = process.env.TOKEN_ENCRYPTION_KEY ?? '';
  if (!HEX_KEY.test(token)) {
    console.error('FALTA TOKEN_ENCRYPTION_KEY (hex de 64) en el entorno: abortando.');
    process.exit(1);
  }
  return token;
}

function legacyKeys(): Buffer[] {
  const candidates: Buffer[] = [];
  // Claves públicas de desarrollo que usaban versiones anteriores del código
  // al cifrar sin pasar hexKey (FacebookService / AIConfigService).
  candidates.push(Buffer.from('pa-dev-key-change-me-32b-security', 'utf8').subarray(0, 32));
  const argIndex = process.argv.indexOf('--old-key');
  const oldHex = argIndex >= 0 ? process.argv[argIndex + 1] : undefined;
  if (oldHex && HEX_KEY.test(oldHex)) candidates.push(Buffer.from(oldHex, 'hex'));
  return candidates;
}

function decryptWith(key: Buffer, payload: string): string | null {
  const parts = payload.split(':');
  if (parts.length !== 4 || parts[0] !== 'v1') return null;
  const [, ivB64, tagB64, dataB64] = parts;
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
    const out = Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64url')), decipher.final()]);
    return out.toString('utf8');
  } catch {
    return null;
  }
}

function encryptWith(key: Buffer, plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('base64url')}:${tag.toString('base64url')}:${encrypted.toString('base64url')}`;
}

async function rekeyColumn(
  delegate: ModelWithSecrets,
  field: string,
  dryRun: boolean,
  oldKeys: Buffer[],
  newKey: Buffer,
): Promise<void> {
  const rows = await delegate.findMany();
  let migrated = 0;
  let fresh = 0;
  let unrecoverable = 0;

  for (const row of rows) {
    const id = row.id as string;
    const value = row[field] as string | null | undefined;
    if (!value) continue;

    if (decryptWith(newKey, value) !== null) {
      fresh += 1;
      continue;
    }

    let plain: string | null = null;
    for (const candidate of oldKeys) {
      if (candidate.equals(newKey)) continue;
      const result = decryptWith(candidate, value);
      if (result !== null) {
        plain = result;
        break;
      }
    }

    if (plain === null) {
      unrecoverable += 1;
      console.warn(`  ! id=${row.id} (${field}): no se descifró con ninguna clave antigua`);
      continue;
    }

    migrated += 1;
    if (!dryRun) {
      await delegate.update({ where: { id }, data: { [field]: encryptWith(newKey, plain) } });
    }
  }

  console.log(`  - ${field}: ${migrated} re-cifrados, ${fresh} ya correctos, ${unrecoverable} no recuperables${dryRun ? ' (DRY-RUN)' : ''}`);
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const newKey = Buffer.from(currentKeyHex(), 'hex');
  const oldKeys = legacyKeys();

  console.log(`Re-cifrando secretos con TOKEN_ENCRYPTION_KEY${dryRun ? ' en modo simulación' : ''}...`);

  await rekeyColumn(prisma.facebookAccount as unknown as ModelWithSecrets, 'accessTokenEncrypted', dryRun, oldKeys, newKey);
  await rekeyColumn(prisma.facebookAccount as unknown as ModelWithSecrets, 'refreshTokenEncrypted', dryRun, oldKeys, newKey);
  await rekeyColumn(prisma.page as unknown as ModelWithSecrets, 'accessTokenEncrypted', dryRun, oldKeys, newKey);
  await rekeyColumn(prisma.aIConfig as unknown as ModelWithSecrets, 'apiKeyEncrypted', dryRun, oldKeys, newKey);

  if (!dryRun) console.log('Migración completada.');
  else {
    console.log('DRY-RUN finalizado. Repite sin --dry-run para aplicar.');
    console.log('Recordatorio: en caso de duda, reconecta la cuenta (OAuth) en vez de conservar el token.');
  }
}

main().finally(() => prisma.$disconnect());