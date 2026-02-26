import { inboxQueries } from '../db/queries/inbox.js';
import { usersQueries } from '../db/queries/users.js';
import { BadRequest, NotFound } from '../utils/errors.js';

/**
 * Get all inbox messages for a user.
 */
export async function getMessages(pg, userId) {
  const { rows } = await pg.query(inboxQueries.findByUserId, [userId]);
  return { messages: rows };
}

/**
 * Get inbox messages updated since a cursor (for incremental sync).
 * Returns messages with updated_at > since.
 */
export async function getMessagesSince(pg, userId, since) {
  const parsed = new Date(since);
  if (isNaN(parsed.getTime())) {
    throw new BadRequest('Invalid "since" date parameter');
  }
  const { rows } = await pg.query(inboxQueries.findByUserSince, [userId, parsed.toISOString()]);
  return { messages: rows };
}

/**
 * Admin/DEV broadcast history (server-authoritative).
 */
export async function getBroadcastHistory(pg, limit = 50) {
  const parsedLimit = Number.isFinite(Number(limit)) ? Number(limit) : 50;
  const safeLimit = Math.min(Math.max(Math.floor(parsedLimit), 1), 200);

  const { rows } = await pg.query(inboxQueries.broadcastHistory, [safeLimit]);
  return {
    history: rows.map((row) => {
      let metadata = null;
      if (row.metadata_json) {
        try {
          metadata = typeof row.metadata_json === 'string'
            ? JSON.parse(row.metadata_json)
            : row.metadata_json;
        } catch {
          metadata = null;
        }
      }

      return {
        type: normalizeBroadcastType(row.type),
        title: row.title,
        message: row.message,
        metadata,
        created_at: Number(row.created_at) || 0,
        recipient_count: Number(row.recipient_count) || 0,
      };
    }),
  };
}

/**
 * Get unread count.
 */
export async function getUnreadCount(pg, userId) {
  const { rows: [{ count }] } = await pg.query(inboxQueries.countUnread, [userId]);
  return { count: parseInt(count, 10) };
}

/**
 * Mark a single message as read.
 */
export async function markAsRead(pg, userId, messageId) {
  const { rows } = await pg.query(inboxQueries.markAsRead, [messageId, userId]);
  if (rows.length === 0) throw new NotFound('Message not found');
  return { message: rows[0] };
}

/**
 * Mark all messages as read for a user.
 */
export async function markAllAsRead(pg, userId) {
  await pg.query(inboxQueries.markAllAsRead, [userId]);
  return { success: true };
}

/**
 * Delete a message.
 */
export async function deleteMessage(pg, userId, messageId) {
  const { rows } = await pg.query(inboxQueries.delete, [messageId, userId]);
  if (rows.length === 0) throw new NotFound('Message not found');
  return { deleted: true };
}

/**
 * Delete all read messages.
 */
export async function deleteReadMessages(pg, userId) {
  await pg.query(inboxQueries.deleteAllRead, [userId]);
  return { deleted: true };
}

/**
 * Send a broadcast to all active users or a specific user (admin only).
 * Creates inbox_messages and sends WS notifications.
 */
export async function sendBroadcast(pg, fastify, adminId, { title, message, target, userId, category }) {
  if (!title || !message) throw new BadRequest('Title and message are required');

  const type = category || 'admin-broadcast';
  const { rows: [admin] } = await pg.query(usersQueries.findById, [adminId]);
  const senderName = admin?.username || 'Admin';

  const metadata = JSON.stringify({ sentBy: senderName, category: type });

  let sentCount = 0;

  if (target === 'user') {
    // Single user — userId is required
    if (!userId) throw new BadRequest('userId is required when target is "user"');

    const { rows: [targetUser] } = await pg.query(usersQueries.findById, [userId]);
    if (!targetUser) throw new NotFound('Target user not found');

    await pg.query(inboxQueries.create, [userId, type, title, message, metadata]);
    _notifyUser(fastify, userId, 'inbox_message', { title, type });
    sentCount = 1;
  } else if (target === 'all' || !target) {
    // All active users
    const { rows: users } = await pg.query(usersQueries.listAll);
    for (const user of users) {
      if (user.status !== 'active') continue;
      await pg.query(inboxQueries.create, [user.id, type, title, message, metadata]);
      _notifyUser(fastify, user.id, 'inbox_message', { title, type });
      sentCount++;
    }
  } else {
    throw new BadRequest('target must be "user" or "all"');
  }

  return { sent: sentCount };
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

function normalizeBroadcastType(type) {
  if (typeof type !== 'string') return 'admin-broadcast';
  return type.replace(/_/g, '-');
}
