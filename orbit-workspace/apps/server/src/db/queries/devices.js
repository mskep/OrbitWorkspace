const DEVICE_COLUMNS = `
  id,
  user_id,
  device_name,
  device_fingerprint,
  last_seen_at,
  created_at,
  last_ip,
  last_ip_masked,
  last_user_agent,
  last_country,
  last_region,
  last_city
`;

export const devicesQueries = {
  findById: `
    SELECT ${DEVICE_COLUMNS}
    FROM devices WHERE id = $1
  `,

  findByFingerprint: `
    SELECT ${DEVICE_COLUMNS}
    FROM devices WHERE device_fingerprint = $1
  `,

  findByUser: `
    SELECT ${DEVICE_COLUMNS},
           (created_at >= NOW() - INTERVAL '24 hours') AS is_new_device
    FROM devices
    WHERE user_id = $1
    ORDER BY last_seen_at DESC
  `,

  countByUser: `
    SELECT COUNT(*) AS count FROM devices WHERE user_id = $1
  `,

  create: `
    INSERT INTO devices (
      user_id,
      device_name,
      device_fingerprint,
      last_ip,
      last_ip_masked,
      last_user_agent,
      last_country,
      last_region,
      last_city
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING ${DEVICE_COLUMNS}
  `,

  updateLastSeen: `
    UPDATE devices
    SET
      last_seen_at = NOW(),
      last_ip = COALESCE($2, last_ip),
      last_ip_masked = COALESCE($3, last_ip_masked),
      last_user_agent = COALESCE($4, last_user_agent),
      last_country = COALESCE($5, last_country),
      last_region = COALESCE($6, last_region),
      last_city = COALESCE($7, last_city)
    WHERE id = $1
    RETURNING ${DEVICE_COLUMNS}
  `,

  updateName: `
    UPDATE devices SET device_name = $2 WHERE id = $1
  `,

  delete: `
    DELETE FROM devices WHERE id = $1 AND user_id = $2
    RETURNING id
  `,
};
