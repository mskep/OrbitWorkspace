export const badgesQueries = {
  findAll: `
    SELECT id, name, display_name, description, icon, color, created_at
    FROM badges ORDER BY created_at ASC
  `,

  findById: `
    SELECT id, name, display_name, description, icon, color, created_at
    FROM badges WHERE id = $1
  `,

  findByUserId: `
    SELECT b.id, b.name, b.display_name, b.description, b.icon, b.color,
           ub.assigned_by, ub.assigned_at
    FROM badges b
    JOIN user_badges ub ON ub.badge_id = b.id
    WHERE ub.user_id = $1
    ORDER BY ub.assigned_at DESC
  `,

  assign: `
    INSERT INTO user_badges (user_id, badge_id, assigned_by)
    VALUES ($1, $2, $3)
    ON CONFLICT (user_id, badge_id) DO NOTHING
    RETURNING user_id, badge_id, assigned_by, assigned_at
  `,

  revoke: `
    DELETE FROM user_badges
    WHERE user_id = $1 AND badge_id = $2
    RETURNING user_id, badge_id
  `,

  hasBadge: `
    SELECT COUNT(*) AS count
    FROM user_badges
    WHERE user_id = $1 AND badge_id = $2
  `,
};
