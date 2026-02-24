import { v4 as uuidv4 } from 'uuid';
import { hashPassword, verifyPassword, hashToken, generateToken } from '../utils/crypto.js';
import { BadRequest, Unauthorized, Conflict } from '../utils/errors.js';
import { usersQueries } from '../db/queries/users.js';
import { userCryptoQueries } from '../db/queries/userCrypto.js';
import { sessionsQueries } from '../db/queries/sessions.js';
import { devicesQueries } from '../db/queries/devices.js';
import { ROLES, ROLE_LEVELS, MAX_DEVICES_PER_USER } from '../utils/constants.js';

// Refresh token lifetime in milliseconds (30 days)
const REFRESH_TOKEN_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Register a new user.
 * First user automatically gets ADMIN role.
 * Entire operation runs in a transaction for atomicity.
 */
export async function register(pg, jwt, data) {
  const {
    email, username, password,
    salt, encrypted_master_key, recovery_blob, kdf_params,
    device_name, device_fingerprint,
  } = data;

  // Validate KDF params bounds (prevent DoS via extreme values)
  if (kdf_params.memoryCost > 1048576 || kdf_params.timeCost > 10 || kdf_params.parallelism > 16) {
    throw new BadRequest('KDF parameters exceed allowed bounds');
  }

  const client = await pg.connect();
  try {
    await client.query('BEGIN');

    // Check existing user
    const { rows: existing } = await client.query(
      'SELECT id FROM users WHERE email = $1 OR username = $2',
      [email, username],
    );
    if (existing.length > 0) {
      throw new Conflict('Email or username already taken');
    }

    // First user is ADMIN
    const { rows: countRows } = await client.query(usersQueries.count);
    const role = parseInt(countRows[0].count, 10) === 0 ? ROLES.ADMIN : ROLES.USER;

    // Hash password with Argon2id
    const passwordHash = await hashPassword(password);

    // Create user
    const { rows: [user] } = await client.query(usersQueries.create, [
      email, username, passwordHash, role,
    ]);

    // Store crypto material
    await client.query(userCryptoQueries.create, [
      user.id, salt, encrypted_master_key, recovery_blob,
      JSON.stringify(kdf_params),
    ]);

    // Init sync state
    await client.query(
      'INSERT INTO user_sync_state (user_id) VALUES ($1)',
      [user.id],
    );

    // Register device
    const { rows: [device] } = await client.query(devicesQueries.create, [
      user.id, device_name, device_fingerprint,
    ]);

    // Generate tokens inside transaction — if this fails, everything rolls back
    const tokens = await generateTokenPair(client, jwt, user, device.id);

    await client.query('COMMIT');

    return {
      user: sanitizeUser(user),
      device: sanitizeDevice(device),
      ...tokens,
    };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Login with email/username + password.
 * Device creation is atomic with limit check (transaction).
 */
export async function login(pg, jwt, data) {
  const { identifier, password, device_name, device_fingerprint } = data;

  // Find user
  const { rows } = await pg.query(usersQueries.findByIdentifier, [identifier]);
  if (rows.length === 0) {
    throw new Unauthorized('Invalid credentials');
  }

  const user = rows[0];

  // Check status
  if (user.status !== 'active') {
    throw new Unauthorized('Account is disabled');
  }

  // Verify password
  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    throw new Unauthorized('Invalid credentials');
  }

  // Get or create device — atomic to prevent race condition on device limit
  let device;
  const { rows: existingDevices } = await pg.query(
    devicesQueries.findByFingerprint,
    [device_fingerprint],
  );

  if (existingDevices.length > 0) {
    device = existingDevices[0];
    // Verify device belongs to this user
    if (device.user_id !== user.id) {
      throw new Unauthorized('Device registered to another account');
    }
    await pg.query(devicesQueries.updateLastSeen, [device.id]);
  } else {
    // Atomic: lock user row, check count, create device + session in one transaction
    const client = await pg.connect();
    try {
      await client.query('BEGIN');

      // Lock the user row to prevent concurrent device creation
      await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [user.id]);

      const { rows: countRows } = await client.query(devicesQueries.countByUser, [user.id]);
      if (parseInt(countRows[0].count, 10) >= MAX_DEVICES_PER_USER) {
        throw new Conflict(
          `Maximum ${MAX_DEVICES_PER_USER} devices reached. Remove a device first.`,
          'DEVICE_LIMIT',
        );
      }

      const { rows: [newDevice] } = await client.query(devicesQueries.create, [
        user.id, device_name, device_fingerprint,
      ]);
      device = newDevice;

      // Generate tokens inside same transaction — if session creation fails, device rolls back too
      const tokens = await generateTokenPair(client, jwt, user, device.id);

      await client.query('COMMIT');

      // Get crypto material (read-only, outside txn is fine)
      const { rows: cryptoRows } = await pg.query(userCryptoQueries.findForLogin, [user.id]);
      if (!cryptoRows[0]) {
        throw new Unauthorized('Account crypto material not found — contact support');
      }

      return {
        user: sanitizeUser(user),
        device: sanitizeDevice(device),
        crypto: {
          salt: cryptoRows[0].salt,
          encrypted_master_key: cryptoRows[0].encrypted_master_key,
          kdf_params: cryptoRows[0].kdf_params,
        },
        ...tokens,
      };
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  }

  // Existing device path — no transaction needed (device already exists)
  const { rows: cryptoRows } = await pg.query(
    userCryptoQueries.findForLogin,
    [user.id],
  );

  if (!cryptoRows[0]) {
    throw new Unauthorized('Account crypto material not found — contact support');
  }

  const tokens = await generateTokenPair(pg, jwt, user, device.id);

  return {
    user: sanitizeUser(user),
    device: sanitizeDevice(device),
    crypto: {
      salt: cryptoRows[0].salt,
      encrypted_master_key: cryptoRows[0].encrypted_master_key,
      kdf_params: cryptoRows[0].kdf_params,
    },
    ...tokens,
  };
}

/**
 * Refresh token rotation with reuse detection.
 * If a revoked token is presented, the entire family is invalidated.
 * Uses a transaction to prevent concurrent refresh race conditions.
 */
export async function refresh(pg, jwt, refreshToken) {
  const tokenHash = hashToken(refreshToken);

  const client = await pg.connect();
  try {
    await client.query('BEGIN');

    // SELECT FOR UPDATE — lock the session row to prevent concurrent refresh
    const { rows } = await client.query(
      `SELECT s.id, s.user_id, s.device_id, s.refresh_token_hash, s.family_id,
              s.revoked, s.expires_at, s.created_at
       FROM sessions s
       WHERE s.refresh_token_hash = $1
       FOR UPDATE`,
      [tokenHash],
    );

    if (rows.length === 0) {
      await client.query('COMMIT');
      throw new Unauthorized('Invalid refresh token');
    }

    const session = rows[0];

    // REUSE DETECTION: if token is already revoked, someone stole it
    if (session.revoked) {
      // Invalidate the entire family — nuclear option
      await client.query(sessionsQueries.revokeFamily, [session.family_id]);
      await client.query('COMMIT');
      throw new Unauthorized(
        'Refresh token reuse detected, all sessions revoked',
        'TOKEN_REUSE',
      );
    }

    // Check expiration
    if (new Date(session.expires_at) < new Date()) {
      await client.query('COMMIT');
      throw new Unauthorized('Refresh token expired');
    }

    // Revoke current token (part of rotation)
    await client.query(sessionsQueries.revoke, [session.id]);

    // Get fresh user data
    const { rows: userRows } = await client.query(usersQueries.findById, [session.user_id]);
    if (userRows.length === 0 || userRows[0].status !== 'active') {
      await client.query('COMMIT');
      throw new Unauthorized('Account not found or disabled');
    }

    const user = userRows[0];

    // Generate new token pair in same family
    const newRefreshToken = generateToken();
    const newRefreshHash = hashToken(newRefreshToken);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_LIFETIME_MS);

    await client.query(sessionsQueries.create, [
      user.id, session.device_id, newRefreshHash, session.family_id, expiresAt,
    ]);

    await client.query('COMMIT');

    // Validate role before signing
    if (!ROLE_LEVELS[user.role]) {
      throw new Unauthorized('Invalid user role');
    }

    const accessToken = jwt.sign({
      sub: user.id,
      role: user.role,
      rv: user.role_version,
      did: session.device_id,
    });

    return {
      access_token: accessToken,
      refresh_token: newRefreshToken,
    };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Logout — revoke the refresh token.
 */
export async function logout(pg, userId, deviceId) {
  if (deviceId) {
    await pg.query(sessionsQueries.revokeByDevice, [deviceId]);
  }
  // Also cleanup expired sessions opportunistically
  await pg.query(sessionsQueries.deleteExpired);
}

/**
 * Recovery — returns recovery blob for client-side decryption.
 * Generic response to prevent user enumeration (always returns 200).
 * The recovery_blob is useless without the recovery_key file that only the user has.
 * The recovery_key_hex NEVER reaches the server.
 */
export async function recover(pg, email) {
  const { rows } = await pg.query(userCryptoQueries.findRecoveryByEmail, [email]);

  if (rows.length === 0) {
    // Generic response — don't reveal if email exists
    return null;
  }

  return {
    recovery_blob: rows[0].recovery_blob,
    salt: rows[0].salt,
    kdf_params: rows[0].kdf_params,
  };
}

/**
 * Change password — re-wrap masterKey with new derived key.
 * Data is NOT re-encrypted, only the key wrapper changes.
 */
export async function changePassword(pg, userId, data) {
  const { old_password, new_password, new_salt, new_encrypted_master_key, new_kdf_params } = data;

  // Validate KDF params bounds (same check as register — prevent DoS via extreme values)
  if (new_kdf_params.memoryCost > 1048576 || new_kdf_params.timeCost > 10 || new_kdf_params.parallelism > 16) {
    throw new BadRequest('KDF parameters exceed allowed bounds');
  }

  // Get current user
  const { rows } = await pg.query(
    'SELECT id, password_hash FROM users WHERE id = $1',
    [userId],
  );
  if (rows.length === 0) {
    throw new Unauthorized('User not found');
  }

  // Verify old password
  const valid = await verifyPassword(old_password, rows[0].password_hash);
  if (!valid) {
    throw new Unauthorized('Invalid current password');
  }

  // Hash new password
  const newHash = await hashPassword(new_password);

  // Wrap everything in a transaction
  const client = await pg.connect();
  try {
    await client.query('BEGIN');

    // Update password hash
    await client.query(usersQueries.updatePasswordHash, [userId, newHash]);

    // Update crypto material
    await client.query(userCryptoQueries.updatePasswordCrypto, [
      userId, new_salt, new_encrypted_master_key, JSON.stringify(new_kdf_params),
    ]);

    // Revoke all existing sessions (force re-login everywhere)
    await client.query(sessionsQueries.revokeByUser, [userId]);

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

// ============================================================
// Helpers
// ============================================================

async function generateTokenPair(pg, jwt, user, deviceId) {
  // Validate role before signing — prevent invalid tokens
  if (!ROLE_LEVELS[user.role]) {
    throw new Error(`Invalid role "${user.role}" — cannot sign JWT`);
  }

  const accessToken = jwt.sign({
    sub: user.id,
    role: user.role,
    rv: user.role_version,
    did: deviceId,
  });

  const refreshToken = generateToken();
  const refreshHash = hashToken(refreshToken);
  const familyId = uuidv4();
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_LIFETIME_MS);

  await pg.query(sessionsQueries.create, [
    user.id, deviceId, refreshHash, familyId, expiresAt,
  ]);

  return {
    access_token: accessToken,
    refresh_token: refreshToken,
  };
}

function sanitizeUser(user) {
  return {
    id: user.id,
    email: user.email,
    username: user.username,
    role: user.role,
    role_version: user.role_version,
    status: user.status,
    created_at: user.created_at,
  };
}

function sanitizeDevice(device) {
  return {
    id: device.id,
    device_name: device.device_name,
    device_fingerprint: device.device_fingerprint,
    last_seen_at: device.last_seen_at,
  };
}
