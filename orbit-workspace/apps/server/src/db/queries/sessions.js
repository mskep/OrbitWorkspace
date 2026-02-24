export const sessionsQueries = {
  create: `
    INSERT INTO sessions (user_id, device_id, refresh_token_hash, family_id, expires_at)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id, family_id, expires_at, created_at
  `,

  findByTokenHash: `
    SELECT s.id, s.user_id, s.device_id, s.refresh_token_hash, s.family_id,
           s.revoked, s.expires_at, s.created_at
    FROM sessions s
    WHERE s.refresh_token_hash = $1
  `,

  // Revoke a single session (mark as used in rotation chain)
  revoke: `
    UPDATE sessions SET revoked = TRUE WHERE id = $1
  `,

  // Revoke entire family (reuse detection — compromised token chain)
  revokeFamily: `
    UPDATE sessions SET revoked = TRUE WHERE family_id = $1
  `,

  // Delete all sessions for a device (device revocation — full cleanup, no history needed)
  revokeByDevice: `
    DELETE FROM sessions WHERE device_id = $1
  `,

  // Delete all sessions for a user (password change, account disable — full cleanup)
  revokeByUser: `
    DELETE FROM sessions WHERE user_id = $1
  `,

  // Cleanup expired sessions
  deleteExpired: `
    DELETE FROM sessions WHERE expires_at < NOW()
  `,

  // Count active sessions for a user
  countByUser: `
    SELECT COUNT(*) AS count FROM sessions
    WHERE user_id = $1 AND revoked = FALSE AND expires_at > NOW()
  `,
};
