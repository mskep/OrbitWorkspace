import React, { useState, useEffect } from 'react';
import {
  Shield,
  Users,
  Key,
  Activity,
  Database,
  Settings as SettingsIcon,
  AlertTriangle,
  User,
  Clock
} from 'lucide-react';
import Card from '../components/Card';
import Button from '../components/Button';
import { useAppStore } from '../state/store';
import hubAPI from '../api/hubApi';

function AdminPanel() {
  const profile = useAppStore((state) => state.profile);
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAdminData();
  }, []);

  const loadAdminData = async () => {
    try {
      setLoading(true);
      const [statsResult, usersResult] = await Promise.all([
        hubAPI.admin.getStats(),
        hubAPI.admin.getUsers()
      ]);

      if (statsResult.success) {
        setStats(statsResult.stats);
      }

      if (usersResult.success) {
        setUsers(usersResult.users);
      }
    } catch (error) {
      console.error('Failed to load admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Sections disponibles
  const sections = [
    { id: 'overview', label: 'Overview', icon: Shield },
    { id: 'users', label: 'User Management', icon: Users },
    { id: 'roles', label: 'Roles & Permissions', icon: Key },
    { id: 'logs', label: 'System Logs', icon: Activity },
    { id: 'database', label: 'Database', icon: Database },
    { id: 'system', label: 'System Config', icon: SettingsIcon }
  ];

  return (
    <div style={{
      padding: '32px',
      maxWidth: '1400px',
      margin: '0 auto'
    }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '8px'
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Shield size={22} color="#fff" />
          </div>
          <div>
            <h1 style={{
              fontSize: '28px',
              fontWeight: '700',
              margin: 0,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent'
            }}>
              Admin Panel
            </h1>
            <p style={{
              fontSize: '14px',
              color: 'var(--text-tertiary)',
              margin: 0
            }}>
              System administration and management
            </p>
          </div>
        </div>
      </div>

      {/* Warning Badge */}
      <div style={{
        padding: '12px 16px',
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        border: '1px solid rgba(245, 158, 11, 0.3)',
        borderRadius: 'var(--radius-md)',
        marginBottom: '24px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px'
      }}>
        <AlertTriangle size={20} color="#f59e0b" />
        <div>
          <div style={{ fontSize: '14px', fontWeight: '600', color: '#f59e0b' }}>
            Administrator Access
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
            You have full system access. Be careful with changes made here.
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div style={{
        display: 'flex',
        gap: '8px',
        marginBottom: '24px',
        overflowX: 'auto',
        paddingBottom: '8px'
      }}>
        {sections.map((section) => {
          const Icon = section.icon;
          const isActive = activeTab === section.id;

          return (
            <button
              key={section.id}
              onClick={() => setActiveTab(section.id)}
              className={`btn ${isActive ? 'btn-primary' : 'btn-ghost'} btn-sm`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                whiteSpace: 'nowrap'
              }}
            >
              <Icon size={16} />
              {section.label}
            </button>
          );
        })}
      </div>

      {/* Content Area */}
      <div>
        {activeTab === 'overview' && <OverviewSection stats={stats} loading={loading} />}
        {activeTab === 'users' && <UsersSection users={users} loading={loading} onRefresh={loadAdminData} />}
        {activeTab === 'roles' && <RolesSection />}
        {activeTab === 'logs' && <LogsSection />}
        {activeTab === 'database' && <DatabaseSection />}
        {activeTab === 'system' && <SystemSection />}
      </div>
    </div>
  );
}

// Overview Section
function OverviewSection({ stats, loading }) {
  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-tertiary)' }}>
        Loading stats...
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
      <Card>
        <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px' }}>
          Quick Stats
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <StatItem label="Total Users" value={stats?.totalUsers || 0} color="#667eea" />
          <StatItem label="Total Workspaces" value={stats?.totalWorkspaces || 0} color="#10b981" />
          <StatItem label="Total Notes" value={stats?.totalNotes || 0} color="#f59e0b" />
        </div>
      </Card>

      <Card>
        <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px' }}>
          Content Stats
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <StatItem label="Total Links" value={stats?.totalLinks || 0} color="#ec4899" />
          <StatItem label="File References" value={stats?.totalFileRefs || 0} color="#8b5cf6" />
          <StatItem label="Active Tools" value={stats?.activeTools || 0} color="#3b82f6" />
        </div>
      </Card>

      <Card>
        <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px' }}>
          System Health
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <StatItem label="Database Status" value="Healthy" color="#10b981" />
          <StatItem label="Total Badges" value={stats?.totalBadges || 0} color="#f59e0b" />
          <StatItem label="Total Inbox Items" value={stats?.totalInboxItems || 0} color="#6366f1" />
        </div>
      </Card>
    </div>
  );
}

function StatItem({ label, value, color }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>{label}</span>
      <span style={{ fontSize: '16px', fontWeight: '600', color }}>{value}</span>
    </div>
  );
}

// Users Section
function UsersSection({ users, loading, onRefresh }) {
  const [updatingUser, setUpdatingUser] = useState(null);

  const handleUpdateRole = async (userId, newRole) => {
    try {
      setUpdatingUser(userId);
      const result = await hubAPI.admin.updateUserRole({ userId, role: newRole });
      if (result.success) {
        onRefresh();
      }
    } catch (error) {
      console.error('Failed to update user role:', error);
    } finally {
      setUpdatingUser(null);
    }
  };

  const handleUpdateStatus = async (userId, newStatus) => {
    try {
      setUpdatingUser(userId);
      const result = await hubAPI.admin.updateUserStatus({ userId, status: newStatus });
      if (result.success) {
        onRefresh();
      }
    } catch (error) {
      console.error('Failed to update user status:', error);
    } finally {
      setUpdatingUser(null);
    }
  };

  if (loading) {
    return (
      <Card>
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-tertiary)' }}>
          Loading users...
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>
        User Management
      </h3>
      <p style={{ fontSize: '14px', color: 'var(--text-tertiary)', marginBottom: '20px' }}>
        Manage user accounts, roles, and permissions
      </p>

      {users.length === 0 ? (
        <div style={{
          padding: '40px',
          textAlign: 'center',
          backgroundColor: 'var(--bg-tertiary)',
          borderRadius: 'var(--radius-md)'
        }}>
          <Users size={48} color="var(--text-tertiary)" style={{ marginBottom: '16px' }} />
          <p style={{ fontSize: '14px', color: 'var(--text-tertiary)' }}>
            No users found
          </p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-default)' }}>
                <th style={{ padding: '12px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: 'var(--text-tertiary)' }}>User</th>
                <th style={{ padding: '12px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: 'var(--text-tertiary)' }}>Email</th>
                <th style={{ padding: '12px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: 'var(--text-tertiary)' }}>Role</th>
                <th style={{ padding: '12px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: 'var(--text-tertiary)' }}>Status</th>
                <th style={{ padding: '12px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: 'var(--text-tertiary)' }}>Created</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} style={{ borderBottom: '1px solid var(--border-default)' }}>
                  <td style={{ padding: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--accent-glow)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <User size={16} color="var(--accent)" />
                      </div>
                      <span style={{ fontSize: '14px', fontWeight: '500' }}>{user.username}</span>
                    </div>
                  </td>
                  <td style={{ padding: '12px', fontSize: '14px', color: 'var(--text-secondary)' }}>
                    {user.email}
                  </td>
                  <td style={{ padding: '12px' }}>
                    <select
                      value={user.role}
                      onChange={(e) => handleUpdateRole(user.id, e.target.value)}
                      disabled={updatingUser === user.id}
                      style={{
                        padding: '4px 8px',
                        fontSize: '12px',
                        fontWeight: '600',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-default)',
                        backgroundColor: 'var(--bg-tertiary)',
                        color: 'var(--text-primary)',
                        cursor: updatingUser === user.id ? 'not-allowed' : 'pointer'
                      }}
                    >
                      <option value="USER">User</option>
                      <option value="PREMIUM">Premium</option>
                      <option value="ADMIN">Admin</option>
                      <option value="DEVELOPER">Developer</option>
                    </select>
                  </td>
                  <td style={{ padding: '12px' }}>
                    <select
                      value={user.status}
                      onChange={(e) => handleUpdateStatus(user.id, e.target.value)}
                      disabled={updatingUser === user.id}
                      style={{
                        padding: '4px 8px',
                        fontSize: '12px',
                        fontWeight: '600',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-default)',
                        backgroundColor: user.status === 'ACTIVE' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                        color: user.status === 'ACTIVE' ? '#10b981' : '#ef4444',
                        cursor: updatingUser === user.id ? 'not-allowed' : 'pointer'
                      }}
                    >
                      <option value="ACTIVE">Active</option>
                      <option value="INACTIVE">Inactive</option>
                      <option value="BANNED">Banned</option>
                    </select>
                  </td>
                  <td style={{ padding: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-tertiary)' }}>
                      <Clock size={14} />
                      {new Date(user.created_at).toLocaleDateString()}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

// Roles Section
function RolesSection() {
  return (
    <Card>
      <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>
        Roles & Permissions
      </h3>
      <p style={{ fontSize: '14px', color: 'var(--text-tertiary)', marginBottom: '20px' }}>
        Configure roles and manage permissions
      </p>
      <div style={{
        padding: '40px',
        textAlign: 'center',
        backgroundColor: 'var(--bg-tertiary)',
        borderRadius: 'var(--radius-md)'
      }}>
        <Key size={48} color="var(--text-tertiary)" style={{ marginBottom: '16px' }} />
        <p style={{ fontSize: '14px', color: 'var(--text-tertiary)' }}>
          Role management features coming soon
        </p>
      </div>
    </Card>
  );
}

// Logs Section
function LogsSection() {
  return (
    <Card>
      <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>
        System Logs
      </h3>
      <p style={{ fontSize: '14px', color: 'var(--text-tertiary)', marginBottom: '20px' }}>
        View and analyze system logs
      </p>
      <div style={{
        padding: '40px',
        textAlign: 'center',
        backgroundColor: 'var(--bg-tertiary)',
        borderRadius: 'var(--radius-md)'
      }}>
        <Activity size={48} color="var(--text-tertiary)" style={{ marginBottom: '16px' }} />
        <p style={{ fontSize: '14px', color: 'var(--text-tertiary)' }}>
          Advanced log viewer coming soon
        </p>
      </div>
    </Card>
  );
}

// Database Section
function DatabaseSection() {
  return (
    <Card>
      <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>
        Database Management
      </h3>
      <p style={{ fontSize: '14px', color: 'var(--text-tertiary)', marginBottom: '20px' }}>
        Manage database, backups, and maintenance
      </p>
      <div style={{
        padding: '40px',
        textAlign: 'center',
        backgroundColor: 'var(--bg-tertiary)',
        borderRadius: 'var(--radius-md)'
      }}>
        <Database size={48} color="var(--text-tertiary)" style={{ marginBottom: '16px' }} />
        <p style={{ fontSize: '14px', color: 'var(--text-tertiary)' }}>
          Database tools coming soon
        </p>
      </div>
    </Card>
  );
}

// System Section
function SystemSection() {
  return (
    <Card>
      <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>
        System Configuration
      </h3>
      <p style={{ fontSize: '14px', color: 'var(--text-tertiary)', marginBottom: '20px' }}>
        Configure system settings and preferences
      </p>
      <div style={{
        padding: '40px',
        textAlign: 'center',
        backgroundColor: 'var(--bg-tertiary)',
        borderRadius: 'var(--radius-md)'
      }}>
        <SettingsIcon size={48} color="var(--text-tertiary)" style={{ marginBottom: '16px' }} />
        <p style={{ fontSize: '14px', color: 'var(--text-tertiary)' }}>
          System configuration coming soon
        </p>
      </div>
    </Card>
  );
}

export default AdminPanel;
