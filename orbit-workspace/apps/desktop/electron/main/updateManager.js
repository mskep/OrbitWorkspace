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

    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.allowPrerelease = false;

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
        message: `Update available: ${info?.version || 'unknown'}`,
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
      this._setState({
        status: 'error',
        message: 'Update failed',
        error: error?.message || String(error),
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
      this._setState({
        status: 'error',
        message: 'Update check failed',
        error: error?.message || String(error),
      });
      return { success: false, error: error?.message || 'Failed to check updates' };
    }
  }

  async downloadUpdate() {
    if (!app.isPackaged) {
      return { success: false, error: 'Auto-update works only in packaged app' };
    }

    if (this.state.status !== 'available') {
      return { success: false, error: 'No update available to download' };
    }

    try {
      await autoUpdater.downloadUpdate();
      return { success: true };
    } catch (error) {
      this._setState({
        status: 'error',
        message: 'Update download failed',
        error: error?.message || String(error),
      });
      return { success: false, error: error?.message || 'Failed to download update' };
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
      this._setState({
        status: 'error',
        message: 'Install update failed',
        error: error?.message || String(error),
      });
      return { success: false, error: error?.message || 'Failed to install update' };
    }
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
