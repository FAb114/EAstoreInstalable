/**
 * app-config.js
 * Configuraciones generales (IDs de API, URLs, etc.)
 * 
 * Este archivo contiene todas las configuraciones centralizadas de la aplicación,
 * incluyendo credenciales de APIs, URLs de servicios, y configuraciones generales.
 */

// Detectar ambiente
const isDevelopment = process.env.NODE_ENV === 'development';
const isTest = process.env.NODE_ENV === 'test';
const isProduction = !isDevelopment && !isTest;

// Configuración base
const config = {
  // Información de la aplicación
  app: {
    name: 'EAstore',
    version: '1.0.0',
    company: 'EAstore Electrónicos',
    supportEmail: 'soporte@easture.com',
  },
  
  // Configuración de ambiente
  env: {
    isDevelopment,
    isTest,
    isProduction,
    // Usar valores por defecto si no están definidos en .env
    port: process.env.PORT || 3000,
  },
  
  // Configuración de la base de datos
  database: {
    // Configuración de SQLite para desarrollo/producción
    dialect: 'sqlite',
    storage: isDevelopment ? './dev-database.sqlite' : './easture-database.sqlite',
    
    // Opciones de Sequelize
    options: {
      logging: isDevelopment,
      pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
      }
    },
    
    // Opciones para migración y sincronización
    sync: {
      force: false,
      alter: isDevelopment
    }
  },
  
  // Configuración para APIs externas
  apis: {
    // Integración con ARCA (AFIP - Argentina)
    arca: {
      baseUrl: 'https://serviciosweb.afip.gob.ar/wsfev1/service.asmx',
      sandbox: !isProduction,
      cuitEmpresa: process.env.ARCA_CUIT || '',
      certificado: process.env.ARCA_CERTIFICADO || './certs/afip.p12',
      clave: process.env.ARCA_CLAVE || '',
      // Cantidad mínima para requerir datos completos del cliente
      montoMinimoIdentificacion: 50000,
      // Puntos de venta habilitados por sucursal
      puntosVenta: {
        // sucursalId: puntoVenta
        1: 1,
        2: 2,
        3: 3
      }
    },
    
    // Integración con MercadoPago
    mercadoPago: {
      publicKey: process.env.MP_PUBLIC_KEY || '',
      accessToken: process.env.MP_ACCESS_TOKEN || '',
      sandbox: !isProduction,
      notificationUrl: process.env.MP_NOTIFICATION_URL || '',
      // Tiempo de espera para verificar pagos (en milisegundos)
      checkInterval: 3000
    },
    
    // Integración con WhatsApp Business API
    whatsapp: {
      enabled: false, // Habilitar cuando se tenga la integración
      apiKey: process.env.WA_API_KEY || '',
      phoneNumberId: process.env.WA_PHONE_ID || '',
      businessAccountId: process.env.WA_BUSINESS_ID || '',
      apiVersion: 'v16.0',
      baseUrl: 'https://graph.facebook.com'
    }
  },
  
  // Configuración para servicios de email
  email: {
    enabled: true,
    service: 'gmail', // O el servicio que utilice la empresa
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER || '',
      pass: process.env.EMAIL_PASS || ''
    },
    defaultFrom: process.env.EMAIL_FROM || 'facturacion@easture.com',
    templates: {
      facturaPath: './templates/email/factura.html',
      receiptPath: './templates/email/recibo.html'
    }
  },
  
  // Configuración de impresión
  printing: {
    defaultTicketPrinter: process.env.TICKET_PRINTER || 'POS-58',
    defaultDocumentPrinter: process.env.DOCUMENT_PRINTER || '',
    ticketWidth: 58, // ancho en mm
    ticketMargin: 2,
    pageSize: 'A4',
    // Configuración para cada tipo de impresora
    printers: {
      'POS-58': {
        driver: 'escpos',
        connection: {
          type: 'usb',
          vendorId: 0x0416,
          productId: 0x5011
        }
      }
    }
  },
  
  // Configuración de la interfaz de usuario
  ui: {
    theme: 'light', // 'light' o 'dark'
    language: 'es-AR',
    dateFormat: 'DD/MM/YYYY',
    timeFormat: 'HH:mm:ss',
    currency: 'ARS',
    logo: '../assets/logo.png',
    companyName: 'EAstore Electrónicos',
    defaultView: 'dashboard', // Vista inicial al abrir la aplicación
    // Colores personalizados
    colors: {
      primary: '#3498db',
      secondary: '#2ecc71',
      accent: '#e74c3c',
      background: '#f8f9fa'
    }
  },
  
  // Configuración para sincronización online/offline
  sync: {
    // Intervalo de sincronización automática (en milisegundos)
    interval: 30 * 60 * 1000, // 30 minutos
    // Número máximo de intentos de sincronización
    maxRetries: 5,
    // Tiempo de espera entre reintentos (en milisegundos)
    retryDelay: 60 * 1000, // 1 minuto
    // Límite de registros pendientes para sincronización forzada
    forceSyncThreshold: 100,
    // Prioridad de sincronización por tipo de datos
    priority: ['clientes', 'productos', 'facturas', 'transacciones']
  },
  
// Configuración del sistema de logs
logging: {
    level: isDevelopment ? 'DEBUG' : 'INFO',
    consoleOutput: isDevelopment,
    maxLogFiles: 30, // Mantener 30 días de logs
    rotation: true
  },
  
  // Configuración de seguridad
  security: {
    // Tiempo de sesión en minutos
    sessionTimeout: 60,
    // Requerir autenticación para acciones sensibles
    requireAuthForSensitiveActions: true,
    // Opciones de encriptación para datos sensibles
    encryption: {
      algorithm: 'aes-256-cbc',
      secretKey: process.env.ENCRYPTION_KEY || 'clave-secreta-por-defecto-cambiar-en-produccion'
    }
  },
  
  // Configuración para respaldos automáticos
  backup: {
    enabled: true,
    frequency: 'daily', // 'daily', 'weekly', 'monthly'
    time: '03:00', // Hora del día para realizar el respaldo
    keepCount: 30, // Número de respaldos a conservar
    path: './backups'
  },
  
  // Información de sucursales
  sucursales: [
    {
      id: 1,
      nombre: 'Casa Central',
      direccion: 'Av. Principal 123',
      telefono: '123456789',
      email: 'central@easture.com',
      esPrincipal: true
    },
    {
      id: 2,
      nombre: 'Sucursal Norte',
      direccion: 'Calle Norte 456',
      telefono: '987654321',
      email: 'norte@easture.com',
      esPrincipal: false
    },
    {
      id: 3,
      nombre: 'Sucursal Sur',
      direccion: 'Calle Sur 789',
      telefono: '456789123',
      email: 'sur@easture.com',
      esPrincipal: false
    }
  ]
};

// Cargar configuraciones específicas por ambiente
try {
  let envConfig = {};
  
  if (isDevelopment) {
    envConfig = require('./config.dev.js');
  } else if (isTest) {
    envConfig = require('./config.test.js');
  } else {
    envConfig = require('./config.prod.js');
  }
  
  // Combinar configuraciones
  Object.assign(config, envConfig);
} catch (error) {
  console.log('No se encontró configuración específica para el ambiente o hubo un error al cargarla');
}

module.exports = config;