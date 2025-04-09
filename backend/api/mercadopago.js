const mercadopago = require('mercadopago');
const config = require('../../config');
const { BrowserWindow } = require('electron');

class MercadoPagoService {
  constructor() {
    // Inicializar Mercado Pago SDK
    this.initialized = false;
    this.accessToken = config.mercadoPago.accessToken;
    
    if (this.accessToken) {
      this.init();
    }
    
    // Escuchar notificaciones IPN
    this.webhookQueue = [];
    this.processing = false;
  }
  
  // Inicializar SDK de Mercado Pago
  init() {
    try {
      mercadopago.configure({
        access_token: this.accessToken
      });
      
      this.initialized = true;
      console.log('SDK de Mercado Pago inicializado correctamente');
      return true;
    } catch (error) {
      console.error('Error al inicializar SDK de Mercado Pago:', error);
      return false;
    }
  }
  
  // Verificar si está inicializado
  isInitialized() {
    return this.initialized;
  }
  
  // Verificar estado de un pago
  async verificarPago(pagoId) {
    if (!this.isInitialized()) {
      throw new Error('SDK de Mercado Pago no inicializado');
    }
    
    try {
      const response = await mercadopago.payment.get(pagoId);
      
      return {
        id: response.body.id,
        status: response.body.status,
        status_detail: response.body.status_detail,
        external_reference: response.body.external_reference,
        transaction_amount: response.body.transaction_amount,
        payment_method_id: response.body.payment_method_id,
        date_created: response.body.date_created,
        date_approved: response.body.date_approved
      };
    } catch (error) {
      console.error('Error al verificar pago en Mercado Pago:', error);
      throw error;
    }
  }
  
  // Crear un pago con QR
  async crearPagoQR(facturaData) {
    if (!this.isInitialized()) {
      throw new Error('SDK de Mercado Pago no inicializado');
    }
    
    try {
      // Crear preferencia de pago
      const preference = {
        items: [
          {
            title: `Factura #${facturaData.numero}`,
            description: `Pago de factura #${facturaData.numero}`,
            quantity: 1,
            unit_price: facturaData.total,
            currency_id: 'ARS'
          }
        ],
        external_reference: facturaData.id.toString(),
        notification_url: config.mercadoPago.notificationUrl,
        back_urls: {
          success: config.mercadoPago.successUrl,
          failure: config.mercadoPago.failureUrl,
          pending: config.mercadoPago.pendingUrl
        },
        auto_return: 'approved'
      };
      
      const response = await mercadopago.preferences.create(preference);
      
      return {
        id: response.body.id,
        init_point: response.body.init_point,
        qr_code: this.generateQRCode(response.body.id)
      };
    } catch (error) {
      console.error('Error al crear pago QR en Mercado Pago:', error);
      throw error;
    }
  }
  
  // Generar código QR para pago
  generateQRCode(preferenceId) {
    return `https://mercadopago.com.ar/qr/${preferenceId}`;
  }
  
  // Procesar notificación IPN
  async procesarNotificacion(data) {
    // Agregar a la cola de notificaciones
    this.webhookQueue.push(data);
    
    // Procesar cola si no está procesando
    if (!this.processing) {
      await this.procesarCola();
    }
  }
  
  // Procesar cola de notificaciones
  async procesarCola() {
    if (this.webhookQueue.length === 0 || this.processing) {
      return;
    }
    
    this.processing = true;
    
    try {
      const data = this.webhookQueue.shift();
      
      // Verificar tipo de notificación
      if (data.type === 'payment') {
        const paymentId = data.data.id;
        const paymentInfo = await this.verificarPago(paymentId);
        
        // Si el pago está aprobado, notificar a la ventana principal
        if (paymentInfo.status === 'approved') {
          const windows = BrowserWindow.getAllWindows();
          
          if (windows.length > 0) {
            windows[0].webContents.send('pago-recibido', paymentInfo);
          }
        }
      }
    } catch (error) {
      console.error('Error al procesar notificación IPN:', error);
    } finally {
      this.processing = false;
      
      // Procesar siguiente notificación si hay
      if (this.webhookQueue.length > 0) {
        await this.procesarCola();
      }
    }
  }
  
  // Iniciar escucha de pagos en tiempo real
  async iniciarEscuchaPagos(callbackFn) {
    if (!this.isInitialized()) {
      throw new Error('SDK de Mercado Pago no inicializado');
    }
    
    try {
      // Iniciar cliente de websocket para escucha de pagos en tiempo real
      // (Esta implementación es un ejemplo, la integración real dependerá de la API de Mercado Pago)
      console.log('Iniciando escucha de pagos en tiempo real...');
      
      // Simular una verificación periódica (en producción, usar webhooks)
      this.intervalId = setInterval(async () => {
        try {
          // Verificar pagos recientes
          const pagosRecientes = await this.obtenerPagosRecientes();
          
          if (pagosRecientes && pagosRecientes.length > 0) {
            for (const pago of pagosRecientes) {
              callbackFn(pago);
            }
          }
        } catch (error) {
          console.error('Error al verificar pagos recientes:', error);
        }
      }, 30000); // Cada 30 segundos
      
      return true;
    } catch (error) {
      console.error('Error al iniciar escucha de pagos:', error);
      throw error;
    }
  }
  
  // Detener escucha de pagos
  detenerEscuchaPagos() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('Escucha de pagos detenida');
    }
  }
  
  // Obtener pagos recientes
  async obtenerPagosRecientes() {
    if (!this.isInitialized()) {
      throw new Error('SDK de Mercado Pago no inicializado');
    }
    
    try {
      const now = new Date();
      const oneMinuteAgo = new Date(now.getTime() - 60000); // 1 minuto atrás
      
      const response = await mercadopago.payment.search({
        qs: {
          begin_date: oneMinuteAgo.toISOString(),
          end_date: now.toISOString()
        }
      });
      
      return response.body.results;
    } catch (error) {
      console.error('Error al obtener pagos recientes:', error);
      throw error;
    }
  }
  
  // Configurar credenciales
  async configurarCredenciales(accessToken) {
    this.accessToken = accessToken;
    
    // Guardar en config
    config.mercadoPago.accessToken = accessToken;
    
    // Reinicializar SDK
    return this.init();
  }
}

module.exports = MercadoPagoService;
