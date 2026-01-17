import React from 'react';

function TitleBar() {
  const handleMinimize = () => {
    window.hubAPI.window.minimize();
  };

  const handleMaximize = () => {
    window.hubAPI.window.maximize();
  };

  const handleClose = () => {
    window.hubAPI.window.close();
  };

  return (
    <div className="titlebar">
      <div className="titlebar-drag">
        <div className="titlebar-title">Personal Hub</div>
      </div>
      <div className="titlebar-controls">
        <button className="titlebar-button" onClick={handleMinimize} title="Minimize">
          <svg width="12" height="12" viewBox="0 0 12 12">
            <rect fill="currentColor" width="10" height="1" x="1" y="6" />
          </svg>
        </button>
        <button className="titlebar-button" onClick={handleMaximize} title="Maximize">
          <svg width="12" height="12" viewBox="0 0 12 12">
            <rect fill="currentColor" width="9" height="9" x="1.5" y="1.5" strokeWidth="1" stroke="currentColor" fillOpacity="0" />
          </svg>
        </button>
        <button className="titlebar-button titlebar-close" onClick={handleClose} title="Close">
          <svg width="12" height="12" viewBox="0 0 12 12">
            <polygon fill="currentColor" points="11 1.576 10.424 1 6 5.424 1.576 1 1 1.576 5.424 6 1 10.424 1.576 11 6 6.576 10.424 11 11 10.424 6.576 6" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default TitleBar;
