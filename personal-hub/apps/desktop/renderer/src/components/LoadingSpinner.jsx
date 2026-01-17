import React from 'react';

function LoadingSpinner({ fullscreen = false }) {
  if (fullscreen) {
    return (
      <div className="loading-overlay">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="loading-spinner-inline">
      <div className="spinner-small"></div>
    </div>
  );
}

export default LoadingSpinner;
