// Script de precarga para comunicación segura entre procesos de Electron
const { contextBridge, ipcRenderer } = require('electron');

// API segura para exponer funcionalidades a la interfaz web
contextBridge.exposeInMainWorld('eastoreAPI', {
  // Sistema de facturación
  facturacion: {
    crearFactura: (datos) => ipcRenderer.invoke('factura:crear', datos),
    obtenerFactura: (id) => ipcRenderer.invoke('factura:obtener', id),
    listarFacturas: (filtros) => ipcRenderer.invoke('factura:listar', filtros),
    anularFactura: (id, motivo) => ipcRenderer.invoke('factura:anular', id, motivo),
    enviarPorEmail: (id, email) => ipcRenderer.invoke('factura:enviar-email', id, email),
    enviarPorWhatsapp: (id, telefono) => ipcRenderer.invoke('factura:enviar-whatsapp', id, telefono),
    imprimirFactura: (id, formato) => ipcRenderer.invoke('factura:imprimir', id, formato),
    generarFacturaElectronica: (id) => ipcRenderer.invoke('factura:generar-electronica', id)
  },

  // Gestión de clientes
  clientes: {
    crear: (cliente) => ipcRenderer.invoke('cliente:crear', cliente),
    obtener: (id) => ipcRenderer.invoke('cliente:obtener', id),
    buscar: (query) => ipcRenderer.invoke('cliente:buscar', query),
    actualizar: (id, datos) => ipcRenderer.invoke('cliente:actualizar', id, datos),
    eliminar: (id) => ipcRenderer.invoke('cliente:eliminar', id),
    listar: (filtros) => ipcRenderer.invoke('cliente:listar', filtros)
  },

  // Gestión de productos
  productos: {
    crear: (producto) => ipcRenderer.invoke('producto:crear', producto),
    obtener: (id) => ipcRenderer.invoke('producto:obtener', id),
    buscar: (query) => ipcRenderer.invoke('producto:buscar', query),
    actualizar: (id, datos) => ipcRenderer.invoke('producto:actualizar', id, datos),
    eliminar: (id) => ipcRenderer.invoke('producto:eliminar', id),
    listar: (filtros) => ipcRenderer.invoke('producto:listar', filtros),
    actualizarStock: (id, cantidad, motivo) => ipcRenderer.invoke('producto:actualizar-stock', id, cantidad, motivo),
    guardarMovimientoStock: (datos) => ipcRenderer.invoke('producto:guardar-movimiento', datos)
  },

  // Gestión de sucursales
  sucursales: {
    listar: () => ipcRenderer.invoke('sucursal:listar'),
    obtener: (id) => ipcRenderer.invoke('sucursal:obtener', id),
    crear: (datos) => ipcRenderer.invoke('sucursal:crear', datos),
    actualizar: (id, datos) => ipcRenderer.invoke('sucursal:actualizar', id, datos),
    eliminar: (id) => ipcRenderer.invoke('sucursal:eliminar', id),
    sincronizar: () => ipcRenderer.invoke('sucursal:sincronizar')
  },

  // Pagos y transacciones
  pagos: {
    registrarPago: (datos) => ipcRenderer.invoke('pago:registrar', datos),
    verificarPagoMercadoPago: (id) => ipcRenderer.invoke('pago:verificar-mp', id),
    obtenerEstadisticas: (filtros) => ipcRenderer.invoke('pago:estadisticas', filtros)
  },

  // Sistema y utilidades
  sistema: {
    getVersion: () => ipcRenderer.invoke('sistema:version'),
    verificarConexion: () => ipcRenderer.invoke('sistema:verificar-conexion'),
    realizarBackup: () => ipcRenderer.invoke('sistema:backup'),
    restaurarBackup: (ruta) => ipcRenderer.invoke('sistema:restaurar', ruta),
    verificarActualizaciones: () => ipcRenderer.invoke('sistema:verificar-actualizaciones')
  },

  // Listeners para eventos (notificaciones, etc.)
  on: (canal, callback) => {
    // Canales permitidos para escuchar eventos
    const canalesPermitidos = [
      'notificacion',
      'pago-recibido',
      'connectivity-status',
      'factura-generada',
      'sincronizacion-completada',
      'error-sistema'
    ];

    if (canalesPermitidos.includes(canal)) {
      // Wrapper para evitar exponer el evento completo de Electron
      const subscription = (event, ...args) => callback(...args);
      ipcRenderer.on(canal, subscription);

      // Retornar función para cancelar la suscripción
      return () => {
        ipcRenderer.removeListener(canal, subscription);
      };
    }

    console.error(`Canal no permitido: ${canal}`);
    return null;
  }
});

// Notificar cuando el preload ha terminado
console.log('Preload script cargado correctamente');
