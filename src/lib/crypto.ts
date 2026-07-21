/**
 * Password hashing utility using Node.js built-in crypto (PBKDF2).
 *
 * Why not bcryptjs? bcryptjs v3 is ESM-only and causes Turbopack
 * to crash during compilation in Next.js 16 dev mode. Using Node.js
 * crypto avoids this entirely with zero external dependencies.
 *
 * Hash format: `pbkdf2:<iterations>:<salt-hex>:<hash-hex>`
 */

import { randomBytes, pbkdf2Sync, timingSafeEqual } from 'crypto';

const PBKDF2_ITERATIONS = 210000;
const SALT_LENGTH = 32; // bytes
const KEY_LENGTH = 64; // bytes
const DIGEST = 'sha512';
const PREFIX = 'pbkdf2:';

/**
 * Hash a password using PBKDF2-SHA512.
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(SALT_LENGTH).toString('hex');
  const hash = pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEY_LENGTH, DIGEST).toString('hex');
  return `${PREFIX}${PBKDF2_ITERATIONS}:${salt}:${hash}`;
}

/**
 * Verify a password against a stored hash.
 *
 * Supports two formats:
 * 1. PBKDF2 format: `pbkdf2:<iterations>:<salt>:<hash>` (current)
 * 2. Legacy bcrypt format: `$2b$...` or `$2a$...` (auto-migration)
 *
 * For legacy bcrypt hashes, we return false and let the auth layer
 * handle migration. Users with bcrypt hashes will need to reset their
 * password or the admin can clear the DB.
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  // PBKDF2 format
  if (storedHash.startsWith(PREFIX)) {
    return verifyPBKDF2(password, storedHash);
  }

  // Legacy bcrypt format — cannot verify without bcryptjs
  // These will fail and users will need to re-register
  if (storedHash.startsWith('$2b$') || storedHash.startsWith('$2a$')) {
    console.warn('[CRYPTO] Legacy bcrypt hash detected. User needs to reset password.');
    return false;
  }

  console.warn('[CRYPTO] Unknown hash format');
  return false;
}

function verifyPBKDF2(password: string, storedHash: string): boolean {
  const parts = storedHash.slice(PREFIX.length).split(':');
  if (parts.length !== 3) return false;

  const [iterationsStr, salt, expectedHash] = parts;
  const iterations = parseInt(iterationsStr, 10);

  // Reject malformed or attacker-controlled work factors before invoking PBKDF2.
  // Existing lower-work-factor hashes remain verifiable and should be upgraded
  // after a successful login.
  if (!Number.isSafeInteger(iterations) || iterations < 1 || iterations > 1_000_000 || !/^[0-9a-f]+$/i.test(salt) || !/^[0-9a-f]+$/i.test(expectedHash)) {
    return false;
  }

  let actualHash: string;
  try {
    actualHash = pbkdf2Sync(password, salt, iterations, KEY_LENGTH, DIGEST).toString('hex');
  } catch {
    return false;
  }

  try {
    // Use timing-safe comparison to prevent timing attacks
    return timingSafeEqual(
      Buffer.from(actualHash, 'hex'),
      Buffer.from(expectedHash, 'hex')
    );
  } catch {
    // Length mismatch — definitely wrong
    return false;
  }
}
