import React from 'react';

function Topbar({ title, actions }) {
  return (
    <div className="topbar">
      <h2 className="topbar-title">{title}</h2>
      {actions && <div className="topbar-actions">{actions}</div>}
    </div>
  );
}

export default Topbar;
