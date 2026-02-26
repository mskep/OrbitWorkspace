/**
 * Server-side admin statistics — aggregated from PostgreSQL.
 * Source of truth for the admin overview dashboard.
 */
export async function getStats(pg) {
  const queries = {
    totalUsers: `SELECT COUNT(*) AS c FROM users`,
    activeUsers: `SELECT COUNT(*) AS c FROM users WHERE status = 'active'`,
    disabledUsers: `SELECT COUNT(*) AS c FROM users WHERE status = 'disabled'`,
    totalDevices: `SELECT COUNT(*) AS c FROM devices`,
    totalSyncBlobs: `SELECT COUNT(*) AS c FROM sync_blobs`,
    totalBadges: `SELECT COUNT(*) AS c FROM badges`,
    assignedBadges: `SELECT COUNT(*) AS c FROM user_badges`,
    totalInbox: `SELECT COUNT(*) AS c FROM inbox_messages`,
    unreadInbox: `SELECT COUNT(*) AS c FROM inbox_messages WHERE is_read = FALSE`,
    totalAuditLogs: `SELECT COUNT(*) AS c FROM audit_logs`,
    wsConnectedUsers: null, // Filled from fastify context if available
    usersPerRole: `
      SELECT role, COUNT(*) AS c FROM users GROUP BY role ORDER BY role
    `,
    usersPerMonth: `
      SELECT TO_CHAR(created_at, 'YYYY-MM') AS month, COUNT(*) AS c
      FROM users
      WHERE created_at >= NOW() - INTERVAL '12 months'
      GROUP BY month ORDER BY month
    `,
    recentAuditSummary: `
      SELECT severity, COUNT(*) AS c
      FROM audit_logs
      WHERE created_at >= NOW() - INTERVAL '24 hours'
      GROUP BY severity
    `,
    blobsByType: `
      SELECT entity_type, COUNT(*) AS c
      FROM sync_blobs
      WHERE deleted = FALSE
      GROUP BY entity_type
    `,
  };

  // Run all scalar queries in parallel
  const [
    totalUsers,
    activeUsers,
    disabledUsers,
    totalDevices,
    totalSyncBlobs,
    totalBadges,
    assignedBadges,
    totalInbox,
    unreadInbox,
    totalAuditLogs,
    usersPerRole,
    usersPerMonth,
    recentAuditSummary,
    blobsByType,
  ] = await Promise.all([
    pg.query(queries.totalUsers),
    pg.query(queries.activeUsers),
    pg.query(queries.disabledUsers),
    pg.query(queries.totalDevices),
    pg.query(queries.totalSyncBlobs),
    pg.query(queries.totalBadges),
    pg.query(queries.assignedBadges),
    pg.query(queries.totalInbox),
    pg.query(queries.unreadInbox),
    pg.query(queries.totalAuditLogs),
    pg.query(queries.usersPerRole),
    pg.query(queries.usersPerMonth),
    pg.query(queries.recentAuditSummary),
    pg.query(queries.blobsByType),
  ]);

  const int = (result) => parseInt(result.rows[0]?.c || 0, 10);
  const blobCounts = Object.fromEntries(blobsByType.rows.map((r) => [r.entity_type, parseInt(r.c, 10)]));

  return {
    totalUsers: int(totalUsers),
    activeUsers: int(activeUsers),
    disabledUsers: int(disabledUsers),
    totalDevices: int(totalDevices),
    totalSyncBlobs: int(totalSyncBlobs),
    totalBadges: int(totalBadges),
    assignedBadges: int(assignedBadges),
    totalInbox: int(totalInbox),
    unreadInbox: int(unreadInbox),
    totalAuditLogs: int(totalAuditLogs),
    // Fields expected by AdminPanel UI (counts from E2EE sync blobs by entity_type)
    totalWorkspaces: blobCounts['workspace'] || 0,
    totalNotes: blobCounts['note'] || 0,
    totalLinks: blobCounts['link'] || 0,
    totalFileRefs: blobCounts['file_ref'] || 0,
    activeTools: 0, // Tools are embedded in workspace blobs, not separately countable
    totalInboxItems: int(totalInbox),
    usersPerRole: Object.fromEntries(usersPerRole.rows.map((r) => [r.role, parseInt(r.c, 10)])),
    usersPerMonth: usersPerMonth.rows.map((r) => ({ month: r.month, count: parseInt(r.c, 10) })),
    recentAuditSummary: Object.fromEntries(recentAuditSummary.rows.map((r) => [r.severity, parseInt(r.c, 10)])),
  };
}
