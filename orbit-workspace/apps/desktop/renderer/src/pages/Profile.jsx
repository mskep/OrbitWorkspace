import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import hubAPI from '../api/hubApi';
import Topbar from '../app/layout/Topbar';
import { useAppStore } from '../state/store';
import { useI18n } from '../i18n';
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
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  // User badges
  const [userBadges, setUserBadges] = useState([]);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    try {
      const [profileData, badgesResult] = await Promise.all([
        hubAPI.profile.get(),
        hubAPI.badges.getUserBadges({})
      ]);
      setProfile(profileData);
      if (badgesResult.success) {
        setUserBadges(badgesResult.badges);
      }
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
        <Topbar title={t('profile.title')} />
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
        <Topbar title={t('profile.title')} />
        <div className="page-content">
          <p>{t('profile.noProfileData')}</p>
        </div>
      </div>
    );
  }

  const roleConfig = ROLE_CONFIG[profile.role] || ROLE_CONFIG.USER;
  const RoleIcon = roleConfig.icon;

  return (
    <div className="page">
      <Topbar title={t('profile.title')} />

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
                  {userBadges.map((badge) => (
                    <span
                      key={badge.id}
                      title={badge.description}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-full)',
                        fontSize: '12px',
                        fontWeight: '500',
                        backgroundColor: `${badge.color}15`,
                        color: badge.color,
                        border: `1px solid ${badge.color}30`
                      }}
                    >
                      <span>{badge.icon}</span>
                      {badge.display_name}
                    </span>
                  ))}
                  <div style={{ marginLeft: 'auto' }}>
                    <Button variant="danger" size="sm" onClick={handleLogout} disabled={loggingOut}>
                      <LogOut size={14} />
                      {loggingOut ? t('profile.loggingOut') : t('profile.logout')}
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
                      {t('profile.joined')}{' '}
                      {(() => {
                        const ts = profile.createdAt;
                        if (!ts || ts <= 0) return '—';
                        const msTs = ts < 1e12 ? ts * 1000 : ts;
                        return new Date(msTs).toLocaleDateString();
                      })()}
                    </div>
                    {profile.status && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Activity size={14} />
                        {t('profile.status')}{' '}
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
                    {t('profile.totalActions')}
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
                  <div style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>{t('profile.toolsUsed')}</div>
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
                  <div style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>{t('profile.loginCount')}</div>
                </div>
              </div>
            </Card>
          </div>

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
              {t('profile.permissionsAccess')}
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginBottom: '20px' }}>
              {t('profile.permissionsDesc', { role: roleConfig.label })}
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
                        {isEnabled ? t('profile.granted') : t('profile.notAvailable')}
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
