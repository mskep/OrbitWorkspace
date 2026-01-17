// Test simple pour vérifier que Electron se charge
console.log('=== Starting Electron Test ===');

try {
  const electron = require('electron');
  console.log('✓ Electron loaded:', electron);
  console.log('✓ app:', electron.app);

  const { app, BrowserWindow } = electron;

  app.whenReady().then(() => {
    console.log('✓ Electron app ready!');

    const win = new BrowserWindow({
      width: 800,
      height: 600
    });

    win.loadURL('http://localhost:5173');
    console.log('✓ Window created');
  });

} catch (error) {
  console.error('✗ Error:', error);
}
