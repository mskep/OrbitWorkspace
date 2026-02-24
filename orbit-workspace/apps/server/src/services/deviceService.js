import { devicesQueries } from '../db/queries/devices.js';
import { sessionsQueries } from '../db/queries/sessions.js';
import { NotFound, Forbidden, BadRequest } from '../utils/errors.js';

/**
 * List all devices for a user.
 */
export async function listDevices(pg, userId) {
  const { rows } = await pg.query(devicesQueries.findByUser, [userId]);
  return { devices: rows };
}

/**
 * Revoke (delete) a device.
 * Cascades: deletes sessions and sync_cursors for this device.
 * A device cannot revoke itself.
 */
export async function revokeDevice(pg, userId, deviceId, currentDeviceId) {
  if (deviceId === currentDeviceId) {
    throw new BadRequest('Cannot revoke your current device. Use logout instead.');
  }

  // Verify device belongs to user
  const { rows } = await pg.query(devicesQueries.findById, [deviceId]);
  if (rows.length === 0 || rows[0].user_id !== userId) {
    throw new NotFound('Device not found');
  }

  // Delete sessions for this device
  await pg.query(sessionsQueries.revokeByDevice, [deviceId]);

  // Delete the device (cascades to sync_cursors via FK)
  const { rows: deleted } = await pg.query(devicesQueries.delete, [deviceId, userId]);
  if (deleted.length === 0) {
    throw new NotFound('Device not found');
  }

  return { message: 'Device revoked' };
}
