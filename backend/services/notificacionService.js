/**
 * Servicio de notificaciones
 * Maneja las notificaciones push, alertas y mensajes al usuario
 */

class NotificacionService {
    constructor() {
      this.listeners = [];
      console.log('Servicio de notificaciones inicializado');
    }
  
    /**
     * Envía una notificación a todos los clientes conectados
     * @param {Object} notificacion - Datos de la notificación
     * @param {string} notificacion.title - Título de la notificación
     * @param {string} notificacion.message - Mensaje de la notificación
     * @param {string} notificacion.type - Tipo de notificación ('info', 'success', 'warning', 'error')
     * @param {string|null} notificacion.targetWindow - ID de ventana específica o null para todas
     */
    enviarNotificacion(notificacion) {
      if (!notificacion || !notificacion.title || !notificacion.message) {
        console.error('Datos de notificación inválidos', notificacion);
        return false;
      }
  
      // Enviar a todos los listeners registrados
      this.listeners.forEach(listener => {
        try {
          listener(notificacion);
        } catch (error) {
          console.error('Error al enviar notificación a listener', error);
        }
      });
  
      return true;
    }
  
    /**
     * Registra un nuevo listener para recibir notificaciones
     * @param {Function} callback - Función a llamar cuando haya una notificación
     * @returns {number} Índice del listener para poder eliminarlo después
     */
    registrarListener(callback) {
      if (typeof callback !== 'function') {
        throw new Error('El listener debe ser una función');
      }
      
      return this.listeners.push(callback) - 1;
    }
  
    /**
     * Elimina un listener registrado
     * @param {number} index - Índice del listener a eliminar
     */
    eliminarListener(index) {
      if (index >= 0 && index < this.listeners.length) {
        this.listeners.splice(index, 1);
        return true;
      }
      return false;
    }
  
    /**
     * Envía una notificación de éxito
     * @param {string} title - Título 
     * @param {string} message - Mensaje
     * @param {string|null} targetWindow - Ventana específica o null para todas
     */
    success(title, message, targetWindow = null) {
      return this.enviarNotificacion({
        title,
        message,
        type: 'success',
        targetWindow
      });
    }
  
    /**
     * Envía una notificación informativa
     * @param {string} title - Título 
     * @param {string} message - Mensaje
     * @param {string|null} targetWindow - Ventana específica o null para todas
     */
    info(title, message, targetWindow = null) {
      return this.enviarNotificacion({
        title,
        message,
        type: 'info',
        targetWindow
      });
    }
  
    /**
     * Envía una notificación de advertencia
     * @param {string} title - Título 
     * @param {string} message - Mensaje
     * @param {string|null} targetWindow - Ventana específica o null para todas
     */
    warning(title, message, targetWindow = null) {
      return this.enviarNotificacion({
        title,
        message,
        type: 'warning',
        targetWindow
      });
    }
  
    /**
     * Envía una notificación de error
     * @param {string} title - Título 
     * @param {string} message - Mensaje
     * @param {string|null} targetWindow - Ventana específica o null para todas
     */
    error(title, message, targetWindow = null) {
      return this.enviarNotificacion({
        title,
        message,
        type: 'error',
        targetWindow
      });
    }
  }
  
  // Crear una instancia única del servicio
  const notificacionService = new NotificacionService();
  
  module.exports = notificacionService;