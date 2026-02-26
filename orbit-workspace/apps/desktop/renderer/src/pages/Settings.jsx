import { useEffect, useState } from 'react';
import hubAPI from '../api/hubApi';
import CustomSelect from '../components/CustomSelect';
import { useAppStore } from '../state/store';
import Topbar from '../app/layout/Topbar';
import LogViewer from '../components/LogViewer';
import Card from '../components/Card';
import Badge from '../components/Badge';
import Skeleton from '../components/Skeleton';
import {
  Settings as SettingsIcon, Info, Rocket, Monitor,
  Palette, Globe, Bell, Lock, Eye, EyeOff, Loader, CheckCircle, AlertTriangle,
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

/* ── Main Settings page ───────────────────────────────────── */
function Settings() {
  const [systemStatus, setSystemStatus] = useState(null);
  const [autoLaunch, setAutoLaunch] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toggleLoading, setToggleLoading] = useState(false);

  // Security / password change
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [pwForm, setPwForm] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });

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

  async function handleChangePassword(e) {
    e.preventDefault();
    setPwError('');
    setPwSuccess('');

    if (pwForm.newPassword.length < 8) {
      setPwError('New password must be at least 8 characters');
      return;
    }

    if (pwForm.newPassword !== pwForm.confirmPassword) {
      setPwError('Passwords do not match');
      return;
    }

    setPwLoading(true);
    try {
      const result = await hubAPI.auth.changePassword({
        oldPassword: pwForm.oldPassword,
        newPassword: pwForm.newPassword,
      });

      if (result.success) {
        setPwSuccess(result.message || 'Password changed successfully');
        setPwForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
        setTimeout(() => {
          setShowPasswordForm(false);
          setPwSuccess('');
        }, 1500);
      } else {
        setPwError(result.error || 'Password change failed');
      }
    } catch (error) {
      setPwError('An error occurred. Please try again.');
    } finally {
      setPwLoading(false);
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
                <CustomSelect
                  value={userSettings.theme || 'dark'}
                  onChange={(val) => updateSetting('theme', val)}
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
                <CustomSelect
                  value={userSettings.language || 'en'}
                  onChange={(val) => updateSetting('language', val)}
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

          {/* ── Security ────────────────────────────────── */}
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
              <Lock size={20} />
              Security
            </h3>

            {!showPasswordForm ? (
              <div
                style={{
                  padding: '16px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-default)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div
                    style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: 'var(--radius-md)',
                      background: 'linear-gradient(135deg, #ef4444, #f97316)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Lock size={20} color="#fff" />
                  </div>
                  <div>
                    <div style={{ fontWeight: '600', fontSize: '14px' }}>Password</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                      Update your account password without disconnecting the app
                    </div>
                  </div>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={() => setShowPasswordForm(true)}>
                  Change
                </button>
              </div>
            ) : (
              <form onSubmit={handleChangePassword}>
                {pwError && (
                  <div
                    style={{
                      padding: '10px 14px',
                      backgroundColor: 'var(--status-error-glow)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      borderRadius: 'var(--radius-md)',
                      marginBottom: '16px',
                      fontSize: '13px',
                      color: 'var(--status-error)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <AlertTriangle size={14} /> {pwError}
                  </div>
                )}

                {pwSuccess && (
                  <div
                    style={{
                      padding: '10px 14px',
                      backgroundColor: 'var(--status-success-glow)',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                      borderRadius: 'var(--radius-md)',
                      marginBottom: '16px',
                      fontSize: '13px',
                      color: 'var(--status-success)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <CheckCircle size={14} /> {pwSuccess}
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px', maxWidth: '520px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      Current Password
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showPw ? 'text' : 'password'}
                        value={pwForm.oldPassword}
                        onChange={(e) => { setPwForm((p) => ({ ...p, oldPassword: e.target.value })); setPwError(''); }}
                        required
                        placeholder="Enter current password"
                        autoComplete="current-password"
                        style={{ paddingRight: '40px' }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPw(!showPw)}
                        style={{
                          position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                          background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', padding: '4px'
                        }}
                      >
                        {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      New Password
                    </label>
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={pwForm.newPassword}
                      onChange={(e) => { setPwForm((p) => ({ ...p, newPassword: e.target.value })); setPwError(''); }}
                      required
                      minLength={8}
                      placeholder="Min 8 characters"
                      autoComplete="new-password"
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      Confirm New Password
                    </label>
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={pwForm.confirmPassword}
                      onChange={(e) => { setPwForm((p) => ({ ...p, confirmPassword: e.target.value })); setPwError(''); }}
                      required
                      minLength={8}
                      placeholder="Repeat new password"
                      autoComplete="new-password"
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    type="button"
                    onClick={() => {
                      setShowPasswordForm(false);
                      setPwError('');
                      setPwSuccess('');
                      setPwForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
                    }}
                    disabled={pwLoading}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm"
                    disabled={pwLoading}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    {pwLoading ? <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Lock size={14} />}
                    {pwLoading ? 'Changing...' : 'Change Password'}
                  </button>
                </div>
              </form>
            )}
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
