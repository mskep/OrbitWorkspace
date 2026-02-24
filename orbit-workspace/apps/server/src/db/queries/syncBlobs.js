export const syncBlobsQueries = {
  // Pull: get all blobs for a user with server_clock > since
  pullAll: `
    SELECT entity_type, entity_id, version, server_clock, iv, ciphertext, tag, deleted, updated_at
    FROM sync_blobs
    WHERE user_id = $1 AND server_clock > $2
    ORDER BY server_clock ASC
  `,

  // Pull: filtered by entity_type
  pullByType: `
    SELECT entity_type, entity_id, version, server_clock, iv, ciphertext, tag, deleted, updated_at
    FROM sync_blobs
    WHERE user_id = $1 AND server_clock > $2 AND entity_type = $3
    ORDER BY server_clock ASC
  `,

  // Find existing blob for conflict check (FOR UPDATE prevents concurrent race)
  findByEntity: `
    SELECT id, version, server_clock
    FROM sync_blobs
    WHERE user_id = $1 AND entity_type = $2 AND entity_id = $3
    FOR UPDATE
  `,

  // Insert new blob
  insert: `
    INSERT INTO sync_blobs (user_id, entity_type, entity_id, version, server_clock, iv, ciphertext, tag, deleted)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING id, server_clock
  `,

  // Update existing blob (version upgrade)
  update: `
    UPDATE sync_blobs
    SET version = $3, server_clock = $4, iv = $5, ciphertext = $6, tag = $7, deleted = $8, updated_at = NOW()
    WHERE user_id = $1 AND id = $2
    RETURNING id, server_clock
  `,

  // Get current server clock for a user
  getCurrentClock: `
    SELECT current_clock FROM user_sync_state WHERE user_id = $1
  `,

  // Increment and return new clock value (atomic — UPDATE is implicitly row-locked)
  incrementClock: `
    UPDATE user_sync_state
    SET current_clock = current_clock + 1
    WHERE user_id = $1
    RETURNING current_clock
  `,

  // Lock user sync state row at the start of a push transaction
  lockUserSyncState: `
    SELECT current_clock FROM user_sync_state WHERE user_id = $1 FOR UPDATE
  `,
};

export const syncOpsQueries = {
  // Check if op_id already applied (idempotency)
  findByOpId: `
    SELECT id, server_clock, entity_type, entity_id
    FROM sync_ops
    WHERE user_id = $1 AND op_id = $2
  `,

  // Record applied operation
  create: `
    INSERT INTO sync_ops (user_id, device_id, op_id, entity_type, entity_id, operation, server_clock)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
  `,
};

export const syncCursorsQueries = {
  // Upsert cursor for a device
  upsert: `
    INSERT INTO sync_cursors (user_id, device_id, last_synced_clock, last_synced_at)
    VALUES ($1, $2, $3, NOW())
    ON CONFLICT (user_id, device_id)
    DO UPDATE SET last_synced_clock = EXCLUDED.last_synced_clock, last_synced_at = NOW()
  `,

  // Get cursor for a device
  find: `
    SELECT last_synced_clock, last_synced_at
    FROM sync_cursors
    WHERE user_id = $1 AND device_id = $2
  `,
};
