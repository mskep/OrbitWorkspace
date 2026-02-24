const { Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

class TrayManager {
  constructor(mainWindow) {
    this.mainWindow = mainWindow;
    this.tray = null;
  }

  create() {
    const iconPath = path.join(__dirname, '../../renderer/src/assets/v2.png');

    let icon;
    try {
      if (!fs.existsSync(iconPath)) {
        icon = nativeImage.createEmpty();
      } else {
        icon = nativeImage.createFromPath(iconPath);
        if (!icon.isEmpty()) {
          const traySize = process.platform === 'win32' ? 32 : 22;
          icon = icon.resize({ width: traySize, height: traySize });
        }
      }
    } catch (error) {
      icon = nativeImage.createEmpty();
    }

    this.tray = new Tray(icon);
    this.tray.setToolTip('Orbit - Personal Hub');

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
        label: 'Open Orbit',
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
