import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

function key(): Buffer {
  const raw = process.env.INTEGRATION_ENCRYPTION_KEY;
  if (!raw) throw new Error('INTEGRATION_ENCRYPTION_KEY is not configured');
  const value = Buffer.from(raw, 'base64');
  if (value.length !== 32) throw new Error('INTEGRATION_ENCRYPTION_KEY must be a base64-encoded 32-byte key');
  return value;
}

export function encryptIntegrationSecret(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return [iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), encrypted.toString('base64url')].join('.');
}

export function decryptIntegrationSecret(value: string): string {
  const [iv, tag, ciphertext] = value.split('.');
  if (!iv || !tag || !ciphertext) throw new Error('Invalid encrypted integration secret');
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64url')), decipher.final()]).toString('utf8');
}
