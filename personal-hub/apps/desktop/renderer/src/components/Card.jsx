import React from 'react';

/**
 * Reusable Card component with optional hover effect and gradient top border
 */
function Card({
  children,
  hover = false,
  gradient = false,
  padding = 'md',
  className = '',
  onClick,
  ...props
}) {
  const paddingClasses = {
    sm: 'card-padding-sm',
    md: 'card-padding-md',
    lg: 'card-padding-lg'
  };

  const classes = [
    'card',
    hover ? 'card-hover' : '',
    gradient ? 'card-gradient' : '',
    paddingClasses[padding],
    className
  ].filter(Boolean).join(' ');

  const Component = onClick ? 'button' : 'div';

  return (
    <Component className={classes} onClick={onClick} {...props}>
      {children}
    </Component>
  );
}

export default Card;
