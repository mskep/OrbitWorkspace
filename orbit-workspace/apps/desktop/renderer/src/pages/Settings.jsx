import { useEffect, useState } from 'react';
import hubAPI from '../api/hubApi';
import { useAppStore } from '../state/store';
import Topbar from '../app/layout/Topbar';
import LogViewer from '../components/LogViewer';
import Card from '../components/Card';
import Badge from '../components/Badge';
import Skeleton from '../components/Skeleton';
import {
  Settings as SettingsIcon, Info, Rocket, Monitor,
  Palette, Globe, Bell,
} from 'lucide-react';

/* ── Reusable toggle switch ─────────────────────────────────── */
function ToggleSwitch({ checked, onChange, disabled }) {
  return (
    <label
      style={{
        position: 'relative',
        display: 'inline-block',
        width: '52px',
        height: '28px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        flexShrink: 0,
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        style={{ opacity: 0, width: 0, height: 0 }}
      />
      <span
        style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: checked ? 'var(--accent-primary)' : 'var(--border-default)',
          transition: 'var(--transition-default)',
          borderRadius: '28px',
        }}
      >
        <span
          style={{
            position: 'absolute',
            height: '20px',
            width: '20px',
            left: checked ? '28px' : '4px',
            bottom: '4px',
            backgroundColor: 'white',
            transition: 'var(--transition-default)',
            borderRadius: '50%',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
          }}
        />
      </span>
    </label>
  );
}

/* ── Setting row with icon, label, description, and control ── */
function SettingRow({ icon, gradient, label, description, children }) {
  return (
    <div
      style={{
        padding: '16px',
        borderRadius: 'var(--radius-md)',
        backgroundColor: 'var(--bg-tertiary)',
        border: '1px solid var(--border-default)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div
          style={{
            width: '40px',
            height: '40px',
            borderRadius: 'var(--radius-md)',
            background: gradient,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {icon}
        </div>
        <div>
          <div style={{ fontWeight: '600', fontSize: '14px' }}>{label}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
            {description}
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}

/* ── Styled select ────────────────────────────────────────── */
function StyledSelect({ value, onChange, options, disabled }) {
  return (
    <select
      value={value}
      onChange={onChange}
      disabled={disabled}
      style={{
        padding: '8px 12px',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-default)',
        backgroundColor: 'var(--bg-secondary)',
        color: 'var(--text-primary)',
        fontSize: '13px',
        fontWeight: '500',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        outline: 'none',
        minWidth: '140px',
      }}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  );
}

/* ── Main Settings page ───────────────────────────────────── */
function Settings() {
  const [systemStatus, setSystemStatus] = useState(null);
  const [autoLaunch, setAutoLaunch] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toggleLoading, setToggleLoading] = useState(false);

  const userSettings = useAppStore((s) => s.userSettings);
  const setUserSettings = useAppStore((s) => s.setUserSettings);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      const [status, settingsRes] = await Promise.all([
        hubAPI.system.getStatus(),
        hubAPI.settings.get(),
      ]);
      setSystemStatus(status);
      setAutoLaunch(status.autoLaunchEnabled);
      if (settingsRes?.success && settingsRes.settings) {
        setUserSettings(settingsRes.settings);
      }
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

  async function updateSetting(key, value) {
    const prev = { ...userSettings };
    // Optimistic update
    setUserSettings({ ...userSettings, [key]: value });
    try {
      const res = await hubAPI.settings.update({ [key]: value });
      if (!res?.success) {
        setUserSettings(prev); // rollback
      }
    } catch (error) {
      console.error(`Error updating ${key}:`, error);
      setUserSettings(prev); // rollback
    }
  }

  return (
    <div className="page">
      <Topbar title="Settings" />

      <div className="page-content">
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          {/* ── Preferences ─────────────────────────────── */}
          <Card style={{ marginBottom: '24px' }}>
            <h3
              style={{
                margin: '0 0 20px 0',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '20px',
              }}
            >
              <SettingsIcon size={20} />
              Preferences
            </h3>

            <div style={{ display: 'grid', gap: '12px' }}>
              {/* Theme */}
              <SettingRow
                icon={<Palette size={20} color="#fff" />}
                gradient="linear-gradient(135deg, #667eea, #764ba2)"
                label="Theme"
                description="Choose the appearance of the application"
              >
                <StyledSelect
                  value={userSettings.theme || 'dark'}
                  onChange={(e) => updateSetting('theme', e.target.value)}
                  disabled={loading}
                  options={[
                    { value: 'dark', label: 'Dark' },
                    { value: 'light', label: 'Light' },
                  ]}
                />
              </SettingRow>

              {/* Language */}
              <SettingRow
                icon={<Globe size={20} color="#fff" />}
                gradient="linear-gradient(135deg, #43e97b, #38f9d7)"
                label="Language"
                description="Select your preferred language"
              >
                <StyledSelect
                  value={userSettings.language || 'en'}
                  onChange={(e) => updateSetting('language', e.target.value)}
                  disabled={loading}
                  options={[
                    { value: 'en', label: 'English' },
                    { value: 'fr', label: 'Francais' },
                  ]}
                />
              </SettingRow>

              {/* Notifications */}
              <SettingRow
                icon={<Bell size={20} color="#fff" />}
                gradient="linear-gradient(135deg, #f6d365, #fda085)"
                label="Notifications"
                description="Enable desktop notifications"
              >
                <ToggleSwitch
                  checked={!!userSettings.notifications_enabled}
                  onChange={() =>
                    updateSetting('notifications_enabled', userSettings.notifications_enabled ? 0 : 1)
                  }
                  disabled={loading}
                />
              </SettingRow>

              {/* Auto Launch */}
              <SettingRow
                icon={<Rocket size={20} color="#fff" />}
                gradient="linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))"
                label="Launch on Startup"
                description="Automatically start Orbit when you log in"
              >
                <ToggleSwitch
                  checked={autoLaunch}
                  onChange={handleAutoLaunchToggle}
                  disabled={toggleLoading}
                />
              </SettingRow>
            </div>
          </Card>

          {/* ── Application Info ────────────────────────── */}
          <Card style={{ marginBottom: '24px' }}>
            <h3
              style={{
                margin: '0 0 20px 0',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '20px',
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
                <SettingRow
                  icon={
                    <span style={{ fontSize: '18px', fontWeight: '700', color: '#fff' }}>v</span>
                  }
                  gradient="linear-gradient(135deg, #667eea, #764ba2)"
                  label="Version"
                  description={systemStatus.appVersion}
                >
                  <Badge variant="success">Latest</Badge>
                </SettingRow>

                <SettingRow
                  icon={<Monitor size={20} color="#fff" />}
                  gradient="linear-gradient(135deg, #f093fb, #f5576c)"
                  label="Platform"
                  description={
                    systemStatus.platform === 'win32'
                      ? 'Windows'
                      : systemStatus.platform === 'darwin'
                        ? 'macOS'
                        : systemStatus.platform === 'linux'
                          ? 'Linux'
                          : systemStatus.platform
                  }
                />
              </div>
            ) : (
              <div style={{ color: 'var(--text-secondary)' }}>
                Unable to load system information
              </div>
            )}
          </Card>

          {/* ── Activity Logs ──────────────────────────── */}
          <Card>
            <LogViewer />
          </Card>
        </div>
      </div>
    </div>
  );
}

export default Settings;
