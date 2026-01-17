import React from 'react';

/**
 * Reusable EmptyState component with icon and optional action button
 */
function EmptyState({
  icon = null,
  title = 'No items found',
  description = '',
  action = null,
  className = '',
  ...props
}) {
  return (
    <div className={`empty-state ${className}`} {...props}>
      {icon && <div className="empty-state-icon">{icon}</div>}
      <h3 className="empty-state-title">{title}</h3>
      {description && <p className="empty-state-description">{description}</p>}
      {action && <div className="empty-state-action">{action}</div>}
    </div>
  );
}

export default EmptyState;
