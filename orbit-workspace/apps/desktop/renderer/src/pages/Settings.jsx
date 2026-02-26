import { useI18n } from '../i18n';
import { useCallback, useEffect, useState } from 'react';
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
  RefreshCw, Smartphone, Trash2,
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
  const [testNotificationLoading, setTestNotificationLoading] = useState(false);

  // Security / password change
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [pwForm, setPwForm] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });

  const [syncStatus, setSyncStatusLocal] = useState(null);
  const [devices, setDevices] = useState([]);
  const [syncLoading, setSyncLoading] = useState(true);
  const [devicesLoading, setDevicesLoading] = useState(false);
  const [syncError, setSyncError] = useState('');
  const [revokingDeviceId, setRevokingDeviceId] = useState('');
  const [revealedIps, setRevealedIps] = useState({});
  const session = useAppStore((s) => s.session);
  const needsUnlock = useAppStore((s) => s.needsUnlock);
  const userSettings = useAppStore((s) => s.userSettings);
  const setUserSettings = useAppStore((s) => s.setUserSettings);
  const setSyncStatus = useAppStore((s) => s.setSyncStatus);
  const { t, language } = useI18n();
  const isFr = language === 'fr';

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

  async function handleTestNotification() {
    setTestNotificationLoading(true);
    try {
      if (typeof hubAPI?.system?.testNotification !== 'function') {
        window.alert(
          isFr
            ? 'Test notifications indisponible. Redémarre l’application Electron.'
            : 'Notification test unavailable. Restart the Electron app.'
        );
        return;
      }

      const result = await hubAPI.system.testNotification();
      if (!result?.success) {
        window.alert(result?.error || (isFr ? 'Test notification impossible' : 'Notification test failed'));
      }
    } catch (error) {
      console.error('Error testing notification:', error);
      const details = error?.message || String(error || '');
      window.alert(
        isFr
          ? `Test notification impossible${details ? `: ${details}` : ''}`
          : `Notification test failed${details ? `: ${details}` : ''}`
      );
    } finally {
      setTestNotificationLoading(false);
    }
  }
  async function handleChangePassword(e) {
    e.preventDefault();
    setPwError('');
    setPwSuccess('');

    if (pwForm.newPassword.length < 8) {
      setPwError(t('auth.passwordMin8'));
      return;
    }

    if (pwForm.newPassword !== pwForm.confirmPassword) {
      setPwError(t('auth.passwordsNoMatch'));
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
      setPwError(t('auth.connectionError'));
    } finally {
      setPwLoading(false);
    }
  }


  const formatDateTime = (value) => {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString();
  };

  const maskIp = (ip) => {
    if (!ip || typeof ip !== 'string') return null;
    const value = ip.trim();
    if (!value) return null;

    if (value.includes('.')) {
      const parts = value.split('.');
      if (parts.length === 4) {
        return `${parts[0]}.${parts[1]}.***.***`;
      }
    }

    if (value.includes(':')) {
      const parts = value.split(':').filter(Boolean);
      const head = parts.slice(0, 2).join(':') || '****';
      return `${head}:****:****:****`;
    }

    return null;
  };

  const formatUserAgent = (ua) => {
    if (!ua) return '—';
    return ua.length > 84 ? `${ua.slice(0, 84)}...` : ua;
  };

  const toggleIpVisibility = (deviceId) => {
    setRevealedIps((prev) => ({
      ...prev,
      [deviceId]: !prev[deviceId],
    }));
  };

  const loadSyncStatus = useCallback(async () => {
    try {
      const status = await hubAPI.sync.getStatus();
      setSyncStatusLocal(status || null);
      if (status) setSyncStatus(status);
      return status;
    } catch (error) {
      console.error('Error loading sync status:', error);
      setSyncError(isFr ? 'Impossible de charger le statut de synchronisation' : 'Failed to load sync status');
      return null;
    } finally {
      setSyncLoading(false);
    }
  }, [isFr, setSyncStatus]);

  const loadDevices = useCallback(async (connected = syncStatus?.connected) => {
    if (!connected) {
      setDevices([]);
      setRevealedIps({});
      return;
    }

    setDevicesLoading(true);
    try {
      const result = await hubAPI.sync.getDevices();
      if (result?.success) {
        setDevices(Array.isArray(result.devices) ? result.devices : []);
        setRevealedIps({});
        setSyncError('');
      } else {
        setDevices([]);
        setRevealedIps({});
        setSyncError(result?.error || (isFr ? 'Impossible de charger les appareils' : 'Failed to load devices'));
      }
    } catch (error) {
      console.error('Error loading devices:', error);
      setDevices([]);
      setRevealedIps({});
      setSyncError(isFr ? 'Impossible de charger les appareils' : 'Failed to load devices');
    } finally {
      setDevicesLoading(false);
    }
  }, [isFr, syncStatus?.connected]);

  useEffect(() => {
    let mounted = true;
    let unsubscribe = () => {};

    (async () => {
      const status = await loadSyncStatus();
      if (!mounted) return;
      await loadDevices(status?.connected);
    })();

    if (hubAPI.sync?.onStatusChanged) {
      unsubscribe = hubAPI.sync.onStatusChanged((status) => {
        if (!mounted) return;
        setSyncStatusLocal(status || null);
        if (status) setSyncStatus(status);
        loadDevices(status?.connected);
      });
    }

    return () => {
      mounted = false;
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [loadDevices, loadSyncStatus, setSyncStatus]);

  useEffect(() => {
    if (!syncStatus?.connected) return undefined;

    const timer = setInterval(() => {
      loadDevices(true).catch(() => {});
    }, 20000);

    return () => clearInterval(timer);
  }, [syncStatus?.connected, loadDevices]);

  async function handleRefreshDevices() {
    const status = await loadSyncStatus();
    await loadDevices(status?.connected);
  }

  async function handleRevokeDevice(deviceId) {
    const confirmed = window.confirm(
      isFr
        ? 'Révoquer cet appareil ? Cette session sera immédiatement déconnectée.'
        : 'Revoke this device? Its active session will be terminated immediately.'
    );
    if (!confirmed) return;

    setRevokingDeviceId(deviceId);
    try {
      const result = await hubAPI.sync.deleteDevice({ deviceId });
      if (!result?.success) {
        setSyncError(result?.error || (isFr ? 'Échec de révocation de l\'appareil' : 'Failed to revoke device'));
      } else {
        await loadDevices(true);
      }
    } catch (error) {
      console.error('Error revoking device:', error);
      setSyncError(isFr ? 'Échec de révocation de l\'appareil' : 'Failed to revoke device');
    } finally {
      setRevokingDeviceId('');
    }
  }

  const visibleDevices = devices.length > 0
    ? devices
    : (syncStatus?.deviceId
      ? [{
        id: syncStatus.deviceId,
        device_name: isFr ? 'Appareil actuel (local)' : 'Current device (local)',
        last_seen_at: new Date().toISOString(),
        created_at: null,
      }]
      : []);

  return (
    <div className="page">
      <Topbar title={t('settings.title')} />

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
              {t('settings.preferences')}
            </h3>

            <div style={{ display: 'grid', gap: '12px' }}>
              {/* Theme */}
              <SettingRow
                icon={<Palette size={20} color="#fff" />}
                gradient="linear-gradient(135deg, #667eea, #764ba2)"
                label={t('settings.theme')}
                description={t('settings.themeDesc')}
              >
                <CustomSelect
                  value={userSettings.theme || 'dark'}
                  onChange={(val) => updateSetting('theme', val)}
                  disabled={loading}
                  options={[
                    { value: 'dark', label: t('settings.themeDark') },
                    { value: 'light', label: t('settings.themeLight') },
                  ]}
                />
              </SettingRow>

              {/* Language */}
              <SettingRow
                icon={<Globe size={20} color="#fff" />}
                gradient="linear-gradient(135deg, #43e97b, #38f9d7)"
                label={t('settings.language')}
                description={t('settings.languageDesc')}
              >
                <CustomSelect
                  value={userSettings.language || 'en'}
                  onChange={(val) => updateSetting('language', val)}
                  disabled={loading}
                  options={[
                    { value: 'en', label: t('settings.languageEnglish') },
                    { value: 'fr', label: t('settings.languageFrench') },
                  ]}
                />
              </SettingRow>

              {/* Notifications */}
              <SettingRow
                icon={<Bell size={20} color="#fff" />}
                gradient="linear-gradient(135deg, #f6d365, #fda085)"
                label={t('settings.notifications')}
                description={t('settings.notificationsDesc')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <button
                    onClick={handleTestNotification}
                    disabled={loading || testNotificationLoading || !userSettings.notifications_enabled}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 10px',
                      borderRadius: '10px',
                      border: '1px solid var(--border-default)',
                      background: 'var(--bg-secondary)',
                      color: 'var(--text-primary)',
                      fontSize: '12px',
                      fontWeight: '600',
                      cursor: loading || testNotificationLoading || !userSettings.notifications_enabled ? 'not-allowed' : 'pointer',
                      opacity: loading || testNotificationLoading || !userSettings.notifications_enabled ? 0.55 : 1,
                    }}
                    title={isFr ? 'Envoie une notification locale de test' : 'Send a local test notification'}
                  >
                    {testNotificationLoading ? <Loader size={12} /> : <Bell size={12} />}
                    {testNotificationLoading ? (isFr ? 'Test...' : 'Testing...') : (isFr ? 'Tester' : 'Test')}
                  </button>

                  <ToggleSwitch
                    checked={!!userSettings.notifications_enabled}
                    onChange={() =>
                      updateSetting('notifications_enabled', userSettings.notifications_enabled ? 0 : 1)
                    }
                    disabled={loading}
                  />
                </div>
              </SettingRow>

              {/* Auto Launch */}
              <SettingRow
                icon={<Rocket size={20} color="#fff" />}
                gradient="linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))"
                label={t('settings.startup')}
                description={t('settings.startupDesc')}
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
              {t('settings.security')}
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
                    <div style={{ fontWeight: '600', fontSize: '14px' }}>{t('settings.password')}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                      {t('settings.passwordDesc')}
                    </div>
                  </div>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={() => setShowPasswordForm(true)}>
                  {t('settings.change')}
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
                      {t('settings.currentPassword')}
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showPw ? 'text' : 'password'}
                        value={pwForm.oldPassword}
                        onChange={(e) => { setPwForm((p) => ({ ...p, oldPassword: e.target.value })); setPwError(''); }}
                        required
                        placeholder={t('settings.currentPasswordPlaceholder')}
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
                      {t('settings.newPassword')}
                    </label>
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={pwForm.newPassword}
                      onChange={(e) => { setPwForm((p) => ({ ...p, newPassword: e.target.value })); setPwError(''); }}
                      required
                      minLength={8}
                      placeholder={t('settings.newPasswordPlaceholder')}
                      autoComplete="new-password"
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      {t('settings.confirmNewPassword')}
                    </label>
                    <input
                      type={showPw ? 'text' : 'password'}
                      value={pwForm.confirmPassword}
                      onChange={(e) => { setPwForm((p) => ({ ...p, confirmPassword: e.target.value })); setPwError(''); }}
                      required
                      minLength={8}
                      placeholder={t('settings.confirmNewPasswordPlaceholder')}
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
                    {t('common.cancel')}
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm"
                    disabled={pwLoading}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    {pwLoading ? <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Lock size={14} />}
                    {pwLoading ? t('settings.changingPassword') : t('settings.changePassword')}
                  </button>
                </div>
              </form>
            )}
          </Card>

          {/* ── Sessions & Devices ─────────────────────── */}
          <Card style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <h3
                style={{
                  margin: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '20px',
                }}
              >
                <Smartphone size={20} />
                {isFr ? 'Sessions & appareils' : 'Sessions & Devices'}
              </h3>

              <button
                className="btn btn-secondary btn-sm"
                onClick={handleRefreshDevices}
                disabled={devicesLoading || syncLoading}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <RefreshCw size={14} style={devicesLoading ? { animation: 'spin 1s linear infinite' } : undefined} />
                {isFr ? 'Rafraîchir' : 'Refresh'}
              </button>
            </div>

            <div style={{ display: 'grid', gap: '12px', marginBottom: '16px' }}>
              <SettingRow
                icon={<Lock size={20} color="#fff" />}
                gradient="linear-gradient(135deg, #f59e0b, #d97706)"
                label={isFr ? 'Session actuelle' : 'Current Session'}
                description={session ? `${session.username}${session.email ? ` • ${session.email}` : ''}` : (isFr ? 'Session non disponible' : 'Session unavailable')}
              >
                <Badge variant={needsUnlock ? 'warning' : 'success'}>
                  {needsUnlock ? (isFr ? 'Verrouillée' : 'Locked') : (isFr ? 'Active' : 'Active')}
                </Badge>
              </SettingRow>
            </div>

            {syncError && (
              <div
                style={{
                  padding: '10px 14px',
                  backgroundColor: 'var(--status-error-glow)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: '16px',
                  fontSize: '13px',
                  color: 'var(--status-error)',
                }}
              >
                {syncError}
              </div>
            )}

            {!syncStatus?.connected ? (
              <div
                style={{
                  padding: '14px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px dashed var(--border-default)',
                  color: 'var(--text-tertiary)',
                  fontSize: '13px',
                }}
              >
                {isFr
                  ? 'Cloud non connecté. La session locale sur cet appareil reste active.'
                  : 'Cloud sync is disconnected. The local session on this device remains active.'}
              </div>
            ) : devicesLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <Skeleton variant="rect" style={{ height: '64px' }} />
                <Skeleton variant="rect" style={{ height: '64px' }} />
              </div>
            ) : visibleDevices.length === 0 ? (
              <div style={{ color: 'var(--text-tertiary)', fontSize: '13px' }}>
                {isFr ? 'Aucun appareil cloud enregistré.' : 'No registered cloud devices.'}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {visibleDevices.map((device) => {
                  const isCurrentDevice = !!syncStatus?.deviceId && device.id === syncStatus.deviceId;
                  const isRevokeLoading = revokingDeviceId === device.id;
                  const isIpVisible = Boolean(revealedIps[device.id]);
                  const maskedIp = device.last_ip_masked || maskIp(device.last_ip);
                  const displayedIp = isIpVisible
                    ? (device.last_ip || maskedIp || '—')
                    : (maskedIp || '—');
                  const locationLabel = [device.last_city, device.last_region, device.last_country]
                    .filter(Boolean)
                    .join(', ') || (isFr ? 'Localisation inconnue' : 'Unknown location');

                  return (
                    <div
                      key={device.id}
                      style={{
                        padding: '12px 14px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-default)',
                        backgroundColor: 'var(--bg-tertiary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: '600', fontSize: '14px', color: 'var(--text-primary)' }}>
                            {device.device_name || (isFr ? 'Appareil sans nom' : 'Unnamed device')}
                          </span>
                          {isCurrentDevice && <Badge variant="success" size="sm">{isFr ? 'Appareil actuel' : 'Current device'}</Badge>}
                          {device.is_new_device && !isCurrentDevice && <Badge variant="warning" size="sm">{isFr ? 'Nouvel appareil' : 'New device'}</Badge>}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          <span>{isFr ? 'ID' : 'ID'}: {device.id}</span>
                          <span>{isFr ? 'Dernière activité' : 'Last seen'}: {formatDateTime(device.last_seen_at)}</span>
                          <span>{isFr ? 'Ajouté le' : 'Added'}: {formatDateTime(device.created_at)}</span>
                          <span>
                            {isFr ? 'IP' : 'IP'}: {displayedIp}
                            {device.last_ip && (
                              <button
                                type="button"
                                className="btn btn-secondary"
                                onClick={() => toggleIpVisibility(device.id)}
                                style={{ marginLeft: '8px', padding: '2px 8px', fontSize: '11px', lineHeight: 1.4 }}
                              >
                                {isIpVisible
                                  ? (isFr ? 'Masquer' : 'Hide')
                                  : (isFr ? 'Afficher' : 'Reveal')}
                              </button>
                            )}
                          </span>
                          <span>{isFr ? 'Localisation' : 'Location'}: {locationLabel}</span>
                          <span title={device.last_user_agent || ''}>{isFr ? 'Agent' : 'User agent'}: {formatUserAgent(device.last_user_agent)}</span>
                        </div>
                      </div>

                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleRevokeDevice(device.id)}
                        disabled={isCurrentDevice || isRevokeLoading}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          borderColor: isCurrentDevice ? 'var(--border-default)' : 'rgba(239,68,68,0.45)',
                          color: isCurrentDevice ? 'var(--text-tertiary)' : '#ef4444',
                        }}
                      >
                        <Trash2 size={14} />
                        {isCurrentDevice
                          ? (isFr ? 'En cours' : 'Current')
                          : (isRevokeLoading ? (isFr ? 'Révocation...' : 'Revoking...') : (isFr ? 'Révoquer' : 'Revoke'))}
                      </button>
                    </div>
                  );
                })}
              </div>
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
              {t('settings.appInfo')}
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
                  label={t('common.version')}
                  description={systemStatus.appVersion}
                >
                  <Badge variant="success">{t('common.latest')}</Badge>
                </SettingRow>

                <SettingRow
                  icon={<Monitor size={20} color="#fff" />}
                  gradient="linear-gradient(135deg, #f093fb, #f5576c)"
                  label={t('common.platform')}
                  description={
                    systemStatus.platform === 'win32'
                      ? t('settings.platformWindows')
                      : systemStatus.platform === 'darwin'
                        ? t('settings.platformMac')
                        : systemStatus.platform === 'linux'
                          ? t('settings.platformLinux')
                          : systemStatus.platform
                  }
                />
              </div>
            ) : (
              <div style={{ color: 'var(--text-secondary)' }}>
                {t('settings.unableToLoadSystemInfo')}
              </div>
            )}
          </Card>

          {/* ── Activity Logs ──────────────────────────── */}
          <Card>
            <h3
              style={{
                margin: '0 0 20px 0',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '20px',
              }}
            >
              {t('settings.activityLogs')}
            </h3>
            <LogViewer />
          </Card>
        </div>
      </div>
    </div>
  );
}

export default Settings;

