const { Notification, shell } = require('electron');
const path = require('path');

/**
 * Notification Manager - Native Windows toast notifications
 */
class NotificationManager {
  constructor(app) {
    this.app = app;
    this.iconPath = path.join(__dirname, '../../../assets/icon.png');
  }

  /**
   * Show notification
   */
  show(title, body, options = {}) {
    try {
      if (!Notification.isSupported()) {
        console.log('Notifications not supported');
        return;
      }

      const notification = new Notification({
        title,
        body,
        icon: options.icon || this.iconPath,
        silent: options.silent || false,
        urgency: options.urgency || 'normal',
        timeoutType: options.timeoutType || 'default'
      });

      // Handle click
      if (options.onClick) {
        notification.on('click', () => {
          options.onClick();
        });
      }

      // Handle click on action
      if (options.onAction) {
        notification.on('action', (event, index) => {
          options.onAction(index);
        });
      }

      notification.show();

      return notification;
    } catch (error) {
      console.error('Failed to show notification:', error);
      return null;
    }
  }

  /**
   * Show success notification
   */
  success(title, body, options = {}) {
    return this.show(title, body, {
      ...options,
      urgency: 'normal'
    });
  }

  /**
   * Show error notification
   */
  error(title, body, options = {}) {
    return this.show(title, body, {
      ...options,
      urgency: 'critical'
    });
  }

  /**
   * Show warning notification
   */
  warning(title, body, options = {}) {
    return this.show(title, body, {
      ...options,
      urgency: 'normal'
    });
  }

  /**
   * Show info notification
   */
  info(title, body, options = {}) {
    return this.show(title, body, {
      ...options,
      urgency: 'low'
    });
  }

  /**
   * Show tool execution notification
   */
  toolSuccess(toolName, message, options = {}) {
    return this.success(
      toolName,
      message,
      {
        ...options,
        onClick: () => {
          if (options.filePath) {
            shell.showItemInFolder(options.filePath);
          }
        }
      }
    );
  }

  /**
   * Show tool error notification
   */
  toolError(toolName, message) {
    return this.error(
      `${toolName} - Error`,
      message
    );
  }

  /**
   * Show download complete notification
   */
  downloadComplete(filename, filePath) {
    return this.success(
      'Download Complete',
      filename,
      {
        onClick: () => {
          shell.showItemInFolder(filePath);
        }
      }
    );
  }

  /**
   * Show backup notification
   */
  backupComplete(backupPath) {
    return this.success(
      'Backup Complete',
      'Your data has been backed up successfully',
      {
        onClick: () => {
          shell.showItemInFolder(backupPath);
        }
      }
    );
  }

  /**
   * Show update available notification
   */
  updateAvailable(version) {
    return this.info(
      'Update Available',
      `Version ${version} is available for download`
    );
  }

  /**
   * Check if notifications are supported
   */
  isSupported() {
    return Notification.isSupported();
  }
}

module.exports = NotificationManager;
