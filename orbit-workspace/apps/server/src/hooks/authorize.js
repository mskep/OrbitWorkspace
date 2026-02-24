import { Forbidden, Unauthorized } from '../utils/errors.js';
import { ROLE_LEVELS } from '../utils/constants.js';
import { usersQueries } from '../db/queries/users.js';

/**
 * Creates an onRequest hook that checks role requirements.
 *
 * @param {Object} options
 * @param {string} options.minRole - Minimum role required (e.g., 'ADMIN')
 * @param {boolean} options.dbCheck - If true, verify role + role_version against DB (for sensitive ops)
 */
export function authorize({ minRole, dbCheck = false }) {
  const requiredLevel = ROLE_LEVELS[minRole];

  return async function authorizeHook(request) {
    const { user } = request;

    if (!user) {
      throw new Unauthorized('Authentication required');
    }

    // Quick JWT-based check
    const tokenLevel = ROLE_LEVELS[user.role];
    if (!tokenLevel || tokenLevel < requiredLevel) {
      throw new Forbidden(`Requires ${minRole} role or higher`);
    }

    // For sensitive operations, verify against DB
    if (dbCheck) {
      const { rows } = await request.server.pg.query(
        usersQueries.findById,
        [user.sub],
      );

      if (rows.length === 0) {
        throw new Unauthorized('User not found');
      }

      const dbUser = rows[0];

      // Check if user is still active
      if (dbUser.status !== 'active') {
        throw new Forbidden('Account is disabled');
      }

      // Check role hasn't been downgraded since token was issued
      const dbLevel = ROLE_LEVELS[dbUser.role];
      if (!dbLevel || dbLevel < requiredLevel) {
        throw new Forbidden(`Requires ${minRole} role or higher`);
      }

      // Check role_version — if changed, token is stale
      if (dbUser.role_version !== user.rv) {
        throw new Unauthorized(
          'Role has been updated, please re-authenticate',
          'ROLE_VERSION_MISMATCH',
        );
      }

      // Attach fresh DB user data to request
      request.dbUser = dbUser;
    }
  };
}
