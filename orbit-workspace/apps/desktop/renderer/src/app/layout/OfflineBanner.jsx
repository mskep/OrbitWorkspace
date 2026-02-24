import React from 'react';
import { useAppStore } from '../../state/store';

function OfflineBanner() {
  const isOnline = useAppStore((state) => state.isOnline);

  if (isOnline) {
    return null;
  }

  return (
    <div className="offline-banner">
      <span className="offline-icon">⚠️</span>
      <span>You are offline. Some features are unavailable.</span>
    </div>
  );
}

export default OfflineBanner;
