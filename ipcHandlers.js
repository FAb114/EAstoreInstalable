const { ipcMain } = require('electron');

// Esta función recibe referencias a los servicios instanciados
module.exports = (mainWindow, services) => {
  const {
    printerService,
    notificacionService,
    sincronizacionService,
    isOnlineGetter
  } = services;

  // 👉 Factura: Imprimir
  ipcMain.handle('factura:imprimir', async (_, id, formato = 'ticket') => {
    try {
      // 🔁 Acá deberías conectar con tu base de datos real:
      const factura = await obtenerFacturaEjemplo(id);
      await printerService.imprimirFactura(factura, formato);
    } catch (err) {
      console.error('Error en impresión de factura:', err);
      throw err;
    }
  });

  // 👉 Evento de prueba para notificaciones o sincronización
  ipcMain.handle('sistema:verificar-conexion', () => {
    return isOnlineGetter();
  });

  ipcMain.handle('sistema:notificar', (_, titulo, mensaje) => {
    notificacionService.mostrarNotificacion(titulo, mensaje);
  });

  ipcMain.handle('sistema:forzar-sincronizacion', async () => {
    return await sincronizacionService.sincronizarPendientes();
  });
};

// ⚠️ Esto es solo para test: simulamos una factura simple
async function obtenerFacturaEjemplo(id) {
  return {
    id,
    cliente: {
      nombre: 'Juan Pérez',
      direccion: 'Calle Falsa 123',
      cuit: '20-12345678-9'
    },
    fecha: new Date().toLocaleString(),
    productos: [
      { nombre: 'Auriculares Bluetooth', cantidad: 1, precio: 8500 },
      { nombre: 'Cargador rápido', cantidad: 2, precio: 3500 }
    ],
    total: 15500,
    cae: '67890123456789',
    formaPago: 'Transferencia',
    tipo: 'A'
  };
};
// Agregar después del último ipcMain.handle
ipcMain.handle('producto:guardar-movimiento', async (_, movimiento) => {
  try {
    const db = require('./backend/database/db'); // ajustá esta ruta según donde tengas la conexión con better-sqlite3

    const stmt = db.prepare(`
      INSERT INTO movimientos_stock (producto_id, cantidad, motivo, sucursal_id, usuario, fecha)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      movimiento.productoId,
      movimiento.cantidad,
      movimiento.motivo,
      movimiento.sucursalId || null,
      movimiento.usuario || 'sistema',
      new Date().toISOString()
    );

    return { exito: true };
  } catch (error) {
    console.error('Error guardando movimiento de stock:', error);
    return { exito: false, error: error.message };
  }
});

