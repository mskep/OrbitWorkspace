export const auditLogsQueries = {
  insert: `
    INSERT INTO audit_logs (user_id, username, action, category, severity, status, target_type, target_id, details, device_id, ip_address)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING id, created_at
  `,

  insertBatch: (count) => {
    const values = [];
    for (let i = 0; i < count; i++) {
      const offset = i * 11;
      values.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10}, $${offset + 11})`);
    }
    return `
      INSERT INTO audit_logs (user_id, username, action, category, severity, status, target_type, target_id, details, device_id, ip_address)
      VALUES ${values.join(', ')}
    `;
  },

  findAll: `
    SELECT id, user_id, username, action, category, severity, status,
           target_type, target_id, details, device_id, ip_address, created_at
    FROM audit_logs
    ORDER BY created_at DESC
    LIMIT $1 OFFSET $2
  `,

  findByUser: `
    SELECT id, user_id, username, action, category, severity, status,
           target_type, target_id, details, device_id, ip_address, created_at
    FROM audit_logs
    WHERE user_id = $1
    ORDER BY created_at DESC
    LIMIT $2 OFFSET $3
  `,

  countAll: `SELECT COUNT(*) AS count FROM audit_logs`,

  countByUser: `SELECT COUNT(*) AS count FROM audit_logs WHERE user_id = $1`,
};
