import React from 'react';

/**
 * Reusable Skeleton loader component
 */
function Skeleton({
  variant = 'rect',
  width = '100%',
  height = '20px',
  count = 1,
  className = '',
  ...props
}) {
  const variantClasses = {
    rect: 'skeleton-rect',
    circle: 'skeleton-circle',
    text: 'skeleton-text'
  };

  const skeletons = Array.from({ length: count }, (_, i) => (
    <div
      key={i}
      className={`skeleton ${variantClasses[variant]} ${className}`}
      style={{ width, height }}
      {...props}
    />
  ));

  return count > 1 ? <div className="skeleton-group">{skeletons}</div> : skeletons[0];
}

export default Skeleton;
