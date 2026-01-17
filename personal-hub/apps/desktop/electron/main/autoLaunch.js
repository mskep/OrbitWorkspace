const { app } = require('electron');

class AutoLaunch {
  constructor() {
    this.appName = 'PersonalHub';
  }

  async isEnabled() {
    try {
      // Use Electron's built-in API to check login item settings
      const loginItemSettings = app.getLoginItemSettings();
      return loginItemSettings.openAtLogin || false;
    } catch (error) {
      console.error('Error checking autolaunch:', error);
      return false;
    }
  }

  async enable() {
    try {
      app.setLoginItemSettings({
        openAtLogin: true,
        name: this.appName
      });
      return true;
    } catch (error) {
      console.error('Error enabling autolaunch:', error);
      return false;
    }
  }

  async disable() {
    try {
      app.setLoginItemSettings({
        openAtLogin: false,
        name: this.appName
      });
      return true;
    } catch (error) {
      console.error('Error disabling autolaunch:', error);
      return false;
    }
  }

  async toggle(enabled) {
    return enabled ? this.enable() : this.disable();
  }
}

module.exports = AutoLaunch;
