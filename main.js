const { app, BrowserWindow } = require('electron');
const path = require('path');
const url = require('url');
const notificacionService = require('./backend/services/notificacionService');
const SyncService = require('./backend/services/sync');
const PrintService = require('./backend/services/print');
const config = require('./config/config');
const configurarIPC = require('./ipcHandlers'); // Comunicación principal

// Añadir esta línea para depuración extendida
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Instancias de servicios
const sincronizacionService = new SyncService(null); // Pasar instancia de DB si hace falta
const printerService = new PrintService();

let mainWindow;
let isOnline = true;

function createWindow() {
  console.log('Iniciando creación de ventana...');
  
  try {
    // Crear la ventana sin acceder a webContents antes de asignarla
    mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      title: 'EAstore - Sistema de Facturación',
      // Comentar la línea del icono temporalmente para descartar problemas
      // icon: path.join(__dirname, 'assents', 'icon.png'),
      webPreferences: {
        webSecurity: true,
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false
      },
      show: false // Se muestra cuando esté listo
    });

    console.log('Cargando archivo HTML...');
    console.log('Ruta del archivo HTML:', path.join(__dirname, 'frontend', 'index.html'));
    
    // Usar loadFile en lugar de loadURL para archivos locales
    mainWindow.loadFile(path.join(__dirname, 'frontend', 'index.html'));

    // Listener para errores en la carga del contenido
    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      console.error('Error al cargar la ventana:', {
        errorCode, 
        errorDescription,
        validatedURL,
        isMainFrame
      });
    });

    // Mostrar la ventana cuando esté lista y abrir DevTools para debug
    mainWindow.once('ready-to-show', () => {
      console.log('Ventana lista para mostrar');
      mainWindow.show();
      mainWindow.webContents.openDevTools();
    });

    // Limpieza
    mainWindow.on('closed', () => {
      mainWindow = null;
    });

    console.log('Iniciando verificación de conectividad...');
    verificarConectividad();
    
    console.log('Ventana creada correctamente');
  } catch (error) {
    console.error('Error al crear ventana:', error);
  }
}

// 🔁 Verifica conexión a Internet
function verificarConectividad() {
  console.log('Configurando verificación periódica de conectividad');
  setInterval(() => {
    require('dns').lookup('google.com', (err) => {
      const nuevaConexion = !err;
      if (nuevaConexion !== isOnline) {
        isOnline = nuevaConexion;
        console.log('Estado de conexión actualizado:', isOnline ? 'Online' : 'Offline');
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('connectivity-status', isOnline);
        }
        if (isOnline) {
          console.log('Intentando sincronizar datos pendientes...');
          sincronizacionService.sincronizarPendientes()
            .then(() => {
              notificacionService.success('Conexión restablecida', 'Sincronización completada');
            })
            .catch(err => console.error('Error al sincronizar:', err));
        }
      }
    });
  }, 30000);
}

// ⏳ Cuando Electron está listo
app.whenReady().then(() => {
  console.log('Electron está listo. Creando ventana principal...');
  createWindow();
  
  console.log('Configurando IPC handlers...');
  configurarIPC(mainWindow);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// 🛑 Cierra la app cuando se cierran todas las ventanas (excepto macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// 🧯 Manejador de errores globales
process.on('uncaughtException', (err) => {
  console.error('Error no capturado:', err);
});