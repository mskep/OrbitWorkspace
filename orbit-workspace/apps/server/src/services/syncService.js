import { syncBlobsQueries, syncOpsQueries, syncCursorsQueries } from '../db/queries/syncBlobs.js';
import { BadRequest } from '../utils/errors.js';
import { SYNC_ENTITY_TYPES } from '../utils/constants.js';

/**
 * Pull blobs since a given server_clock.
 * Returns all blobs with server_clock > since, optionally filtered by entity_type.
 */
export async function pull(pg, userId, deviceId, { since = 0, type }) {
  since = parseInt(since, 10) || 0;
  // Cap to safe integer range to prevent query issues
  if (since < 0) since = 0;
  if (since > Number.MAX_SAFE_INTEGER) since = Number.MAX_SAFE_INTEGER;

  let rows;
  if (type) {
    if (!SYNC_ENTITY_TYPES.includes(type)) {
      throw new BadRequest(`Invalid entity type: ${type}`);
    }
    ({ rows } = await pg.query(syncBlobsQueries.pullByType, [userId, since, type]));
  } else {
    ({ rows } = await pg.query(syncBlobsQueries.pullAll, [userId, since]));
  }

  // Get current clock
  const { rows: clockRows } = await pg.query(syncBlobsQueries.getCurrentClock, [userId]);
  const currentClock = clockRows.length > 0 ? parseInt(clockRows[0].current_clock, 10) : 0;

  // Update cursor for this device
  if (rows.length > 0) {
    const maxClock = rows[rows.length - 1].server_clock;
    await pg.query(syncCursorsQueries.upsert, [userId, deviceId, maxClock]);
  }

  return {
    blobs: rows.map((r) => ({
      entity_type: r.entity_type,
      entity_id: r.entity_id,
      version: r.version,
      server_clock: parseInt(r.server_clock, 10),
      iv: r.iv,
      ciphertext: r.ciphertext,
      tag: r.tag,
      deleted: r.deleted,
      updated_at: r.updated_at,
    })),
    current_clock: currentClock,
  };
}

/**
 * Push a batch of blobs.
 * Handles idempotency (op_id), conflict detection, and server_clock management.
 *
 * Returns { accepted: [...], conflicts: [...] }
 */
export async function push(pg, userId, deviceId, blobs) {
  if (!Array.isArray(blobs) || blobs.length === 0) {
    throw new BadRequest('blobs must be a non-empty array');
  }

  if (blobs.length > 100) {
    throw new BadRequest('Maximum 100 blobs per push');
  }

  const accepted = [];
  const conflicts = [];

  // Process each blob in a transaction
  const client = await pg.connect();
  try {
    await client.query('BEGIN');

    // Lock user's sync state row — serializes all pushes for this user
    // This prevents two concurrent push requests from interleaving and
    // producing inconsistent version checks or clock assignments
    await client.query(syncBlobsQueries.lockUserSyncState, [userId]);

    for (const blob of blobs) {
      const { op_id, entity_type, entity_id, version, iv, ciphertext, tag, deleted = false } = blob;

      if (!op_id) {
        throw new BadRequest('op_id is required for each blob');
      }

      if (!SYNC_ENTITY_TYPES.includes(entity_type)) {
        throw new BadRequest(`Invalid entity type: ${entity_type}`);
      }

      // 1. Idempotency check — already applied?
      const { rows: opRows } = await client.query(
        syncOpsQueries.findByOpId, [userId, op_id],
      );
      if (opRows.length > 0) {
        // Already applied, return as accepted (idempotent)
        accepted.push({
          entity_type,
          entity_id,
          server_clock: parseInt(opRows[0].server_clock, 10),
          op_id,
          status: 'already_applied',
        });
        continue;
      }

      // 2. Check for existing blob
      const { rows: existing } = await client.query(
        syncBlobsQueries.findByEntity, [userId, entity_type, entity_id],
      );

      // 3. Increment server_clock
      const { rows: [clockRow] } = await client.query(
        syncBlobsQueries.incrementClock, [userId],
      );
      const newClock = parseInt(clockRow.current_clock, 10);

      if (existing.length === 0) {
        // New entity — INSERT
        await client.query(syncBlobsQueries.insert, [
          userId, entity_type, entity_id, version, newClock, iv, ciphertext, tag, deleted,
        ]);

        // Record operation
        await client.query(syncOpsQueries.create, [
          userId, deviceId, op_id, entity_type, entity_id, 'create', newClock,
        ]);

        accepted.push({ entity_type, entity_id, server_clock: newClock, op_id, status: 'created' });
      } else {
        const serverVersion = existing[0].version;

        if (version > serverVersion) {
          // Client version wins — UPDATE
          await client.query(syncBlobsQueries.update, [
            userId, existing[0].id, version, newClock, iv, ciphertext, tag, deleted,
          ]);

          // Record operation
          await client.query(syncOpsQueries.create, [
            userId, deviceId, op_id, entity_type, entity_id, 'update', newClock,
          ]);

          accepted.push({ entity_type, entity_id, server_clock: newClock, op_id, status: 'updated' });
        } else {
          // Conflict — server version is same or higher
          // Roll back the clock increment for this failed op
          // (we don't actually need to — the clock is monotonic and gaps are OK)
          conflicts.push({
            entity_id,
            entity_type,
            server_version: serverVersion,
            server_clock: parseInt(existing[0].server_clock, 10),
            op_id,
          });
        }
      }
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  return { accepted, conflicts };
}
