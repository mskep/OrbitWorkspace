const { Tray, Menu, nativeImage } = require('electron');
const path = require('path');

class TrayManager {
  constructor(mainWindow) {
    this.mainWindow = mainWindow;
    this.tray = null;
  }

  create() {
    // For now, use a simple icon placeholder
    // You should replace this with an actual icon file later
    const iconPath = path.join(__dirname, '../../../renderer/public/icon.png');

    // Fallback if icon doesn't exist
    let icon;
    try {
      icon = nativeImage.createFromPath(iconPath);
    } catch (error) {
      // Create a simple 16x16 empty icon as fallback
      icon = nativeImage.createEmpty();
    }

    this.tray = new Tray(icon);
    this.tray.setToolTip('Personal Hub');

    this.updateContextMenu();

    this.tray.on('click', () => {
      this.mainWindow.show();
    });

    this.tray.on('double-click', () => {
      this.mainWindow.show();
    });
  }

  updateContextMenu(quickActions = []) {
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Open Personal Hub',
        click: () => {
          this.mainWindow.show();
        }
      },
      { type: 'separator' },
      ...quickActions.map(action => ({
        label: action.label,
        click: () => {
          if (action.handler) {
            action.handler();
          }
        }
      })),
      ...(quickActions.length > 0 ? [{ type: 'separator' }] : []),
      {
        label: 'Restart',
        click: () => {
          const { app } = require('electron');
          app.relaunch();
          app.quit();
        }
      },
      {
        label: 'Quit',
        click: () => {
          const { app } = require('electron');
          app.quit();
        }
      }
    ]);

    this.tray.setContextMenu(contextMenu);
  }

  destroy() {
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
    }
  }
}

module.exports = TrayManager;
