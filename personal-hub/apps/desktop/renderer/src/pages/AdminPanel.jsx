import React, { useState } from 'react';
import {
  Shield,
  Users,
  Key,
  Activity,
  Database,
  Settings as SettingsIcon,
  AlertTriangle
} from 'lucide-react';
import Card from '../components/Card';
import Button from '../components/Button';
import { useAppStore } from '../state/store';

function AdminPanel() {
  const profile = useAppStore((state) => state.profile);
  const [activeTab, setActiveTab] = useState('overview');

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
        {activeTab === 'overview' && <OverviewSection />}
        {activeTab === 'users' && <UsersSection />}
        {activeTab === 'roles' && <RolesSection />}
        {activeTab === 'logs' && <LogsSection />}
        {activeTab === 'database' && <DatabaseSection />}
        {activeTab === 'system' && <SystemSection />}
      </div>
    </div>
  );
}

// Overview Section
function OverviewSection() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
      <Card>
        <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px' }}>
          Quick Stats
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <StatItem label="Total Users" value="—" color="#667eea" />
          <StatItem label="Active Sessions" value="—" color="#10b981" />
          <StatItem label="System Uptime" value="—" color="#f59e0b" />
        </div>
      </Card>

      <Card>
        <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px' }}>
          System Health
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <StatItem label="Database Status" value="Healthy" color="#10b981" />
          <StatItem label="API Status" value="Online" color="#10b981" />
          <StatItem label="Storage Used" value="—" color="#3b82f6" />
        </div>
      </Card>

      <Card>
        <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px' }}>
          Recent Activity
        </h3>
        <div style={{ fontSize: '14px', color: 'var(--text-tertiary)', textAlign: 'center', padding: '20px' }}>
          No recent activity
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
function UsersSection() {
  return (
    <Card>
      <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>
        User Management
      </h3>
      <p style={{ fontSize: '14px', color: 'var(--text-tertiary)', marginBottom: '20px' }}>
        Manage user accounts, roles, and permissions
      </p>
      <div style={{
        padding: '40px',
        textAlign: 'center',
        backgroundColor: 'var(--bg-tertiary)',
        borderRadius: 'var(--radius-md)'
      }}>
        <Users size={48} color="var(--text-tertiary)" style={{ marginBottom: '16px' }} />
        <p style={{ fontSize: '14px', color: 'var(--text-tertiary)' }}>
          User management features coming soon
        </p>
      </div>
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
