import React, { useEffect, useState } from 'react';
import hubAPI from '../api/hubApi';
import Topbar from '../app/layout/Topbar';
import { useAppStore } from '../state/store';

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
  PREMIUM_TOOLS: 'Premium Tools'
};

function Profile() {
  const { profile, setProfile } = useAppStore();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    try {
      const profileData = await hubAPI.profile.get();
      setProfile(profileData);
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  }

  async function handlePermissionToggle(permission) {
    setLoading(true);
    try {
      const isEnabled = profile.permissions.includes(permission);
      await hubAPI.permissions.set({ perm: permission, enabled: !isEnabled });
      await loadProfile();
    } catch (error) {
      console.error('Error toggling permission:', error);
    } finally {
      setLoading(false);
    }
  }

  if (!profile) {
    return (
      <div className="page">
        <Topbar title="Profil" />
        <div className="page-content">
          <p>Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <Topbar title="Profil" />

      <div className="page-content">
        <div className="profile-section">
          <h3>User Information</h3>
          <div className="info-list">
            <div className="info-item">
              <span>Username:</span>
              <span>{profile.username}</span>
            </div>
            <div className="info-item">
              <span>Premium:</span>
              <span className={profile.premiumEnabled ? 'status-success' : 'status-disabled'}>
                {profile.premiumEnabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
            <div className="info-item">
              <span>Created:</span>
              <span>{new Date(profile.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
        </div>

        <div className="profile-section">
          <h3>Permissions</h3>
          <div className="permissions-grid">
            {Object.entries(PERMISSION_LABELS).map(([key, label]) => {
              const isEnabled = profile.permissions.includes(key);
              return (
                <div key={key} className="permission-item">
                  <label>
                    <input
                      type="checkbox"
                      checked={isEnabled}
                      onChange={() => handlePermissionToggle(key)}
                      disabled={loading}
                    />
                    <span>{label}</span>
                  </label>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Profile;
