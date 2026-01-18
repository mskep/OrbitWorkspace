import React from 'react';

/**
 * Reusable Badge component for status, tags, and labels
 */
function Badge({
  children,
  variant = 'default',
  size = 'md',
  icon = null,
  className = '',
  ...props
}) {
  const variantClasses = {
    default: 'badge-default',
    primary: 'badge-primary',
    success: 'badge-success',
    error: 'badge-error',
    danger: 'badge-error',
    warning: 'badge-warning',
    premium: 'badge-premium'
  };

  const sizeClasses = {
    sm: 'badge-sm',
    md: 'badge-md',
    lg: 'badge-lg'
  };

  const classes = [
    'badge',
    variantClasses[variant],
    sizeClasses[size],
    className
  ].filter(Boolean).join(' ');

  return (
    <span className={classes} {...props}>
      {icon && <span className="badge-icon">{icon}</span>}
      {children}
    </span>
  );
}

export default Badge;
