const { app, BrowserWindow } = require('electron');
const path = require('path');
const net = require('net');
const fs = require('fs');

// Setup User Data Directory for Projects
const userDataPath = app.getPath('userData');
const projectDir = path.join(userDataPath, 'projects');
if (!fs.existsSync(projectDir)) {
  fs.mkdirSync(projectDir, { recursive: true });
}
process.env.PROJECT_DIR = projectDir;

// Determine Effect directory (works in dev and production asar)
const isPackaged = app.isPackaged;
process.env.IS_PACKAGED = isPackaged ? 'true' : 'false';
const effectDir = isPackaged 
  ? path.join(process.resourcesPath, 'effect')
  : path.join(__dirname, '../effect');
process.env.EFFECT_DIR = effectDir;

let mainWindow;



function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'Quantum Brush',
    icon: path.join(__dirname, 'frontend', 'public', 'favicon.png'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    autoHideMenuBar: true
  });

  mainWindow.loadURL('http://localhost:' + process.env.PORT);

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

const startServer = require('./server.js');
startServer(0).then((port) => {
  process.env.PORT = port;
  console.log("Server started on port: " + port);
  app.whenReady().then(() => {
    createWindow();
    app.on('activate', function () {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
