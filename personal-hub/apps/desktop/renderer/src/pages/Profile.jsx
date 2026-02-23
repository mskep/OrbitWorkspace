import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import hubAPI from '../api/hubApi';
import Topbar from '../app/layout/Topbar';
import { useAppStore } from '../state/store';
import {
  User,
  Shield,
  Star,
  Activity,
  Calendar,
  CheckCircle,
  XCircle,
  Crown,
  Settings as SettingsIcon,
  LogOut,
  Lock,
  Eye,
  EyeOff,
  Loader
} from 'lucide-react';
import Card from '../components/Card';
import Badge from '../components/Badge';
import Skeleton from '../components/Skeleton';
import Button from '../components/Button';

const PERMISSION_LABELS = {
  NET_ACCESS: 'Network Access',
  FS_READ: 'Read Files',
  FS_WRITE: 'Write Files',
  FS_PICKER: 'File Picker',
  RUN_TOOL: 'Run Tools',
  SPAWN_PROCESS: 'Spawn Processes',
  CLIPBOARD: 'Clipboard Access',
  NOTIFICATIONS: 'Notifications',
  TRAY_CONTROL: 'Tray Control',
  PREMIUM_TOOLS: 'Premium Tools',
  MANAGE_USERS: 'Manage Users',
  VIEW_ALL_LOGS: 'View All Logs',
  SYSTEM_CONFIG: 'System Config',
  INSTALL_TOOLS: 'Install Tools'
};

const ROLE_CONFIG = {
  ADMIN: {
    label: 'Administrator',
    color: 'danger',
    icon: Shield,
    gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
  },
  DEV: {
    label: 'Developer',
    color: 'primary',
    icon: SettingsIcon,
    gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'
  },
  PREMIUM: {
    label: 'Premium',
    color: 'warning',
    icon: Crown,
    gradient: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)'
  },
  USER: {
    label: 'User',
    color: 'default',
    icon: User,
    gradient: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)'
  }
};

function Profile() {
  const navigate = useNavigate();
  const { profile, setProfile, setSession } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  // Password change state
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [pwForm, setPwForm] = useState({ oldPassword: '', newPassword: '', confirmPassword: '' });

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    try {
      const profileData = await hubAPI.profile.get();
      setProfile(profileData);
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await hubAPI.auth.logout();
      setSession(null);
      setProfile(null);
      navigate('/login');
    } catch (error) {
      console.error('Error logging out:', error);
      setLoggingOut(false);
    }
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    setPwError('');
    setPwSuccess('');

    if (pwForm.newPassword.length < 6) {
      setPwError('New password must be at least 6 characters');
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
        newPassword: pwForm.newPassword
      });

      if (result.success) {
        setPwSuccess('Password changed successfully');
        setPwForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
        setTimeout(() => {
          setShowPasswordForm(false);
          setPwSuccess('');
        }, 2000);
      } else {
        setPwError(result.error || 'Password change failed');
      }
    } catch (err) {
      setPwError('An error occurred. Please try again.');
    } finally {
      setPwLoading(false);
    }
  }

  function getInitials(username) {
    return username
      .split(' ')
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  if (loading) {
    return (
      <div className="page">
        <Topbar title="Profile" />
        <div className="page-content">
          <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
            <Skeleton variant="rect" style={{ height: '200px', marginBottom: '24px' }} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '24px' }}>
              <Skeleton variant="rect" style={{ height: '120px' }} />
              <Skeleton variant="rect" style={{ height: '120px' }} />
              <Skeleton variant="rect" style={{ height: '120px' }} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="page">
        <Topbar title="Profile" />
        <div className="page-content">
          <p>No profile data available</p>
        </div>
      </div>
    );
  }

  const roleConfig = ROLE_CONFIG[profile.role] || ROLE_CONFIG.USER;
  const RoleIcon = roleConfig.icon;

  return (
    <div className="page">
      <Topbar title="Profile" />

      <div className="page-content">
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          {/* Profile Header Card */}
          <Card style={{ marginBottom: '32px', overflow: 'visible' }}>
            <div
              style={{
                background: roleConfig.gradient,
                height: '120px',
                margin: '-24px -24px 0 -24px',
                borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0'
              }}
            />

            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '24px',
                marginTop: '-60px',
                padding: '0 24px 24px 24px'
              }}
            >
              {/* Avatar */}
              <div
                style={{
                  width: '120px',
                  height: '120px',
                  borderRadius: '50%',
                  background: roleConfig.gradient,
                  border: '4px solid var(--bg-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '36px',
                  fontWeight: '700',
                  color: '#fff',
                  textShadow: '0 2px 4px rgba(0,0,0,0.2)',
                  flexShrink: 0
                }}
              >
                {profile.avatar || getInitials(profile.username)}
              </div>

              {/* Profile Info */}
              <div style={{ flex: 1, paddingTop: '70px' }}>
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px', flexWrap: 'wrap' }}
                >
                  <h2 style={{ margin: 0, fontSize: '28px', fontWeight: '700' }}>{profile.username}</h2>
                  <Badge variant={roleConfig.color}>
                    <RoleIcon size={12} style={{ marginRight: '4px' }} />
                    {roleConfig.label}
                  </Badge>
                  {profile.premiumEnabled && (
                    <Badge variant="premium">
                      <Star size={12} style={{ marginRight: '4px' }} />
                      Premium
                    </Badge>
                  )}
                  <div style={{ marginLeft: 'auto' }}>
                    <Button variant="danger" size="sm" onClick={handleLogout} disabled={loggingOut}>
                      <LogOut size={14} />
                      {loggingOut ? 'Logging out...' : 'Logout'}
                    </Button>
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    color: 'var(--text-secondary)',
                    fontSize: '14px'
                  }}
                >
                  {profile.email && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <User size={14} />
                      {profile.email}
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Calendar size={14} />
                      Joined{' '}
                      {(() => {
                        const ts = profile.createdAt;
                        if (!ts || ts <= 0) return '—';
                        // Handle seconds vs milliseconds
                        const msTs = ts < 1e12 ? ts * 1000 : ts;
                        return new Date(msTs).toLocaleDateString();
                      })()}
                    </div>
                    {profile.status && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Activity size={14} />
                        Status:{' '}
                        <span
                          style={{
                            color: profile.status === 'active' ? '#10b981' : '#ef4444',
                            fontWeight: '600',
                            textTransform: 'capitalize'
                          }}
                        >
                          {profile.status}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Stats Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: '24px',
              marginBottom: '32px'
            }}
          >
            <Card>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div
                  style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: 'var(--radius-lg)',
                    background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <Activity size={28} color="#fff" />
                </div>
                <div>
                  <div style={{ fontSize: '28px', fontWeight: '700', lineHeight: 1 }}>
                    {profile.stats?.totalActions || 0}
                  </div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>
                    Total Actions
                  </div>
                </div>
              </div>
            </Card>

            <Card>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div
                  style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: 'var(--radius-lg)',
                    background: 'linear-gradient(135deg, #f093fb, #f5576c)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <SettingsIcon size={28} color="#fff" />
                </div>
                <div>
                  <div style={{ fontSize: '28px', fontWeight: '700', lineHeight: 1 }}>
                    {profile.stats?.toolsUsed || 0}
                  </div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>Tools Used</div>
                </div>
              </div>
            </Card>

            <Card>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div
                  style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: 'var(--radius-lg)',
                    background: 'linear-gradient(135deg, #667eea, #764ba2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <User size={28} color="#fff" />
                </div>
                <div>
                  <div style={{ fontSize: '28px', fontWeight: '700', lineHeight: 1 }}>
                    {profile.stats?.loginCount || 1}
                  </div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>Login Count</div>
                </div>
              </div>
            </Card>
          </div>

          {/* Security Section */}
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
                  justifyContent: 'space-between'
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
                    <Lock size={20} color="#fff" />
                  </div>
                  <div>
                    <div style={{ fontWeight: '600', fontSize: '14px' }}>Password</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                      Change your account password
                    </div>
                  </div>
                </div>
                <Button variant="secondary" size="sm" onClick={() => setShowPasswordForm(true)}>
                  Change
                </Button>
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
                      gap: '8px'
                    }}
                  >
                    {pwError}
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
                      gap: '8px'
                    }}
                  >
                    <CheckCircle size={14} /> {pwSuccess}
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                      Current Password
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showPw ? 'text' : 'password'}
                        value={pwForm.oldPassword}
                        onChange={(e) => { setPwForm(p => ({ ...p, oldPassword: e.target.value })); setPwError(''); }}
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
                      onChange={(e) => { setPwForm(p => ({ ...p, newPassword: e.target.value })); setPwError(''); }}
                      required
                      minLength={6}
                      placeholder="Min 6 characters"
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
                      onChange={(e) => { setPwForm(p => ({ ...p, confirmPassword: e.target.value })); setPwError(''); }}
                      required
                      minLength={6}
                      placeholder="Repeat new password"
                      autoComplete="new-password"
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <Button
                    variant="secondary"
                    size="sm"
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
                  </Button>
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

          {/* Permissions Section (read-only, derived from role) */}
          <Card>
            <h3
              style={{
                margin: '0 0 8px 0',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '20px'
              }}
            >
              <Shield size={20} />
              Permissions & Access
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginBottom: '20px' }}>
              Permissions are granted by your role ({roleConfig.label}). Contact an admin to change your role.
            </p>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: '12px'
              }}
            >
              {Object.entries(PERMISSION_LABELS).map(([key, label]) => {
                const isEnabled = profile.permissions.includes(key);
                return (
                  <div
                    key={key}
                    style={{
                      padding: '16px',
                      borderRadius: 'var(--radius-md)',
                      border: `1px solid ${isEnabled ? 'var(--accent-primary)' : 'var(--border-default)'}`,
                      backgroundColor: isEnabled ? 'rgba(99, 102, 241, 0.05)' : 'var(--bg-tertiary)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px'
                    }}
                  >
                    <div
                      style={{
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        backgroundColor: isEnabled ? 'var(--status-success)' : 'var(--border-default)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}
                    >
                      {isEnabled ? (
                        <CheckCircle size={16} color="#fff" />
                      ) : (
                        <XCircle size={16} color="var(--text-tertiary)" />
                      )}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontWeight: '600',
                          fontSize: '14px',
                          color: isEnabled ? 'var(--text-primary)' : 'var(--text-secondary)'
                        }}
                      >
                        {label}
                      </div>
                      <div
                        style={{
                          fontSize: '12px',
                          color: 'var(--text-tertiary)',
                          marginTop: '2px'
                        }}
                      >
                        {isEnabled ? 'Granted' : 'Not available'}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default Profile;
