import React from 'react';
import Topbar from '../app/layout/Topbar';
import { useI18n } from '../i18n';

function Offline() {
  const { t } = useI18n();
  return (
    <div className="page">
      <Topbar title={t('common.offline')} />
      <div className="page-content">
        <div className="offline-message">
          <h2>You are currently offline</h2>
          <p>Some features are unavailable while offline:</p>
          <ul>
            <li>Tools requiring internet access</li>
            <li>Store updates</li>
            <li>Remote sync</li>
          </ul>
          <p>You can still access:</p>
          <ul>
            <li>Profile settings</li>
            <li>Offline tools</li>
            <li>Local links</li>
            <li>System settings</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default Offline;
