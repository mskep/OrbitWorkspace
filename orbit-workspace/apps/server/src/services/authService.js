import { v4 as uuidv4 } from 'uuid';
import { createDecipheriv } from 'crypto';
import { hashPassword, verifyPassword, hashToken, generateToken } from '../utils/crypto.js';
import { BadRequest, Unauthorized, Conflict } from '../utils/errors.js';
import { usersQueries } from '../db/queries/users.js';
import { userCryptoQueries } from '../db/queries/userCrypto.js';
import { sessionsQueries } from '../db/queries/sessions.js';
import { devicesQueries } from '../db/queries/devices.js';
import { ROLES, ROLE_LEVELS, MAX_DEVICES_PER_USER } from '../utils/constants.js';
import { buildDeviceTelemetry } from '../utils/deviceTelemetry.js';

// Refresh token lifetime in milliseconds (30 days)
const REFRESH_TOKEN_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Register a new user.
 * First user automatically gets ADMIN role.
 * Entire operation runs in a transaction for atomicity.
 */
export async function register(pg, jwt, data, request) {
  const {
    email, username, password,
    salt, encrypted_master_key, recovery_blob, kdf_params,
    device_name, device_fingerprint,
  } = data;

  // Validate KDF params bounds (prevent DoS via extreme values)
  if (kdf_params.memoryCost > 1048576 || kdf_params.timeCost > 10 || kdf_params.parallelism > 16) {
    throw new BadRequest('KDF parameters exceed allowed bounds');
  }

  const telemetry = buildDeviceTelemetry(request);

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

    // First user is ADMIN — use advisory lock to prevent race condition
    await client.query('SELECT pg_advisory_xact_lock(1)');
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

    // Clean up any orphaned device with the same fingerprint (e.g. from a deleted account)
    await client.query(
      'DELETE FROM devices WHERE device_fingerprint = $1',
      [device_fingerprint],
    );

    // Register device
    const { rows: [device] } = await client.query(devicesQueries.create, [
      user.id, device_name, device_fingerprint,
      telemetry.ip, telemetry.ipMasked, telemetry.userAgent,
      telemetry.country, telemetry.region, telemetry.city,
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
export async function login(pg, jwt, data, request) {
  const { identifier, password, device_name, device_fingerprint } = data;
  const telemetry = buildDeviceTelemetry(request);

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
    // Device belongs to another user — reassign it (same physical device, different account)
    if (device.user_id !== user.id) {
      await pg.query('DELETE FROM devices WHERE id = $1', [device.id]);
      const { rows: [newDevice] } = await pg.query(devicesQueries.create, [
        user.id, device_name, device_fingerprint,
        telemetry.ip, telemetry.ipMasked, telemetry.userAgent,
        telemetry.country, telemetry.region, telemetry.city,
      ]);
      device = newDevice;
    } else {
      const { rows: [updatedDevice] } = await pg.query(devicesQueries.updateLastSeen, [
        device.id,
        telemetry.ip, telemetry.ipMasked, telemetry.userAgent,
        telemetry.country, telemetry.region, telemetry.city,
      ]);
      if (updatedDevice) device = updatedDevice;
    }
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
        telemetry.ip, telemetry.ipMasked, telemetry.userAgent,
        telemetry.country, telemetry.region, telemetry.city,
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
          recovery_blob: cryptoRows[0].recovery_blob,
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
      recovery_blob: cryptoRows[0].recovery_blob,
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
  // Fixed-time response to prevent email enumeration via timing
  const start = Date.now();

  const { rows } = await pg.query(userCryptoQueries.findRecoveryByEmail, [email]);

  // Ensure minimum 200ms response time regardless of DB result
  const elapsed = Date.now() - start;
  if (elapsed < 200) {
    await new Promise((r) => setTimeout(r, 200 - elapsed));
  }

  if (rows.length === 0) {
    return null;
  }

  return {
    recovery_blob: rows[0].recovery_blob,
    salt: rows[0].salt,
    kdf_params: rows[0].kdf_params,
  };
}

/**
 * Recovery-based password reset — re-wrap masterKey with new derived key.
 * Called after client-side recovery (using the .orbit-recovery file).
 * The user has already proven possession of the recovery key locally.
 * Unlike changePassword, this does NOT require the old password.
 */
export async function recoverReset(pg, userId, data) {
  const { new_password, new_salt, new_encrypted_master_key, new_kdf_params } = data;

  // Validate KDF params bounds
  if (new_kdf_params.memoryCost > 1048576 || new_kdf_params.timeCost > 10 || new_kdf_params.parallelism > 16) {
    throw new BadRequest('KDF parameters exceed allowed bounds');
  }

  // Hash new password
  const newHash = await hashPassword(new_password);


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

/**
 * Public recovery-based password reset — no JWT required.
 * The recovery key is verified server-side by attempting to decrypt the recovery_blob.
 * If the AES-256-GCM auth tag validates, the user has proven possession of the key.
 */
export async function recoverResetPublic(pg, data) {
  const { email, recovery_key, new_password, new_salt, new_encrypted_master_key, new_kdf_params } = data;

  // Validate KDF params bounds
  if (new_kdf_params.memoryCost > 1048576 || new_kdf_params.timeCost > 10 || new_kdf_params.parallelism > 16) {
    throw new BadRequest('KDF parameters exceed allowed bounds');
  }

  // Get user's recovery blob from DB
  const { rows } = await pg.query(userCryptoQueries.findRecoveryByEmail, [email]);
  if (rows.length === 0) {
    throw new Unauthorized('Invalid recovery credentials');
  }

  const { recovery_blob } = rows[0];

  // Verify recovery key by attempting AES-256-GCM decryption
  try {
    const recoveryKey = Buffer.from(recovery_key, 'hex');
    const blob = Buffer.from(recovery_blob, 'base64');
    const iv = blob.subarray(0, 12);
    const tag = blob.subarray(-16);
    const encrypted = blob.subarray(12, -16);

    const decipher = createDecipheriv('aes-256-gcm', recoveryKey, iv);
    decipher.setAuthTag(tag);
    decipher.update(encrypted);
    decipher.final(); // Throws if auth tag is invalid
  } catch {
    throw new Unauthorized('Invalid recovery credentials');
  }

  // Recovery key is valid — find user and reset password
  const { rows: userRows } = await pg.query(
    'SELECT id FROM users WHERE email = $1 AND status = \'active\'',
    [email],
  );
  if (userRows.length === 0) {
    throw new Unauthorized('Invalid recovery credentials');
  }

  const userId = userRows[0].id;
  const newHash = await hashPassword(new_password);

  const client = await pg.connect();
  try {
    await client.query('BEGIN');
    await client.query(usersQueries.updatePasswordHash, [userId, newHash]);
    await client.query(userCryptoQueries.updatePasswordCrypto, [
      userId, new_salt, new_encrypted_master_key, JSON.stringify(new_kdf_params),
    ]);
    await client.query(sessionsQueries.revokeByUser, [userId]);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
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
  const location = [device.last_city, device.last_region, device.last_country]
    .filter(Boolean)
    .join(', ');

  return {
    id: device.id,
    device_name: device.device_name,
    device_fingerprint: device.device_fingerprint,
    last_seen_at: device.last_seen_at,
    last_ip: device.last_ip || null,
    last_ip_masked: device.last_ip_masked || null,
    last_user_agent: device.last_user_agent || null,
    last_country: device.last_country || null,
    last_region: device.last_region || null,
    last_city: device.last_city || null,
    location: location || null,
    is_new_device: Boolean(device.is_new_device),
  };
}

