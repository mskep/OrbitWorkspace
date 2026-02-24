export const usersQueries = {
  findByEmail: `
    SELECT id, email, username, password_hash, role, role_version, status, created_at, updated_at
    FROM users WHERE email = $1
  `,

  findByUsername: `
    SELECT id, email, username, password_hash, role, role_version, status, created_at, updated_at
    FROM users WHERE username = $1
  `,

  findByIdentifier: `
    SELECT id, email, username, password_hash, role, role_version, status, created_at, updated_at
    FROM users WHERE email = $1 OR username = $1
  `,

  findById: `
    SELECT id, email, username, role, role_version, status, created_at, updated_at
    FROM users WHERE id = $1
  `,

  create: `
    INSERT INTO users (email, username, password_hash, role)
    VALUES ($1, $2, $3, $4)
    RETURNING id, email, username, role, role_version, status, created_at, updated_at
  `,

  updateRole: `
    UPDATE users
    SET role = $2, role_version = role_version + 1, updated_at = NOW()
    WHERE id = $1
    RETURNING id, email, username, role, role_version, status, updated_at
  `,

  updateStatus: `
    UPDATE users SET status = $2, updated_at = NOW()
    WHERE id = $1
    RETURNING id, email, username, role, role_version, status, updated_at
  `,

  updatePasswordHash: `
    UPDATE users SET password_hash = $2, updated_at = NOW()
    WHERE id = $1
  `,

  listAll: `
    SELECT id, email, username, role, role_version, status, created_at, updated_at
    FROM users ORDER BY created_at DESC
  `,

  count: `SELECT COUNT(*) AS count FROM users`,
};
