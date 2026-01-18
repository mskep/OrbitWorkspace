import React, { useEffect, useState } from 'react';
import hubAPI from '../api/hubApi';
import Topbar from '../app/layout/Topbar';
import { useAppStore } from '../state/store';
import {
  User, Shield, Star, Activity, Calendar,
  CheckCircle, XCircle, Crown, Settings as SettingsIcon
} from 'lucide-react';
import Card from '../components/Card';
import Badge from '../components/Badge';
import Skeleton from '../components/Skeleton';

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
  DEVELOPER: {
    label: 'Developer',
    color: 'primary',
    icon: SettingsIcon,
    gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'
  },
  VIP: {
    label: 'VIP Member',
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
  const { profile, setProfile } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [permissionLoading, setPermissionLoading] = useState(false);

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

  async function handlePermissionToggle(permission) {
    setPermissionLoading(true);
    try {
      const isEnabled = profile.permissions.includes(permission);
      await hubAPI.permissions.set({ perm: permission, enabled: !isEnabled });
      await loadProfile();
    } catch (error) {
      console.error('Error toggling permission:', error);
    } finally {
      setPermissionLoading(false);
    }
  }

  function getInitials(username) {
    return username
      .split(' ')
      .map(part => part[0])
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
            <div style={{
              background: roleConfig.gradient,
              height: '120px',
              margin: '-24px -24px 0 -24px',
              borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0'
            }} />

            <div style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '24px',
              marginTop: '-60px',
              padding: '0 24px 24px 24px'
            }}>
              {/* Avatar */}
              <div style={{
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
              }}>
                {profile.avatar || getInitials(profile.username)}
              </div>

              {/* Profile Info */}
              <div style={{ flex: 1, paddingTop: '70px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                  <h2 style={{ margin: 0, fontSize: '28px', fontWeight: '700' }}>
                    {profile.username}
                  </h2>
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
                </div>

                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '24px',
                  color: 'var(--text-secondary)',
                  fontSize: '14px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Calendar size={14} />
                    Joined {new Date(profile.createdAt).toLocaleDateString()}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Activity size={14} />
                    Last login {new Date(profile.lastLoginAt || profile.createdAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Stats Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '24px',
            marginBottom: '32px'
          }}>
            <Card>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: 'var(--radius-lg)',
                  background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
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
                <div style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: 'var(--radius-lg)',
                  background: 'linear-gradient(135deg, #f093fb, #f5576c)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <SettingsIcon size={28} color="#fff" />
                </div>
                <div>
                  <div style={{ fontSize: '28px', fontWeight: '700', lineHeight: 1 }}>
                    {profile.stats?.toolsUsed || 0}
                  </div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>
                    Tools Used
                  </div>
                </div>
              </div>
            </Card>

            <Card>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: 'var(--radius-lg)',
                  background: 'linear-gradient(135deg, #667eea, #764ba2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <User size={28} color="#fff" />
                </div>
                <div>
                  <div style={{ fontSize: '28px', fontWeight: '700', lineHeight: 1 }}>
                    {profile.stats?.loginCount || 1}
                  </div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>
                    Login Count
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Permissions Section */}
          <Card>
            <h3 style={{
              margin: '0 0 20px 0',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '20px'
            }}>
              <Shield size={20} />
              Permissions & Access
            </h3>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '12px'
            }}>
              {Object.entries(PERMISSION_LABELS).map(([key, label]) => {
                const isEnabled = profile.permissions.includes(key);
                return (
                  <div
                    key={key}
                    onClick={() => handlePermissionToggle(key)}
                    style={{
                      padding: '16px',
                      borderRadius: 'var(--radius-md)',
                      border: `2px solid ${isEnabled ? 'var(--accent-primary)' : 'var(--border-default)'}`,
                      backgroundColor: isEnabled ? 'var(--accent-bg)' : 'var(--bg-tertiary)',
                      cursor: permissionLoading ? 'not-allowed' : 'pointer',
                      transition: 'all var(--transition-default)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      opacity: permissionLoading ? 0.6 : 1
                    }}
                  >
                    <div style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      backgroundColor: isEnabled ? 'var(--status-success)' : 'var(--border-default)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      {isEnabled ? (
                        <CheckCircle size={16} color="#fff" />
                      ) : (
                        <XCircle size={16} color="var(--text-tertiary)" />
                      )}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontWeight: '600',
                        fontSize: '14px',
                        color: isEnabled ? 'var(--text-primary)' : 'var(--text-secondary)'
                      }}>
                        {label}
                      </div>
                      <div style={{
                        fontSize: '12px',
                        color: 'var(--text-tertiary)',
                        marginTop: '2px'
                      }}>
                        {isEnabled ? 'Enabled' : 'Disabled'}
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
