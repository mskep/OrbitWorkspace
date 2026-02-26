import { auditLogsQueries } from '../db/queries/auditLogs.js';
import { BadRequest } from '../utils/errors.js';

const MAX_BATCH_SIZE = 200;
const VALID_SEVERITIES = new Set(['info', 'warning', 'error', 'critical']);
const VALID_STATUSES = new Set(['success', 'error', 'denied']);

/**
 * Query audit logs with filtering + pagination.
 */
export async function getLogs(pg, filters = {}) {
  const {
    userId = null,
    action = null,
    category = null,
    severity = null,
    status = null,
    startDate = null,
    endDate = null,
    search = null,
    limit = 200,
    offset = 0,
  } = filters;

  const conditions = [];
  const params = [];
  let paramIdx = 1;

  if (userId) {
    conditions.push(`user_id = $${paramIdx++}`);
    params.push(userId);
  }
  if (action) {
    conditions.push(`action = $${paramIdx++}`);
    params.push(action);
  }
  if (category) {
    conditions.push(`category = $${paramIdx++}`);
    params.push(category);
  }
  if (severity) {
    conditions.push(`severity = $${paramIdx++}`);
    params.push(severity);
  }
  if (status) {
    conditions.push(`status = $${paramIdx++}`);
    params.push(status);
  }
  if (startDate) {
    const parsed = new Date(startDate);
    if (!isNaN(parsed.getTime())) {
      conditions.push(`created_at >= $${paramIdx++}`);
      params.push(parsed.toISOString());
    }
  }
  if (endDate) {
    const parsed = new Date(endDate);
    if (!isNaN(parsed.getTime())) {
      conditions.push(`created_at <= $${paramIdx++}`);
      params.push(parsed.toISOString());
    }
  }
  if (search) {
    conditions.push(`(action ILIKE $${paramIdx} OR username ILIKE $${paramIdx} OR target_type ILIKE $${paramIdx})`);
    params.push(`%${search}%`);
    paramIdx++;
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 200, 1), 500);
  const safeOffset = Math.max(parseInt(offset, 10) || 0, 0);

  const countQuery = `SELECT COUNT(*) AS count FROM audit_logs ${where}`;
  const dataQuery = `
    SELECT id, user_id, username, action, category, severity, status,
           target_type, target_id, details, device_id, ip_address, created_at
    FROM audit_logs ${where}
    ORDER BY created_at DESC
    LIMIT $${paramIdx++} OFFSET $${paramIdx++}
  `;

  const countParams = [...params];
  params.push(safeLimit, safeOffset);

  const [countResult, dataResult] = await Promise.all([
    pg.query(countQuery, countParams),
    pg.query(dataQuery, params),
  ]);

  return {
    logs: dataResult.rows,
    total: parseInt(countResult.rows[0].count, 10),
    limit: safeLimit,
    offset: safeOffset,
  };
}

/**
 * Push a batch of audit logs from a client device.
 * Each log entry is validated + sanitized before insert.
 */
export async function pushLogs(pg, userId, username, deviceId, ipAddress, logs) {
  if (!Array.isArray(logs) || logs.length === 0) {
    throw new BadRequest('logs must be a non-empty array');
  }
  if (logs.length > MAX_BATCH_SIZE) {
    throw new BadRequest(`Maximum ${MAX_BATCH_SIZE} logs per batch`);
  }

  const params = [];
  for (const log of logs) {
    const severity = VALID_SEVERITIES.has(log.severity) ? log.severity : 'info';
    const status = VALID_STATUSES.has(log.status) ? log.status : 'success';
    const action = typeof log.action === 'string' ? log.action.slice(0, 120) : 'unknown';
    const category = typeof log.category === 'string' ? log.category.slice(0, 60) : 'system';
    const targetType = typeof log.target_type === 'string' ? log.target_type.slice(0, 60) : null;
    const targetId = typeof log.target_id === 'string' ? log.target_id.slice(0, 120) : null;
    const details = log.details && typeof log.details === 'object' ? JSON.stringify(log.details) : '{}';

    params.push(
      userId, username, action, category, severity, status,
      targetType, targetId, details, deviceId, ipAddress,
    );
  }

  const query = auditLogsQueries.insertBatch(logs.length);
  await pg.query(query, params);

  return { inserted: logs.length };
}

/**
 * Create a single server-side audit log entry (for admin actions, etc.)
 */
export async function createLog(pg, { userId, username, action, category, severity, status, targetType, targetId, details, deviceId, ipAddress }) {
  const { rows } = await pg.query(auditLogsQueries.insert, [
    userId || null,
    username || null,
    action,
    category || 'system',
    severity || 'info',
    status || 'success',
    targetType || null,
    targetId || null,
    details ? JSON.stringify(details) : '{}',
    deviceId || null,
    ipAddress || null,
  ]);
  return rows[0];
}
