const { Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

class TrayManager {
  constructor(mainWindow) {
    this.mainWindow = mainWindow;
    this.tray = null;
  }

  create() {
    const iconPath = this.resolveTrayIconPath();

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

  resolveTrayIconPath() {
    const iconFileNames = process.platform === 'win32'
      ? ['orbit-icon.ico', 'orbit-icon.png', 'orbit-tray.png']
      : ['orbit-tray.png', 'orbit-icon.png', 'orbit-icon.ico'];

    const assetDirectories = [
      path.join(process.resourcesPath || '', 'assets'),
      path.join(__dirname, '../assets'),
      path.join(process.resourcesPath || '', 'app.asar.unpacked', 'apps', 'desktop', 'electron', 'assets'),
    ];

    for (const assetDir of assetDirectories) {
      for (const fileName of iconFileNames) {
        const candidate = path.join(assetDir, fileName);
        if (fs.existsSync(candidate)) {
          return candidate;
        }
      }
    }

    return null;
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
