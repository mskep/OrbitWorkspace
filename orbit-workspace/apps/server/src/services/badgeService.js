import { badgesQueries } from '../db/queries/badges.js';
import { usersQueries } from '../db/queries/users.js';
import { inboxQueries } from '../db/queries/inbox.js';
import { BadRequest, NotFound } from '../utils/errors.js';

/**
 * List all available badges.
 */
export async function listBadges(pg) {
  const { rows } = await pg.query(badgesQueries.findAll);
  return { badges: rows };
}

/**
 * Get badges assigned to a user.
 */
export async function getUserBadges(pg, userId) {
  const { rows } = await pg.query(badgesQueries.findByUserId, [userId]);
  return { badges: rows };
}

/**
 * Assign a badge to a user (admin only).
 * Creates an inbox notification for the target user.
 */
export async function assignBadge(pg, fastify, adminId, targetUserId, badgeId) {
  // Validate badge exists
  const { rows: [badge] } = await pg.query(badgesQueries.findById, [badgeId]);
  if (!badge) throw new NotFound('Badge not found');

  // Validate target user exists
  const { rows: [targetUser] } = await pg.query(usersQueries.findById, [targetUserId]);
  if (!targetUser) throw new NotFound('User not found');

  // Get admin info for notification
  const { rows: [admin] } = await pg.query(usersQueries.findById, [adminId]);

  // Assign
  const { rows } = await pg.query(badgesQueries.assign, [targetUserId, badgeId, adminId]);
  if (rows.length === 0) {
    throw new BadRequest('User already has this badge');
  }

  // Create inbox notification
  const metadata = JSON.stringify({
    badgeName: badge.display_name,
    badgeIcon: badge.icon,
    assignedBy: admin?.username || 'Admin',
  });
  await pg.query(inboxQueries.create, [
    targetUserId,
    'badge-assigned',
    `Badge awarded: ${badge.display_name}`,
    `You have been awarded the "${badge.display_name}" badge by ${admin?.username || 'an admin'}.`,
    metadata,
  ]);

  // Notify via WS if connected
  _notifyUser(fastify, targetUserId, 'badge_update', { action: 'assigned', badge_id: badgeId });

  return { assigned: rows[0] };
}

/**
 * Revoke a badge from a user (admin only).
 * Creates an inbox notification for the target user.
 */
export async function revokeBadge(pg, fastify, adminId, targetUserId, badgeId) {
  const { rows: [badge] } = await pg.query(badgesQueries.findById, [badgeId]);
  if (!badge) throw new NotFound('Badge not found');

  const { rows: [admin] } = await pg.query(usersQueries.findById, [adminId]);

  const { rows } = await pg.query(badgesQueries.revoke, [targetUserId, badgeId]);
  if (rows.length === 0) {
    throw new BadRequest('User does not have this badge');
  }

  // Create inbox notification
  const metadata = JSON.stringify({
    badgeName: badge.display_name,
    badgeIcon: badge.icon,
    revokedBy: admin?.username || 'Admin',
  });
  await pg.query(inboxQueries.create, [
    targetUserId,
    'badge-revoked',
    `Badge removed: ${badge.display_name}`,
    `The "${badge.display_name}" badge has been removed by ${admin?.username || 'an admin'}.`,
    metadata,
  ]);

  _notifyUser(fastify, targetUserId, 'badge_update', { action: 'revoked', badge_id: badgeId });

  return { revoked: true };
}

/**
 * Send a WS event to a specific user on all devices.
 */
function _notifyUser(fastify, userId, eventType, data) {
  if (!fastify.wsConnections) return;
  const devices = fastify.wsConnections.get(userId);
  if (!devices) return;

  const payload = JSON.stringify({ type: eventType, data });
  for (const [, socket] of devices) {
    if (socket.readyState === 1) {
      try { socket.send(payload); } catch { /* skip */ }
    }
  }
}
