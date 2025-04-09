// frontend/servicios/notificationService.js
import { ipcRenderer } from 'electron';

/**
 * Servicio para manejar notificaciones en tiempo real de pagos recibidos
 * Este servicio se integra con Mercado Pago Webhooks para recibir notificaciones
 * de pagos y mostrárselas al usuario
 */

class NotificationService {
  constructor() {
    this.callbacks = [];
    this.webSocket = null;
    this.mercadoPagoClient = null;
    this.isConnected = false;

    // Escuchar mensajes IPC del proceso principal
    ipcRenderer.on('actualizar-pagos', (event, datosPago) => {
      this._procesarNotificacionPago(datosPago);
    });
  }

  /**
   * Inicializa la conexión con Mercado Pago
   * @param {Object} config - Configuración para MP
   * @returns {Promise<boolean>} - Estado de la conexión
   */
  async inicializarMercadoPago(config) {
    try {
      // Implementación según la API de Mercado Pago
      console.log('Inicializando conexión con Mercado Pago', config);
      
      // Esta parte depende de la implementación exacta de la API de MP
      // que uses, aquí mostramos un ejemplo genérico

      // En producción, implementación real con la SDK de Mercado Pago
      /*
      const mercadopago = require('mercadopago');
      mercadopago.configure({
        access_token: config.accessToken
      });
      this.mercadoPagoClient = mercadopago;
      */

      // Para este ejemplo, simulamos la conexión
      this.isConnected = true;
      
      // Iniciar WebSocket para notificaciones en tiempo real
      this._iniciarWebSocket();
      
      return true;
    } catch (error) {
      console.error('Error al inicializar Mercado Pago:', error);
      this.isConnected = false;
      return false;
    }
  }

  /**
   * Inicializa la conexión WebSocket para notificaciones en tiempo real
   * @private
   */
  _iniciarWebSocket() {
    try {
      // En producción usarías la URL real del servicio de notificaciones de MP
      const wsUrl = 'wss://api.mercadopago.com/v1/notifications';
      
      // Simulación de WebSocket para este ejemplo
      console.log('Conectando WebSocket a:', wsUrl);
      
      // En una implementación real:
      /*
      this.webSocket = new WebSocket(wsUrl);
      
      this.webSocket.onopen = () => {
        console.log('Conexión WebSocket establecida');
      };
      
      this.webSocket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'payment') {
          this._procesarNotificacionPago(data.data);
        }
      };
      
      this.webSocket.onerror = (error) => {
        console.error('Error WebSocket:', error);
      };
      
      this.webSocket.onclose = () => {
        console.log('Conexión WebSocket cerrada');
        // Reintentar conexión después de un tiempo
        setTimeout(() => this._iniciarWebSocket(), 5000);
      };
      */
      
      // Simulamos que recibimos pagos cada cierto tiempo para demostración
      if (process.env.NODE_ENV === 'development') {
        this._configurarSimulacionPagos();
      }
    } catch (error) {
      console.error('Error al iniciar WebSocket:', error);
    }
  }

  /**
   * Simulador de pagos para entorno de desarrollo
   * @private
   */
  _configurarSimulacionPagos() {
    console.log('Configurando simulador de pagos para desarrollo');
    
    // Generar pagos aleatorios cada 30-60 segundos
    setInterval(() => {
      const metodoPago = ['Mercado Pago', 'Tarjeta de Crédito', 'Tarjeta de Débito', 'QR'][Math.floor(Math.random() * 4)];
      const monto = (Math.random() * 10000 + 100).toFixed(2);
      
      const datosPago = {
        id: `pago_${Date.now()}`,
        metodo: metodoPago,
        monto: parseFloat(monto),
        moneda: 'ARS',
        estado: 'aprobado',
        fecha: new Date().toISOString(),
        clienteId: `cliente_${Math.floor(Math.random() * 1000)}`,
        detalles: {
          nombre: 'Cliente Simulado',
          descripcion: 'Pago simulado para pruebas'
        }
      };
      
      // Enviar notificación al proceso principal para mostrar notificación del sistema
      ipcRenderer.send('pago-recibido', datosPago);
      
      // Procesar localmente
      this._procesarNotificacionPago(datosPago);
    }, Math.random() * 30000 + 30000); // Entre 30 y 60 segundos
  }

  /**
   * Procesa una notificación de pago recibida
   * @param {Object} datosPago - Datos del pago recibido
   * @private
   */
  _procesarNotificacionPago(datosPago) {
    console.log('Pago recibido:', datosPago);
    
    // Notificar a todos los callbacks registrados
    this.callbacks.forEach(callback => {
      try {
        callback(datosPago);
      } catch (error) {
        console.error('Error en callback de notificación:', error);
      }
    });
    
    // Mostrar notificación en pantalla
    this._mostrarNotificacionUI(datosPago);
  }

  /**
   * Muestra una notificación en la interfaz de usuario
   * @param {Object} datosPago - Datos del pago recibido
   * @private
   */
  _mostrarNotificacionUI(datosPago) {
    try {
      // Crear elemento de notificación
      const notificacion = document.createElement('div');
      notificacion.className = 'notificacion-pago';
      notificacion.innerHTML = `
        <div class="notificacion-contenido">
          <div class="notificacion-icono">💰</div>
          <div class="notificacion-texto">
            <h4>¡Pago Recibido!</h4>
            <p>$${datosPago.monto.toFixed(2)} - ${datosPago.metodo}</p>
          </div>
          <button class="notificacion-cerrar">×</button>
        </div>
      `;
      
      // Estilo para la notificación
      notificacion.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background-color: #4CAF50;
        color: white;
        padding: 15px;
        border-radius: 8px;
        box-shadow: 0 4px 8px rgba(0,0,0,0.2);
        z-index: 1000;
        min-width: 300px;
        animation: slideIn 0.5s ease-out;
      `;
      
      // Añadir al DOM
      document.body.appendChild(notificacion);
      
      // Configurar botón de cerrar
      const cerrarBtn = notificacion.querySelector('.notificacion-cerrar');
      cerrarBtn.addEventListener('click', () => {
        notificacion.style.animation = 'slideOut 0.5s ease-in';
        setTimeout(() => {
          document.body.removeChild(notificacion);
        }, 500);
      });
      
      // Auto-eliminar después de 5 segundos
      setTimeout(() => {
        if (document.body.contains(notificacion)) {
          notificacion.style.animation = 'slideOut 0.5s ease-in';
          setTimeout(() => {
            if (document.body.contains(notificacion)) {
              document.body.removeChild(notificacion);
            }
          }, 500);
        }
      }, 5000);
      
      // Añadir estilos de animación si no existen
      if (!document.getElementById('notificacion-styles')) {
        const styleSheet = document.createElement('style');
        styleSheet.id = 'notificacion-styles';
        styleSheet.innerHTML = `
          @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
          }
          
          @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
          }
          
          .notificacion-contenido {
            display: flex;
            align-items: center;
          }
          
          .notificacion-icono {
            font-size: 24px;
            margin-right: 15px;
          }
          
          .notificacion-texto {
            flex-grow: 1;
          }
          
          .notificacion-texto h4 {
            margin: 0;
            font-size: 16px;
          }
          
          .notificacion-texto p {
            margin: 5px 0 0;
            font-size: 14px;
          }
          
          .notificacion-cerrar {
            background: none;
            border: none;
            color: white;
            font-size: 20px;
            cursor: pointer;
            padding: 0 5px;
          }
        `;
        document.head.appendChild(styleSheet);
      }
    } catch (error) {
      console.error('Error al mostrar notificación UI:', error);
    }
  }

  /**
   * Registra un callback para recibir notificaciones de pagos
   * @param {Function} callback - Función a llamar cuando se recibe un pago
   * @returns {number} - ID del callback para poder desregistrarlo
   */
  onPagoRecibido(callback) {
    if (typeof callback === 'function') {
      this.callbacks.push(callback);
      return this.callbacks.length - 1;
    }
    return -1;
  }

  /**
   * Elimina un callback registrado
   * @param {number} callbackId - ID del callback a eliminar
   */
  removeCallback(callbackId) {
    if (callbackId >= 0 && callbackId < this.callbacks.length) {
      this.callbacks.splice(callbackId, 1);
    }
  }

  /**
   * Destruye la instancia del servicio, cerrando conexiones
   */
  destruir() {
    if (this.webSocket && this.webSocket.readyState === WebSocket.OPEN) {
      this.webSocket.close();
    }
    
    this.callbacks = [];
    this.isConnected = false;
  }
}

// Exportamos una única instancia del servicio
const notificationService = new NotificationService();
export default notificationService;
