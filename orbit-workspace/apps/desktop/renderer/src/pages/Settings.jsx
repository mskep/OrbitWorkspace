import { useEffect, useState } from 'react';
import hubAPI from '../api/hubApi';
import Topbar from '../app/layout/Topbar';
import LogViewer from '../components/LogViewer';
import Card from '../components/Card';
import Badge from '../components/Badge';
import Skeleton from '../components/Skeleton';
import { Settings as SettingsIcon, Info, Rocket, Monitor } from 'lucide-react';

function Settings() {
  const [systemStatus, setSystemStatus] = useState(null);
  const [autoLaunch, setAutoLaunch] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toggleLoading, setToggleLoading] = useState(false);

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
    } finally {
      setLoading(false);
    }
  }

  async function handleAutoLaunchToggle() {
    setToggleLoading(true);
    try {
      await hubAPI.system.setAutoLaunch(!autoLaunch);
      setAutoLaunch(!autoLaunch);
    } catch (error) {
      console.error('Error toggling auto launch:', error);
    } finally {
      setToggleLoading(false);
    }
  }

  return (
    <div className="page">
      <Topbar title="Settings" />

      <div className="page-content">
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          {/* System Settings Card */}
          <Card style={{ marginBottom: '24px' }}>
            <h3
              style={{
                margin: '0 0 20px 0',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '20px'
              }}
            >
              <SettingsIcon size={20} />
              System Preferences
            </h3>

            <div
              style={{
                padding: '16px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg-tertiary)',
                border: '1px solid var(--border-default)'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '16px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: 'var(--radius-md)',
                      background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <Rocket size={20} color="#fff" />
                  </div>
                  <div>
                    <div style={{ fontWeight: '600', fontSize: '14px' }}>Launch on Startup</div>
                    <div
                      style={{
                        fontSize: '12px',
                        color: 'var(--text-tertiary)',
                        marginTop: '2px'
                      }}
                    >
                      Automatically start Orbit when you log in
                    </div>
                  </div>
                </div>

                <label
                  style={{
                    position: 'relative',
                    display: 'inline-block',
                    width: '52px',
                    height: '28px',
                    cursor: toggleLoading ? 'not-allowed' : 'pointer',
                    opacity: toggleLoading ? 0.6 : 1
                  }}
                >
                  <input
                    type="checkbox"
                    checked={autoLaunch}
                    onChange={handleAutoLaunchToggle}
                    disabled={toggleLoading}
                    style={{ opacity: 0, width: 0, height: 0 }}
                  />
                  <span
                    style={{
                      position: 'absolute',
                      cursor: 'pointer',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      backgroundColor: autoLaunch ? 'var(--accent-primary)' : 'var(--border-default)',
                      transition: 'var(--transition-default)',
                      borderRadius: '28px'
                    }}
                  >
                    <span
                      style={{
                        position: 'absolute',
                        content: '""',
                        height: '20px',
                        width: '20px',
                        left: autoLaunch ? '28px' : '4px',
                        bottom: '4px',
                        backgroundColor: 'white',
                        transition: 'var(--transition-default)',
                        borderRadius: '50%',
                        boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
                      }}
                    />
                  </span>
                </label>
              </div>
            </div>
          </Card>

          {/* Application Info Card */}
          <Card style={{ marginBottom: '24px' }}>
            <h3
              style={{
                margin: '0 0 20px 0',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '20px'
              }}
            >
              <Info size={20} />
              Application Information
            </h3>

            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <Skeleton variant="rect" style={{ height: '60px' }} />
                <Skeleton variant="rect" style={{ height: '60px' }} />
              </div>
            ) : systemStatus ? (
              <div style={{ display: 'grid', gap: '12px' }}>
                <div
                  style={{
                    padding: '16px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-default)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: 'var(--radius-md)',
                        background: 'linear-gradient(135deg, #667eea, #764ba2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '18px',
                        fontWeight: '700',
                        color: '#fff'
                      }}
                    >
                      v
                    </div>
                    <div>
                      <div
                        style={{
                          fontSize: '12px',
                          color: 'var(--text-tertiary)',
                          marginBottom: '2px'
                        }}
                      >
                        Version
                      </div>
                      <div style={{ fontWeight: '600', fontSize: '14px' }}>{systemStatus.appVersion}</div>
                    </div>
                  </div>
                  <Badge variant="success">Latest</Badge>
                </div>

                <div
                  style={{
                    padding: '16px',
                    borderRadius: 'var(--radius-md)',
                    backgroundColor: 'var(--bg-tertiary)',
                    border: '1px solid var(--border-default)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                      style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: 'var(--radius-md)',
                        background: 'linear-gradient(135deg, #f093fb, #f5576c)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <Monitor size={20} color="#fff" />
                    </div>
                    <div>
                      <div
                        style={{
                          fontSize: '12px',
                          color: 'var(--text-tertiary)',
                          marginBottom: '2px'
                        }}
                      >
                        Platform
                      </div>
                      <div style={{ fontWeight: '600', fontSize: '14px' }}>
                        {systemStatus.platform === 'win32'
                          ? 'Windows'
                          : systemStatus.platform === 'darwin'
                            ? 'macOS'
                            : systemStatus.platform === 'linux'
                              ? 'Linux'
                              : systemStatus.platform}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ color: 'var(--text-secondary)' }}>Unable to load system information</div>
            )}
          </Card>

          {/* Activity Logs Card */}
          <Card>
            <LogViewer />
          </Card>
        </div>
      </div>
    </div>
  );
}

export default Settings;
