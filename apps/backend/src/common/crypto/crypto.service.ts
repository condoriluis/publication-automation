import { Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHash, randomBytes, createHmac, timingSafeEqual } from 'crypto';

/**
 * Utilidades criptográficas de la plataforma:
 *  - Cifrado AES-256-GCM (autenticado) para secrets en reposo (tokens de Meta).
 *  - Hash SHA-256 estándar para deduplicación / firmas.
 *  - HMAC-SHA256 + comparación en tiempo constante.
 */
@Injectable()
export class CryptoService {
  /** Deriva la key de 32B desde TOKEN_ENCRYPTION_KEY/TOKEN_ENCRYPTION_KEY_HEX */
  private keyFor(basis: string | undefined, hex: string | undefined): Buffer {
    if (hex) return Buffer.from(hex, 'hex');
    if (basis) {
      const key = createHash('sha256').update(basis).digest();
      return Buffer.from(key);
    }
    // Fallback seguro para desarrollo local (no apto para producción):
    return Buffer.from('pa-dev-key-change-me-32b-security', 'utf8').subarray(0, 32);
  }

  encrypt(plainText: string, opts?: { basis?: string; hexKey?: string }): string {
    if (!plainText) return plainText;
    const key = this.keyFor(opts?.basis, opts?.hexKey);
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `v1:${iv.toString('base64url')}:${tag.toString('base64url')}:${encrypted.toString('base64url')}`;
  }

  decrypt(payload: string, opts?: { basis?: string; hexKey?: string }): string {
    if (!payload) return payload;
    const parts = payload.split(':');
    if (parts.length !== 4 || parts[0] !== 'v1') {
      throw new Error('Payload cifrado con formato inválido');
    }
    const [, ivB64, tagB64, dataB64] = parts;
    const key = this.keyFor(opts?.basis, opts?.hexKey);
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(dataB64, 'base64url')),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  }

  hash(input: string): string {
    return createHash('sha256').update(input).digest('hex');
  }

  hmac(input: string, secret: string): string {
    return createHmac('sha256', secret).update(input).digest('hex');
  }

  safeEqual(a: string, b: string): boolean {
    const ba = Buffer.from(a);
    const bb = Buffer.from(b);
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  }

  randomToken(bytes = 32): string {
    return randomBytes(bytes).toString('base64url');
  }
}
