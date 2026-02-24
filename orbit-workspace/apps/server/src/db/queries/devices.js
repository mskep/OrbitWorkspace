export const devicesQueries = {
  findById: `
    SELECT id, user_id, device_name, device_fingerprint, last_seen_at, created_at
    FROM devices WHERE id = $1
  `,

  findByFingerprint: `
    SELECT id, user_id, device_name, device_fingerprint, last_seen_at, created_at
    FROM devices WHERE device_fingerprint = $1
  `,

  findByUser: `
    SELECT id, user_id, device_name, device_fingerprint, last_seen_at, created_at
    FROM devices WHERE user_id = $1 ORDER BY last_seen_at DESC
  `,

  countByUser: `
    SELECT COUNT(*) AS count FROM devices WHERE user_id = $1
  `,

  create: `
    INSERT INTO devices (user_id, device_name, device_fingerprint)
    VALUES ($1, $2, $3)
    RETURNING id, user_id, device_name, device_fingerprint, last_seen_at, created_at
  `,

  updateLastSeen: `
    UPDATE devices SET last_seen_at = NOW() WHERE id = $1
  `,

  updateName: `
    UPDATE devices SET device_name = $2 WHERE id = $1
  `,

  delete: `
    DELETE FROM devices WHERE id = $1 AND user_id = $2
    RETURNING id
  `,
};
