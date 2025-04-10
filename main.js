const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

let mainWindow;
let currentUser = null;

function createLoginWindow() {
  mainWindow = new BrowserWindow({
    width: 400,
    height: 300,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'frontend', 'login.html'));
}

function loadMainApp() {
  mainWindow.setSize(1200, 800);
  mainWindow.center();
  mainWindow.setResizable(true);
  mainWindow.loadFile(path.join(__dirname, 'frontend', 'index.html'));
}

ipcMain.on('set-user', (event, username) => {
  currentUser = username;
  loadMainApp();
});

ipcMain.handle('get-user', () => currentUser);

app.whenReady().then(() => {
  createLoginWindow();
});
