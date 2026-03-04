import { useI18n } from '../i18n';
import { useCallback, useEffect, useState } from 'react';
import hubAPI from '../api/hubApi';
import CustomSelect from '../components/CustomSelect';
import { useAppStore } from '../state/store';
import { playNotificationSound } from '../utils/notificationSound';
import Topbar from '../app/layout/Topbar';
import LogViewer from '../components/LogViewer';
import Card from '../components/Card';
import Badge from '../components/Badge';
import Skeleton from '../components/Skeleton';
import {
  Settings as SettingsIcon, Info, Rocket, Monitor,
  Palette, Globe, Volume2, Lock, Eye, EyeOff, Loader, CheckCircle, AlertTriangle,
  RefreshCw, Smartphone, Trash2,
} from 'lucide-react';

/* ── Reusable toggle switch ─────────────────────────────────── */
function ToggleSwitch({ checked, onChange, disabled }) {
  return (
    <label className={`toggle-switch${disabled ? ' disabled' : ''}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
      />
      <span className="toggle-switch-track">
        <span className="toggle-switch-knob" />
      </span>
    </label>
  );
}

/* ── Setting row with icon, label, description, and control ── */
function SettingRow({ icon, gradient, label, description, children }) {
  return (
    <div className="setting-row">
      <div className="setting-row-left">
        <div className="setting-row-icon" style={{ background: gradient }}>
          {icon}
        </div>
        <div>
          <div className="setting-row-label">{label}</div>
          <div className="setting-row-desc">{description}</div>
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
        <div className="container-lg">
          {/* ── Preferences ─────────────────────────────── */}
          <Card className="mb-6">
            <h3 className="section-heading">
              <SettingsIcon size={20} />
              {t('settings.preferences')}
            </h3>

            <div className="grid-gap-3">
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

              {/* Notification Sound */}
              <SettingRow
                icon={<Volume2 size={20} color="#fff" />}
                gradient="linear-gradient(135deg, #a78bfa, #7c3aed)"
                label={isFr ? 'Son de notification' : 'Notification sound'}
                description={isFr ? 'Jouer un son lors de la réception d\'un message' : 'Play a sound when receiving a new inbox message'}
              >
                <div className="flex-center flex-gap-3">
                  <button
                    className="btn-preview"
                    onClick={() => playNotificationSound()}
                    disabled={loading || !userSettings.sound_enabled}
                    title={isFr ? 'Écouter le son de notification' : 'Preview notification sound'}
                  >
                    <Volume2 size={12} />
                    {isFr ? 'Écouter' : 'Preview'}
                  </button>

                  <ToggleSwitch
                    checked={!!userSettings.sound_enabled}
                    onChange={() =>
                      updateSetting('sound_enabled', userSettings.sound_enabled ? 0 : 1)
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
          <Card className="mb-6">
            <h3 className="section-heading">
              <Lock size={20} />
              {t('settings.security')}
            </h3>

            {!showPasswordForm ? (
              <div className="setting-row">
                <div className="setting-row-left">
                  <div className="setting-row-icon" style={{ background: 'linear-gradient(135deg, #ef4444, #f97316)' }}>
                    <Lock size={20} color="#fff" />
                  </div>
                  <div>
                    <div className="setting-row-label">{t('settings.password')}</div>
                    <div className="setting-row-desc">{t('settings.passwordDesc')}</div>
                  </div>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={() => setShowPasswordForm(true)}>
                  {t('settings.change')}
                </button>
              </div>
            ) : (
              <form onSubmit={handleChangePassword}>
                {pwError && (
                  <div className="alert alert-error">
                    <AlertTriangle size={14} /> {pwError}
                  </div>
                )}

                {pwSuccess && (
                  <div className="alert alert-success">
                    <CheckCircle size={14} /> {pwSuccess}
                  </div>
                )}

                <div className="flex-col flex-gap-3 mb-4" style={{ maxWidth: '520px' }}>
                  <div className="form-group">
                    <label>{t('settings.currentPassword')}</label>
                    <div className="relative">
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
                        className="input-password-toggle"
                        onClick={() => setShowPw(!showPw)}
                      >
                        {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <div className="form-group">
                    <label>{t('settings.newPassword')}</label>
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

                  <div className="form-group">
                    <label>{t('settings.confirmNewPassword')}</label>
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

                <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
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
                    className="btn btn-primary btn-sm flex-center flex-gap-2"
                    disabled={pwLoading}
                  >
                    {pwLoading ? <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Lock size={14} />}
                    {pwLoading ? t('settings.changingPassword') : t('settings.changePassword')}
                  </button>
                </div>
              </form>
            )}
          </Card>

          {/* ── Sessions & Devices ─────────────────────── */}
          <Card className="mb-6">
            <div className="flex-between flex-gap-3 mb-4">
              <h3 className="section-heading" style={{ margin: 0 }}>
                <Smartphone size={20} />
                {isFr ? 'Sessions & appareils' : 'Sessions & Devices'}
              </h3>

              <button
                className="btn btn-secondary btn-sm flex-center flex-gap-2"
                onClick={handleRefreshDevices}
                disabled={devicesLoading || syncLoading}
              >
                <RefreshCw size={14} style={devicesLoading ? { animation: 'spin 1s linear infinite' } : undefined} />
                {isFr ? 'Rafraîchir' : 'Refresh'}
              </button>
            </div>

            <div className="grid-gap-3 mb-4">
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
              <div className="alert alert-error">
                {syncError}
              </div>
            )}

            {!syncStatus?.connected ? (
              <div className="notice-dashed">
                {isFr
                  ? 'Cloud non connecté. La session locale sur cet appareil reste active.'
                  : 'Cloud sync is disconnected. The local session on this device remains active.'}
              </div>
            ) : devicesLoading ? (
              <div className="flex-col flex-gap-3">
                <Skeleton variant="rect" style={{ height: '64px' }} />
                <Skeleton variant="rect" style={{ height: '64px' }} />
              </div>
            ) : visibleDevices.length === 0 ? (
              <div className="notice-dashed">
                {isFr ? 'Aucun appareil cloud enregistré.' : 'No registered cloud devices.'}
              </div>
            ) : (
              <div className="flex-col flex-gap-3">
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
                    <div key={device.id} className="device-card">
                      <div className="device-card-info">
                        <div className="device-card-name">
                          <span>
                            {device.device_name || (isFr ? 'Appareil sans nom' : 'Unnamed device')}
                          </span>
                          {isCurrentDevice && <Badge variant="success" size="sm">{isFr ? 'Appareil actuel' : 'Current device'}</Badge>}
                          {device.is_new_device && !isCurrentDevice && <Badge variant="warning" size="sm">{isFr ? 'Nouvel appareil' : 'New device'}</Badge>}
                        </div>
                        <div className="device-card-meta">
                          <span>{isFr ? 'ID' : 'ID'}: {device.id}</span>
                          <span>{isFr ? 'Dernière activité' : 'Last seen'}: {formatDateTime(device.last_seen_at)}</span>
                          <span>{isFr ? 'Ajouté le' : 'Added'}: {formatDateTime(device.created_at)}</span>
                          <span>
                            {isFr ? 'IP' : 'IP'}: {displayedIp}
                            {device.last_ip && (
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => toggleIpVisibility(device.id)}
                                style={{ marginLeft: 'var(--space-2)', padding: '2px 8px', fontSize: 'var(--text-xs)', lineHeight: 1.4 }}
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
                        className={`btn btn-secondary btn-sm flex-center flex-gap-2${isCurrentDevice ? '' : ' btn-revoke'}`}
                        onClick={() => handleRevokeDevice(device.id)}
                        disabled={isCurrentDevice || isRevokeLoading}
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
          <Card className="mb-6">
            <h3 className="section-heading">
              <Info size={20} />
              {t('settings.appInfo')}
            </h3>

            {loading ? (
              <div className="flex-col flex-gap-3">
                <Skeleton variant="rect" style={{ height: '60px' }} />
                <Skeleton variant="rect" style={{ height: '60px' }} />
              </div>
            ) : systemStatus ? (
              <div className="grid-gap-3">
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
              <div className="notice-dashed">
                {t('settings.unableToLoadSystemInfo')}
              </div>
            )}
          </Card>

          {/* ── Activity Logs ──────────────────────────── */}
          <Card>
            <h3 className="section-heading">
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

