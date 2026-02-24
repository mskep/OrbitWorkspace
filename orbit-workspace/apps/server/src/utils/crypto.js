import argon2 from 'argon2';
import { createHmac, randomBytes } from 'crypto';
import { config } from '../config.js';

// ============================================================
// Password hashing — Argon2id
// Interface abstracted for future SRP/OPAQUE replacement (V2).
// To migrate: replace hashPassword/verifyPassword internals,
// no changes needed in routes or services.
// ============================================================

export async function hashPassword(password) {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536, // 64 MB
    timeCost: 3,
    parallelism: 4,
    hashLength: 32,
  });
}

export async function verifyPassword(password, hash) {
  return argon2.verify(hash, password);
}

// ============================================================
// Token hashing — HMAC-SHA256
// For refresh tokens (high-entropy strings, no need for slow hash).
// ============================================================

export function hashToken(token) {
  return createHmac('sha256', config.jwt.refreshSecret)
    .update(token)
    .digest('hex');
}

export function generateToken() {
  return randomBytes(48).toString('base64url');
}
