import { Unauthorized } from '../utils/errors.js';

/**
 * onRequest hook — verifies JWT access token.
 * After this hook, request.user contains:
 * { sub: userId, role, rv: roleVersion, did: deviceId }
 */
export async function authenticate(request, reply) {
  try {
    const decoded = await request.jwtVerify();
    request.user = decoded;
  } catch (err) {
    throw new Unauthorized('Invalid or expired access token', 'TOKEN_INVALID');
  }
}

/**
 * Stricter authenticate: also verifies user status + device existence in DB.
 * Use this for routes where immediate revocation matters (sync, devices, admin).
 * Adds ~1 lightweight query per request but closes the 15-min JWT window.
 */
export async function authenticateStrict(request, reply) {
  // First, do standard JWT verification
  await authenticate(request, reply);

  const { sub: userId, did: deviceId } = request.user;

  // Check user is still active and device still exists in a single query
  const { rows } = await request.server.pg.query(
    `SELECT u.status, d.id AS device_id
     FROM users u
     LEFT JOIN devices d ON d.id = $2 AND d.user_id = u.id
     WHERE u.id = $1`,
    [userId, deviceId],
  );

  if (rows.length === 0 || rows[0].status !== 'active') {
    throw new Unauthorized('Account not found or disabled', 'ACCOUNT_DISABLED');
  }

  if (!rows[0].device_id) {
    throw new Unauthorized('Device has been revoked', 'DEVICE_REVOKED');
  }
}
