import React from 'react';
import { useAppStore } from '../../state/store';

function Workspace({ children }) {
  const isOnline = useAppStore((state) => state.isOnline);

  return (
    <div className="workspace">
      {!isOnline && (
        <div className="offline-banner">
          You are currently offline. Some features may be unavailable.
        </div>
      )}
      <div className="workspace-content">
        {children}
      </div>
    </div>
  );
}

export default Workspace;
