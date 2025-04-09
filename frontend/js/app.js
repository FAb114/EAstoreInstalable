// app.js - Lógica principal de la aplicación EAstore
// Facturador Electrónico - Versión 1.0

// Importaciones de componentes
import { initFacturador } from './components/facturador.js';
import { initClienteForm } from './components/cliente-form.js';
import { setupNotifications } from './components/notification.js';
import { initPaymentOptions } from './components/payment-options.js';
import { initProductoSelector } from './components/producto-selector.js';

// Variables globales para evitar errores si electronAPI no está disponible
let facturacionService, clientesService, productosService, syncService, 
    afipService, mercadopagoService, whatsappService, emailService;

// Inicializar servicios de la API
function initServices() {
  // Verificar si estamos en entorno Electron
  if (window.eastoreAPI) {
    // Importaciones de servicios backend a través del puente de preload.js
    const api = window.eastoreAPI;
    facturacionService = api.facturacionService;
    clientesService = api.clientesService;
    productosService = api.productosService;
    syncService = api.syncService;
    afipService = api.afipService;
    mercadopagoService = api.mercadopagoService;
    whatsappService = api.whatsappService;
    emailService = api.emailService;
    console.log('Servicios Electron API inicializados correctamente');
    return true;
  } else {
    console.error('electronAPI no disponible. Ejecutando en modo fallback');
    // Implementar servicios de fallback para desarrollo/testing
    setupFallbackServices();
    return false;
  }
}

// Configuración de servicios fallback para desarrollo
function setupFallbackServices() {
  // Servicios mock para desarrollo sin Electron
  facturacionService = {
    getCurrentFacturaData: () => Promise.resolve({ items: [], cliente: {}, total: 0 }),
    updateFactura: (data) => Promise.resolve(data),
    printTicket: (id) => console.log(`Imprimiendo ticket ${id}`),
    printFacturaA4: (id) => console.log(`Imprimiendo factura A4 ${id}`),
    updateFacturaStatus: (id, status) => console.log(`Factura ${id} actualizada a ${status}`)
  };
  
  clientesService = {
    updateClienteData: (data) => Promise.resolve(data)
  };
  
  syncService = {
    syncAllPendingData: () => Promise.resolve({ success: true, updated: 0 })
  };
  
  afipService = {
    generarFacturaElectronica: (data) => Promise.resolve({ success: true, cae: '12345678901234', vencimiento: '2023-12-31' })
  };
  
  mercadopagoService = {
    checkNewPayments: () => Promise.resolve([])
  };
  
  whatsappService = {
    enviarFactura: (id, telefono) => console.log(`Enviando factura ${id} por WhatsApp a ${telefono}`)
  };
  
  emailService = {
    enviarFactura: (id, email) => console.log(`Enviando factura ${id} por email a ${email}`)
  };
}

// Configuración de la aplicación
const CONFIG = {
  MONTO_LIMITE_ARCA: 30000, // Monto límite para solicitar datos adicionales según ARCA (AFIP)
  MODO_OFFLINE: false,      // Estado inicial: online
  CURRENT_SUCURSAL: null,   // Se establecerá al iniciar
  THEME: {
    primary: '#3498db',     // Azul tranquilo
    secondary: '#2ecc71',   // Verde suave
    background: '#f5f7fa',  // Fondo claro
    text: '#34495e',        // Texto oscuro
    accent: '#9b59b6'       // Acento púrpura
  },
  IS_ELECTRON: false        // Se establecerá al iniciar
};

// Inicialización de la aplicación
document.addEventListener('DOMContentLoaded', async () => {
  console.log('Iniciando EAstore Facturador...');
  
  try {
    // Inicializar servicios
    CONFIG.IS_ELECTRON = initServices();
    
    // Verificar estado de conexión
    checkConnectionStatus();
    
    // Cargar configuración de sucursal
    await loadSucursalConfig();
    
    // Inicializar componentes de UI
    initUIComponents();
    
    // Configurar manejadores de eventos
    setupEventListeners();
    
    // Configurar intervalos para verificación de pagos
    setupPaymentChecks();
    
    // Configurar sistema de sincronización
    setupSyncSystem();
    
    // Mostrar vista principal
    showMainView();
  } catch (error) {
    console.error('Error al iniciar la aplicación:', error);
    document.body.innerHTML = `
      <div class="error-container">
        <h1>Error al iniciar la aplicación</h1>
        <p>${error.message || 'Error desconocido'}</p>
        <button onclick="location.reload()">Reintentar</button>
      </div>
    `;
  }
});

// Verificar estado de conexión a internet
function checkConnectionStatus() {
  const updateConnectionStatus = () => {
    CONFIG.MODO_OFFLINE = !navigator.onLine;
    updateUIConnectionStatus();
  };
  
  // Verificar estado inicial
  updateConnectionStatus();
  
  // Escuchar cambios de conexión
  window.addEventListener('online', updateConnectionStatus);
  window.addEventListener('offline', updateConnectionStatus);
}

// Actualizar UI según estado de conexión
function updateUIConnectionStatus() {
  const statusIndicator = document.getElementById('connection-status');
  if (!statusIndicator) {
    console.warn('Elemento connection-status no encontrado en el DOM');
    return;
  }
  
  if (CONFIG.MODO_OFFLINE) {
    statusIndicator.textContent = 'OFFLINE';
    statusIndicator.classList.remove('status-online');
    statusIndicator.classList.add('status-offline');
    showNotification('Modo sin conexión activado', 'Los datos se sincronizarán cuando vuelva la conexión', 'warning');
  } else {
    statusIndicator.textContent = 'ONLINE';
    statusIndicator.classList.remove('status-offline');
    statusIndicator.classList.add('status-online');
    syncPendingData();
  }
}

// Cargar configuración de sucursal
async function loadSucursalConfig() {
  try {
    if (CONFIG.IS_ELECTRON) {
      // Obtener ID de sucursal desde configuración local
      const sucursalData = await window.electronAPI.getAppConfig('sucursal');
      if (sucursalData && sucursalData.id) {
        CONFIG.CURRENT_SUCURSAL = sucursalData;
        const sucursalElement = document.getElementById('sucursal-name');
        if (sucursalElement) {
          sucursalElement.textContent = sucursalData.nombre || 'Sucursal';
        }
        console.log(`Sucursal cargada: ${sucursalData.nombre} (ID: ${sucursalData.id})`);
      } else {
        // Si no hay configuración, solicitar al usuario
        showSucursalSetupDialog();
      }
    } else {
      // Modo desarrollo - usar sucursal por defecto
      CONFIG.CURRENT_SUCURSAL = { id: 'DEV001', nombre: 'Sucursal Desarrollo' };
      console.log('Usando sucursal de desarrollo:', CONFIG.CURRENT_SUCURSAL);
    }
  } catch (error) {
    console.error('Error al cargar configuración de sucursal:', error);
    showErrorDialog('No se pudo cargar la configuración de sucursal', error);
  }
}

// Mostrar diálogo para configurar sucursal
function showSucursalSetupDialog() {
  // Implementación del diálogo de configuración inicial
  const modal = document.getElementById('setup-sucursal-modal');
  if (!modal) {
    console.error('Modal setup-sucursal-modal no encontrado');
    return;
  }
  
  modal.classList.add('active');
  
  const form = document.getElementById('setup-sucursal-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const sucursalId = document.getElementById('sucursal-id').value;
      const sucursalNombre = document.getElementById('sucursal-nombre').value;
      
      if (sucursalId && sucursalNombre) {
        CONFIG.CURRENT_SUCURSAL = { id: sucursalId, nombre: sucursalNombre };
        if (CONFIG.IS_ELECTRON) {
          await window.electronAPI.saveAppConfig('sucursal', CONFIG.CURRENT_SUCURSAL);
        }
        modal.classList.remove('active');
        location.reload(); // Recargar para aplicar configuración
      }
    });
  } else {
    console.error('Formulario setup-sucursal-form no encontrado');
  }
}

// Inicializar componentes de UI
function initUIComponents() {
  // Aplicar tema
  applyTheme();
  
  // Inicializar componentes
  try {
    initNavigation();
    
    // Inicializar componentes principales si existen
    if (typeof initFacturador === 'function') {
      initFacturador({
        montoLimite: CONFIG.MONTO_LIMITE_ARCA,
        sucursalId: CONFIG.CURRENT_SUCURSAL?.id
      });
    }
    
    if (typeof initClienteForm === 'function') {
      initClienteForm();
    }
    
    if (typeof setupNotifications === 'function') {
      setupNotifications();
    }
    
    if (typeof initPaymentOptions === 'function') {
      initPaymentOptions();
    }
    
    if (typeof initProductoSelector === 'function') {
      initProductoSelector();
    }
  } catch (error) {
    console.error('Error al inicializar componentes UI:', error);
    showErrorDialog('Error al inicializar la interfaz', error);
  }
}

// Aplicar tema visual
function applyTheme() {
  const root = document.documentElement;
  Object.entries(CONFIG.THEME).forEach(([key, value]) => {
    root.style.setProperty(`--color-${key}`, value);
  });
}

// Configurar navegación principal
function initNavigation() {
  const navLinks = document.querySelectorAll('.nav-link');
  if (navLinks.length === 0) {
    console.warn('No se encontraron elementos de navegación (.nav-link)');
    return;
  }
  
  const views = document.querySelectorAll('.view');
  if (views.length === 0) {
    console.warn('No se encontraron vistas (.view)');
  }
  
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const targetView = link.getAttribute('data-target');
      if (!targetView) {
        console.warn('Enlace sin atributo data-target:', link);
        return;
      }
      
      // Ocultar todas las vistas
      views.forEach(view => view.classList.remove('active'));
      
      // Desactivar todos los enlaces
      navLinks.forEach(navLink => navLink.classList.remove('active'));
      
      // Activar vista y enlace seleccionados
      const viewElement = document.getElementById(targetView);
      if (viewElement) {
        viewElement.classList.add('active');
      } else {
        console.warn(`Vista no encontrada: #${targetView}`);
      }
      
      link.classList.add('active');
    });
  });
}

// Configurar manejadores de eventos principales
function setupEventListeners() {
  // Botón de sincronización manual
  const syncButton = document.getElementById('sync-button');
  if (syncButton) {
    syncButton.addEventListener('click', () => {
      syncPendingData();
    });
  }
  
  // Selector de tema
  const themeSelector = document.getElementById('theme-selector');
  if (themeSelector) {
    themeSelector.addEventListener('change', (e) => {
      const selectedTheme = e.target.value;
      // Aquí se podrían cargar diferentes sets de temas predefinidos
      // Por ahora, solo actualizamos el tema actual en localStorage
      localStorage.setItem('userTheme', selectedTheme);
      applyTheme();
    });
  }
  
  // Configurar eventos específicos para diferentes vistas
  setupFacturadorEvents();
  setupInventarioEvents();
  setupClientesEvents();
  setupReportesEvents();
}

// Configurar eventos específicos del facturador
function setupFacturadorEvents() {
  // Manejar evento de completar factura
  const completarFacturaBtn = document.getElementById('completar-factura-btn');
  if (completarFacturaBtn) {
    completarFacturaBtn.addEventListener('click', async () => {
      try {
        const facturaData = await facturacionService.getCurrentFacturaData();
        
        // Validar si hay productos en la factura
        if (!facturaData.items || facturaData.items.length === 0) {
          showNotification('Error', 'Debe agregar al menos un producto a la factura', 'error');
          return;
        }
        
        // Validar cliente
        if (!facturaData.cliente || !facturaData.cliente.nombre) {
          showNotification('Error', 'Debe seleccionar un cliente', 'error');
          return;
        }
        
        // Mostrar opciones de finalización
        showFinalizarFacturaOptions(facturaData);
      } catch (error) {
        console.error('Error al completar factura:', error);
        showErrorDialog('Error al procesar la factura', error);
      }
    });
  }
  
  // Botón para facturar con ARCA (AFIP)
  const facturarAfipBtn = document.getElementById('facturar-afip-btn');
  if (facturarAfipBtn) {
    facturarAfipBtn.addEventListener('click', async () => {
      try {
        const facturaData = await facturacionService.getCurrentFacturaData();
        
        // Verificar si se requieren datos adicionales
        if (facturaData.total >= CONFIG.MONTO_LIMITE_ARCA && !validarDatosCompletos(facturaData.cliente)) {
          showSolicitarDatosAdicionales();
          return;
        }
        
        // Procesar factura electrónica
        const result = await afipService.generarFacturaElectronica(facturaData);
        if (result.success) {
          // Actualizar factura con CAE
          await facturacionService.updateFactura({
            ...facturaData,
            cae: result.cae,
            caeVencimiento: result.vencimiento,
            afipProcesada: true
          });
          
          showNotification('Éxito', 'Factura electrónica generada correctamente', 'success');
        } else {
          showErrorDialog('Error al generar factura electrónica', result.error);
        }
      } catch (error) {
        console.error('Error al procesar factura con AFIP:', error);
        showErrorDialog('Error al procesar factura con AFIP', error);
      }
    });
  }
}

// Verificar si los datos del cliente están completos
function validarDatosCompletos(cliente) {
  return cliente && cliente.dni && cliente.email && cliente.direccion;
}

// Mostrar diálogo para solicitar datos adicionales
function showSolicitarDatosAdicionales() {
  const modal = document.getElementById('datos-adicionales-modal');
  if (!modal) {
    console.error('Modal datos-adicionales-modal no encontrado');
    return;
  }
  
  modal.classList.add('active');
  
  const form = document.getElementById('datos-adicionales-form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const datosAdicionales = {
        dni: document.getElementById('cliente-dni')?.value || '',
        email: document.getElementById('cliente-email')?.value || '',
        direccion: document.getElementById('cliente-direccion')?.value || '',
        telefono: document.getElementById('cliente-telefono')?.value || ''
      };
      
      // Actualizar datos del cliente
      await clientesService.updateClienteData(datosAdicionales);
      modal.classList.remove('active');
      
      // Reintentar facturación AFIP
      const facturarAfipBtn = document.getElementById('facturar-afip-btn');
      if (facturarAfipBtn) {
        facturarAfipBtn.click();
      }
    });
  } else {
    console.error('Formulario datos-adicionales-form no encontrado');
  }
}

// Mostrar opciones de finalización de factura
function showFinalizarFacturaOptions(facturaData) {
  const modal = document.getElementById('finalizar-factura-modal');
  if (!modal) {
    console.error('Modal finalizar-factura-modal no encontrado');
    return;
  }
  
  modal.classList.add('active');
  
  // Configurar botones de opciones
  const imprimirTicketBtn = document.getElementById('imprimir-ticket-btn');
  if (imprimirTicketBtn) {
    imprimirTicketBtn.addEventListener('click', () => {
      facturacionService.printTicket(facturaData.id);
      modal.classList.remove('active');
    });
  }
  
  const imprimirFacturaBtn = document.getElementById('imprimir-factura-btn');
  if (imprimirFacturaBtn) {
    imprimirFacturaBtn.addEventListener('click', () => {
      facturacionService.printFacturaA4(facturaData.id);
      modal.classList.remove('active');
    });
  }
  
  const enviarWhatsappBtn = document.getElementById('enviar-whatsapp-btn');
  if (enviarWhatsappBtn) {
    enviarWhatsappBtn.addEventListener('click', () => {
      // Solicitar número si no está guardado
      const telefono = facturaData.cliente.telefono || prompt('Ingrese número de WhatsApp:');
      if (telefono) {
        whatsappService.enviarFactura(facturaData.id, telefono);
      }
      modal.classList.remove('active');
    });
  }
  
  const enviarEmailBtn = document.getElementById('enviar-email-btn');
  if (enviarEmailBtn) {
    enviarEmailBtn.addEventListener('click', () => {
      // Solicitar email si no está guardado
      const email = facturaData.cliente.email || prompt('Ingrese correo electrónico:');
      if (email) {
        emailService.enviarFactura(facturaData.id, email);
      }
      modal.classList.remove('active');
    });
  }
}

// Configurar eventos para inventario
function setupInventarioEvents() {
  // Implementación de eventos para la sección de inventario
  console.log('Configurando eventos de inventario');
  // Esta función se expandirá según necesidad
}

// Configurar eventos para clientes
function setupClientesEvents() {
  // Implementación de eventos para la sección de clientes
  console.log('Configurando eventos de clientes');
  // Esta función se expandirá según necesidad
}

// Configurar eventos para reportes
function setupReportesEvents() {
  // Implementación de eventos para la sección de reportes
  console.log('Configurando eventos de reportes');
  // Esta función se expandirá según necesidad
}

// Configurar verificación periódica de pagos
function setupPaymentChecks() {
  // Solo configurar si estamos en modo online y tenemos el servicio
  if (!CONFIG.MODO_OFFLINE && mercadopagoService) {
    // Verificar pagos de MercadoPago cada 30 segundos
    setInterval(async () => {
      try {
        const nuevosPagos = await mercadopagoService.checkNewPayments();
        if (nuevosPagos && nuevosPagos.length > 0) {
          nuevosPagos.forEach(pago => {
            // Mostrar notificación por cada pago
            showNotification(
              'Pago Recibido', 
              `Transferencia exitosa: $${pago.monto} - ${pago.referencia}`, 
              'success'
            );
            
            // Actualizar estado de factura si corresponde
            if (pago.facturaId) {
              facturacionService.updateFacturaStatus(pago.facturaId, 'PAGADA');
            }
          });
        }
      } catch (error) {
        console.error('Error al verificar pagos:', error);
        // No mostrar error al usuario para no interrumpir su trabajo
      }
    }, 30000);
  }
}

// Configurar sistema de sincronización
function setupSyncSystem() {
  // Sincronizar al cambiar de offline a online
  window.addEventListener('online', () => {
    if (CONFIG.MODO_OFFLINE === true) {
      CONFIG.MODO_OFFLINE = false;
      updateUIConnectionStatus();
      syncPendingData();
    }
  });
  
  // Sincronización automática cada 5 minutos si estamos online
  setInterval(() => {
    if (!CONFIG.MODO_OFFLINE) {
      syncPendingData(true); // Sincronización silenciosa
    }
  }, 300000);
}

// Sincronizar datos pendientes con el servidor
async function syncPendingData(silent = false) {
  if (CONFIG.MODO_OFFLINE || !syncService) return;
  
  if (!silent) {
    showNotification('Sincronización', 'Sincronizando datos...', 'info');
  }
  
  try {
    const result = await syncService.syncAllPendingData();
    
    if (!silent) {
      if (result.success) {
        showNotification('Sincronización', `Sincronización completada: ${result.updated} actualizaciones`, 'success');
      } else {
        showNotification('Sincronización', 'Error al sincronizar algunos datos', 'warning');
      }
    }
    
    return result;
  } catch (error) {
    console.error('Error de sincronización:', error);
    if (!silent) {
      showNotification('Error', 'No se pudieron sincronizar los datos', 'error');
    }
    return { success: false, error };
  }
}

// Mostrar vista principal
function showMainView() {
  // Ocultar pantalla de carga
  const loadingScreen = document.getElementById('loading-screen');
  if (loadingScreen) {
    loadingScreen.classList.add('hidden');
  }
  
  // Mostrar dashboard o vista inicial
  const dashboardView = document.getElementById('dashboard-view');
  if (dashboardView) {
    dashboardView.classList.add('active');
  } else {
    console.warn('Elemento dashboard-view no encontrado');
  }
  
  // Activar enlace correspondiente
  const dashboardLink = document.querySelector('.nav-link[data-target="dashboard-view"]');
  if (dashboardLink) {
    dashboardLink.classList.add('active');
  }
}

// Mostrar notificación
function showNotification(title, message, type = 'info') {
  const event = new CustomEvent('show-notification', {
    detail: { title, message, type }
  });
  document.dispatchEvent(event);
}

// Mostrar diálogo de error
function showErrorDialog(title, error) {
  console.error(title, error);
  
  const errorMessage = error?.message || error?.toString() || 'Error desconocido';
  const modal = document.getElementById('error-modal');
  
  if (!modal) {
    console.error('Modal error-modal no encontrado, mostrando alerta:', title, errorMessage);
    alert(`${title}: ${errorMessage}`);
    return;
  }
  
  const errorTitle = document.getElementById('error-title');
  if (errorTitle) {
    errorTitle.textContent = title;
  }
  
  const errorMessageEl = document.getElementById('error-message');
  if (errorMessageEl) {
    errorMessageEl.textContent = errorMessage;
  }
  
  modal.classList.add('active');
  
  const closeBtn = document.getElementById('error-close-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      modal.classList.remove('active');
    });
  }
}

// Exportar funcionalidades que podrían ser necesarias en otros módulos
export {
  showNotification,
  showErrorDialog,
  CONFIG
};