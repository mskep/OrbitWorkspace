const { app } = require('electron');
const { autoUpdater } = require('electron-updater');
const { IPC_CHANNELS } = require('../shared/constants');

class UpdateManager {
  constructor() {
    this.mainWindow = null;
    this.initialized = false;
    this.state = {
      enabled: app.isPackaged,
      status: app.isPackaged ? 'idle' : 'disabled',
      message: app.isPackaged
        ? 'Ready to check for updates'
        : 'Auto-update is available only in packaged builds',
      currentVersion: app.getVersion(),
      availableVersion: null,
      progressPercent: null,
      bytesPerSecond: null,
      checkedAt: null,
      error: null,
    };
  }

  initialize(mainWindow) {
    this.mainWindow = mainWindow;
    if (this.initialized) {
      this._emitStatus();
      return;
    }

    this.initialized = true;
    if (!app.isPackaged) {
      this._emitStatus();
      return;
    }

    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.allowPrerelease = false;
    this._applyRuntimeAuthHeaders();

    autoUpdater.on('checking-for-update', () => {
      this._setState({
        status: 'checking',
        message: 'Checking for updates...',
        checkedAt: Date.now(),
        error: null,
        progressPercent: null,
        bytesPerSecond: null,
      });
    });

    autoUpdater.on('update-available', (info) => {
      this._setState({
        status: 'available',
        message: `Update available: ${info?.version || 'unknown'} (downloading...)`,
        availableVersion: info?.version || null,
        error: null,
        progressPercent: null,
        bytesPerSecond: null,
      });
    });

    autoUpdater.on('update-not-available', () => {
      this._setState({
        status: 'not-available',
        message: 'App is up to date',
        availableVersion: null,
        error: null,
        progressPercent: null,
        bytesPerSecond: null,
      });
    });

    autoUpdater.on('download-progress', (progress) => {
      this._setState({
        status: 'downloading',
        message: 'Downloading update...',
        progressPercent: typeof progress?.percent === 'number' ? progress.percent : null,
        bytesPerSecond: typeof progress?.bytesPerSecond === 'number' ? progress.bytesPerSecond : null,
        error: null,
      });
    });

    autoUpdater.on('update-downloaded', (info) => {
      this._setState({
        status: 'downloaded',
        message: 'Update downloaded. Restart to install.',
        availableVersion: info?.version || this.state.availableVersion,
        progressPercent: 100,
        error: null,
      });
    });

    autoUpdater.on('error', (error) => {
      const normalizedError = this._normalizeUpdaterError(error);
      this._setState({
        status: 'error',
        message: normalizedError.userMessage,
        error: normalizedError.details,
      });
    });

    this._emitStatus();
  }

  setMainWindow(mainWindow) {
    this.mainWindow = mainWindow;
    this._emitStatus();
  }

  getStatus() {
    return { ...this.state, currentVersion: app.getVersion() };
  }

  async checkForUpdates() {
    if (!app.isPackaged) {
      return { success: false, error: 'Auto-update works only in packaged app' };
    }

    if (this.state.status === 'checking' || this.state.status === 'downloading') {
      return { success: false, error: 'Update flow already in progress' };
    }

    try {
      await autoUpdater.checkForUpdates();
      return { success: true };
    } catch (error) {
      const normalizedError = this._normalizeUpdaterError(error);
      this._setState({
        status: 'error',
        message: normalizedError.userMessage,
        error: normalizedError.details,
      });
      return { success: false, error: normalizedError.userMessage };
    }
  }

  async downloadUpdate() {
    if (!app.isPackaged) {
      return { success: false, error: 'Auto-update works only in packaged app' };
    }

    if (this.state.status === 'downloaded') {
      return { success: true };
    }

    if (this.state.status === 'available' || this.state.status === 'downloading') {
      return { success: true, message: 'Download already started automatically' };
    }

    try {
      await autoUpdater.downloadUpdate();
      return { success: true };
    } catch (error) {
      const normalizedError = this._normalizeUpdaterError(error);
      this._setState({
        status: 'error',
        message: normalizedError.userMessage,
        error: normalizedError.details,
      });
      return { success: false, error: normalizedError.userMessage };
    }
  }

  installUpdate() {
    if (!app.isPackaged) {
      return { success: false, error: 'Auto-update works only in packaged app' };
    }

    if (this.state.status !== 'downloaded') {
      return { success: false, error: 'No downloaded update to install' };
    }

    try {
      setTimeout(() => {
        autoUpdater.quitAndInstall(false, true);
      }, 100);
      return { success: true };
    } catch (error) {
      const normalizedError = this._normalizeUpdaterError(error);
      this._setState({
        status: 'error',
        message: normalizedError.userMessage,
        error: normalizedError.details,
      });
      return { success: false, error: normalizedError.userMessage };
    }
  }

  _applyRuntimeAuthHeaders() {
    const githubToken = process.env.ORBIT_UPDATER_TOKEN
      || process.env.GH_TOKEN
      || process.env.GITHUB_TOKEN;

    if (!githubToken) return;

    autoUpdater.requestHeaders = {
      ...(autoUpdater.requestHeaders || {}),
      Authorization: `token ${githubToken}`,
    };
  }

  _normalizeUpdaterError(error) {
    const raw = String(error?.message || error || 'Unknown updater error');
    const condensed = raw
      .replace(/\s+/g, ' ')
      .replace(/\s*Headers:\s*\{.*$/i, '')
      .trim();

    const lower = condensed.toLowerCase();
    if (
      lower.includes('releases.atom')
      && lower.includes('404')
      && (lower.includes('token') || lower.includes('authentication'))
    ) {
      return {
        userMessage: 'Updates unavailable: release feed is private. Make releases public or configure ORBIT_UPDATER_TOKEN.',
        details: condensed,
      };
    }

    return {
      userMessage: 'Update failed. Try again in a moment.',
      details: condensed,
    };
  }

  _setState(patch) {
    this.state = {
      ...this.state,
      ...patch,
      currentVersion: app.getVersion(),
    };
    this._emitStatus();
  }

  _emitStatus() {
    if (!this.mainWindow || this.mainWindow.isDestroyed?.()) return;
    if (!this.mainWindow.webContents) return;
    this.mainWindow.webContents.send(IPC_CHANNELS.SYSTEM_UPDATE_STATUS_CHANGED, this.getStatus());
  }
}

module.exports = UpdateManager;
