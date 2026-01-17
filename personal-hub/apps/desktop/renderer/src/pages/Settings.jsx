import React, { useEffect, useState } from 'react';
import hubAPI from '../api/hubApi';
import Topbar from '../app/layout/Topbar';
import LogViewer from '../components/LogViewer';

function Settings() {
  const [systemStatus, setSystemStatus] = useState(null);
  const [autoLaunch, setAutoLaunch] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      const status = await hubAPI.system.getStatus();
      setSystemStatus(status);
      setAutoLaunch(status.autoLaunchEnabled);
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  }

  async function handleAutoLaunchToggle() {
    setLoading(true);
    try {
      await hubAPI.system.setAutoLaunch(!autoLaunch);
      setAutoLaunch(!autoLaunch);
    } catch (error) {
      console.error('Error toggling auto launch:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <Topbar title="Settings / System" />

      <div className="page-content">
        <div className="settings-section">
          <h3>System</h3>
          <div className="setting-item">
            <label>
              <input
                type="checkbox"
                checked={autoLaunch}
                onChange={handleAutoLaunchToggle}
                disabled={loading}
              />
              <span>Launch on startup</span>
            </label>
          </div>
        </div>

        <div className="settings-section">
          <h3>Application Info</h3>
          {systemStatus && (
            <div className="info-list">
              <div className="info-item">
                <span>Version:</span>
                <span>{systemStatus.appVersion}</span>
              </div>
              <div className="info-item">
                <span>Platform:</span>
                <span>{systemStatus.platform}</span>
              </div>
            </div>
          )}
        </div>

        <div className="settings-section">
          <h3>Logs</h3>
          <LogViewer />
        </div>
      </div>
    </div>
  );
}

export default Settings;
