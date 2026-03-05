import { usersQueries } from '../db/queries/users.js';
import { inboxQueries } from '../db/queries/inbox.js';
import { ROLES, ROLE_LEVELS } from '../utils/constants.js';
import { BadRequest, NotFound, Forbidden } from '../utils/errors.js';

/**
 * List all users (admin only).
 */
export async function listUsers(pg) {
  const { rows } = await pg.query(usersQueries.listAll);
  return { users: rows };
}

/**
 * Change a user's role.
 * Increments role_version so existing JWTs become stale for admin ops.
 * Cannot demote yourself. Cannot remove the last admin.
 * Entire operation runs in a transaction with row locking for atomicity.
 */
export async function updateUserRole(pg, adminId, targetUserId, newRole, fastify = null) {
  if (!ROLES[newRole]) {
    throw new BadRequest(`Invalid role: ${newRole}`);
  }

  if (adminId === targetUserId) {
    throw new Forbidden('Cannot change your own role');
  }

  const client = await pg.connect();
  let shouldNotifyRoleChange = false;
  let roleChangeNotification = null;
  try {
    await client.query('BEGIN');

    // Lock target user row to prevent concurrent role changes
    const { rows: targetRows } = await client.query(
      'SELECT id, role, status FROM users WHERE id = $1 FOR UPDATE',
      [targetUserId],
    );
    if (targetRows.length === 0) {
      throw new NotFound('User not found');
    }

    const target = targetRows[0];

    // If demoting from ADMIN, lock ALL admin rows then count — prevents two
    // concurrent demotions from both passing the check
    if (target.role === ROLES.ADMIN && newRole !== ROLES.ADMIN) {
      const { rows } = await client.query(
        "SELECT id FROM users WHERE role = 'ADMIN' AND status = 'active' FOR UPDATE",
      );
      if (rows.length <= 1) {
        throw new Forbidden('Cannot remove the last admin');
      }
    }

    const oldRole = target.role;
    const { rows: [admin] } = await client.query(usersQueries.findById, [adminId]);
    const changedBy = admin?.username || 'Admin';

    const { rows: [updated] } = await client.query(usersQueries.updateRole, [targetUserId, newRole]);

    if (oldRole !== newRole) {
      const title = 'Role Updated';
      const message = `Your role has been changed from ${oldRole} to ${newRole} by ${changedBy}.`;
      const metadata = JSON.stringify({ oldRole, newRole, changedBy });
      await client.query(inboxQueries.create, [
        targetUserId,
        'role-changed',
        title,
        message,
        metadata,
      ]);
      shouldNotifyRoleChange = true;
      roleChangeNotification = { title, type: 'role-changed' };
    }

    await client.query('COMMIT');
    if (shouldNotifyRoleChange) {
      _notifyUser(fastify, targetUserId, 'inbox_message', roleChangeNotification);
    }

    return { user: updated };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

function _notifyUser(fastify, userId, eventType, data) {
  if (!fastify?.wsConnections) return;
  const devices = fastify.wsConnections.get(userId);
  if (!devices) return;

  const payload = JSON.stringify({ type: eventType, data });
  for (const [, socket] of devices) {
    if (socket.readyState === 1) {
      try {
        socket.send(payload);
      } catch {
        // Non-critical — skip dead sockets
      }
    }
  }
}

/**
 * Enable or disable a user account.
 * Cannot disable yourself. Cannot disable the last admin.
 * Entire operation runs in a transaction with row locking for atomicity.
 */
export async function updateUserStatus(pg, adminId, targetUserId, newStatus) {
  if (!['active', 'disabled'].includes(newStatus)) {
    throw new BadRequest('Status must be "active" or "disabled"');
  }

  if (adminId === targetUserId) {
    throw new Forbidden('Cannot change your own status');
  }

  const client = await pg.connect();
  try {
    await client.query('BEGIN');

    // Lock target user row
    const { rows: targetRows } = await client.query(
      'SELECT id, role, status FROM users WHERE id = $1 FOR UPDATE',
      [targetUserId],
    );
    if (targetRows.length === 0) {
      throw new NotFound('User not found');
    }

    // If disabling an admin, lock ALL admin rows then count
    if (targetRows[0].role === ROLES.ADMIN && newStatus === 'disabled') {
      const { rows } = await client.query(
        "SELECT id FROM users WHERE role = 'ADMIN' AND status = 'active' FOR UPDATE",
      );
      if (rows.length <= 1) {
        throw new Forbidden('Cannot disable the last admin');
      }
    }

    const { rows: [updated] } = await client.query(usersQueries.updateStatus, [targetUserId, newStatus]);

    // If disabling, revoke all their sessions
    if (newStatus === 'disabled') {
      await client.query('DELETE FROM sessions WHERE user_id = $1', [targetUserId]);
    }

    await client.query('COMMIT');

    return { user: updated };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Broadcast a message to connected users via WebSocket.
 */
export async function broadcast(fastify, senderId, message, type) {
  if (!message || !type) {
    throw new BadRequest('Message and type are required');
  }

  const payload = {
    type: 'admin_broadcast',
    data: { message, broadcast_type: type, timestamp: Date.now() },
  };

  if (fastify.wsConnections) {
    for (const [userId, devices] of fastify.wsConnections) {
      for (const [, socket] of devices) {
        if (socket.readyState === 1) {
          try {
            socket.send(JSON.stringify(payload));
          } catch {
            // Non-critical — skip dead sockets
          }
        }
      }
    }
  }
}
