const { app, BrowserWindow } = require('electron');
const path = require('path');

function create() {
  const win = new BrowserWindow({
    width: 1440, height: 900,
    backgroundColor: '#0E1311',
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  });
  // dist/index.html (relative-base build works over file://)
  win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
}
app.whenReady().then(() => {
  create();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) create(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
