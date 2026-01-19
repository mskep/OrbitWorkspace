console.log('Starting test...');
const electron = require('electron');
console.log('Electron type:', typeof electron);
console.log('Electron is array?', Array.isArray(electron));
console.log('Electron keys:', Object.keys(electron).slice(0, 10));

const { app } = electron;
console.log('App type:', typeof app);
console.log('App value:', app);

if (app && app.whenReady) {
  app.whenReady().then(() => {
    console.log('App is ready!');
    app.quit();
  });
} else {
  console.error('App is not available!');
  process.exit(1);
}
