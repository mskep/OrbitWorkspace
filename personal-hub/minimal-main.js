console.log('=== Minimal main.js starting ===');

console.log('1. About to require electron');
const electron = require('electron');

console.log('2. Electron required, type:', typeof electron);
console.log('3. Electron constructor name:', electron.constructor.name);

console.log('4. Trying to destructure app');
const { app } = electron;

console.log('5. App type:', typeof app);
console.log('6. App value:', app);

if (!app) {
  console.error('ERROR: app is undefined!');
  process.exit(1);
}

console.log('7. App is defined, calling whenReady');
app.whenReady().then(() => {
  console.log('8. App is ready!');
  app.quit();
});
