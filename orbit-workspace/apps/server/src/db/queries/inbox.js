export const inboxQueries = {
  findByUserId: `
    SELECT id, user_id, type, title, message, metadata_json, is_read, created_at, read_at, updated_at
    FROM inbox_messages
    WHERE user_id = $1
    ORDER BY created_at DESC
  `,

  findByUserSince: `
    SELECT id, user_id, type, title, message, metadata_json, is_read, created_at, read_at, updated_at
    FROM inbox_messages
    WHERE user_id = $1 AND updated_at > $2
    ORDER BY updated_at ASC
  `,

  findById: `
    SELECT id, user_id, type, title, message, metadata_json, is_read, created_at, read_at, updated_at
    FROM inbox_messages
    WHERE id = $1
  `,

  create: `
    INSERT INTO inbox_messages (user_id, type, title, message, metadata_json)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id, user_id, type, title, message, metadata_json, is_read, created_at, read_at, updated_at
  `,

  markAsRead: `
    UPDATE inbox_messages
    SET is_read = TRUE, read_at = NOW(), updated_at = NOW()
    WHERE id = $1 AND user_id = $2
    RETURNING id, is_read, read_at, updated_at
  `,

  markAllAsRead: `
    UPDATE inbox_messages
    SET is_read = TRUE, read_at = NOW(), updated_at = NOW()
    WHERE user_id = $1 AND is_read = FALSE
  `,

  delete: `
    DELETE FROM inbox_messages
    WHERE id = $1 AND user_id = $2
    RETURNING id
  `,

  deleteAllRead: `
    DELETE FROM inbox_messages
    WHERE user_id = $1 AND is_read = TRUE
  `,

  countUnread: `
    SELECT COUNT(*) AS count
    FROM inbox_messages
    WHERE user_id = $1 AND is_read = FALSE
  `,
};
