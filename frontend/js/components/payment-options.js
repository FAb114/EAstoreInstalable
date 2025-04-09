/**
 * EAstore - Componente de Opciones de Pago
 * Maneja las diferentes opciones de pago y la integración con MercadoPago
 */

class PaymentOptions {
    constructor(options = {}) {
      // Opciones configurables
      this.container = options.container || document.getElementById('payment-options-container');
      this.onPaymentSelect = options.onPaymentSelect || (() => {});
      this.onPaymentReceived = options.onPaymentReceived || (() => {});
      
      // Estado interno
      this.selectedMethod = null;
      this.mpIntegrationActive = false;
      this.pollingInterval = null;
      this.currentTransactionId = null;
      
      // Configuración de métodos de pago disponibles
      this.paymentMethods = [
        { id: 'efectivo', name: 'Efectivo', icon: 'money-bill', requiresARCA: false },
        { id: 'transferencia', name: 'Transferencia Bancaria', icon: 'university', requiresARCA: true },
        { id: 'tarjeta_debito', name: 'Tarjeta de Débito', icon: 'credit-card', requiresARCA: true },
        { id: 'tarjeta_credito', name: 'Tarjeta de Crédito', icon: 'credit-card', requiresARCA: true },
        { id: 'qr', name: 'Pago con QR', icon: 'qrcode', requiresARCA: true }
      ];
      
      this.init();
    }
    
    init() {
      this.render();
      this.setupEventListeners();
      this.checkMercadoPagoStatus();
    }
    
    render() {
      if (!this.container) return;
      
      this.container.innerHTML = `
        <div class="card">
          <h3>Forma de Pago</h3>
          <div class="payment-methods">
            ${this.paymentMethods.map(method => `
              <div class="payment-method" data-id="${method.id}">
                <i class="fas fa-${method.icon}"></i>
                <span>${method.name}</span>
              </div>
            `).join('')}
          </div>
          
          <div class="payment-details" id="payment-details">
            <!-- Los detalles del método de pago se mostrarán aquí -->
          </div>
          
          <!-- Notificaciones de MercadoPago -->
          <div class="mp-notification" id="mp-notification" style="display: none;">
            <div class="flex space-between">
              <strong>Pagos con MercadoPago</strong>
              <span class="status-indicator ${this.mpIntegrationActive ? 'status-online' : 'status-offline'}" id="mp-status"></span>
            </div>
            <p id="mp-message">Conectado a MercadoPago. Las transferencias se notificarán automáticamente.</p>
          </div>
        </div>
        
        <!-- Modal para QR y otros métodos -->
        <div class="modal-overlay" id="payment-modal" style="display: none;">
          <div class="modal">
            <div class="modal-header">
              <h3 class="modal-title" id="payment-modal-title">Código QR de Pago</h3>
              <button class="modal-close" id="payment-modal-close">&times;</button>
            </div>
            <div class="modal-content" id="payment-modal-content">
              <!-- Contenido del modal -->
            </div>
          </div>
        </div>
      `;
    }
    
    setupEventListeners() {
      // Selección de método de pago
      document.querySelectorAll('.payment-method').forEach(element => {
        element.addEventListener('click', () => {
          const methodId = element.getAttribute('data-id');
          this.selectPaymentMethod(methodId);
        });
      });
      
      // Cerrar modal
      const modalClose = document.getElementById('payment-modal-close');
      if (modalClose) {
        modalClose.addEventListener('click', () => {
          document.getElementById('payment-modal').style.display = 'none';
        });
      }
    }
    
    async checkMercadoPagoStatus() {
      try {
        const response = await fetch('/api/mercadopago/status');
        
        if (response.ok) {
          const status = await response.json();
          this.mpIntegrationActive = status.active;
          
          // Actualizar indicador de estado
          const mpStatus = document.getElementById('mp-status');
          const mpNotification = document.getElementById('mp-notification');
          const mpMessage = document.getElementById('mp-message');
          
          if (mpStatus && mpNotification) {
            mpStatus.className = `status-indicator ${this.mpIntegrationActive ? 'status-online' : 'status-offline'}`;
            mpNotification.style.display = 'block';
            
            if (mpMessage) {
              mpMessage.textContent = this.mpIntegrationActive ? 
                'Conectado a MercadoPago. Las transferencias se notificarán automáticamente.' : 
                'MercadoPago desconectado. Las transferencias deberán confirmarse manualmente.';
            }
          }
          
          // Si está activo, iniciar polling de notificaciones
          if (this.mpIntegrationActive) {
            this.startNotificationPolling();
          }
        } else {
          console.error('Error al verificar estado de MercadoPago');
          this.setOfflineMode();
        }
      } catch (error) {
        console.error('Error al conectar con MercadoPago:', error);
        this.setOfflineMode();
      }
    }
    
    setOfflineMode() {
      this.mpIntegrationActive = false;
      const mpStatus = document.getElementById('mp-status');
      const mpNotification = document.getElementById('mp-notification');
      const mpMessage = document.getElementById('mp-message');
      
      if (mpStatus && mpNotification) {
        mpStatus.className = 'status-indicator status-offline';
        mpNotification.style.display = 'block';
        
        if (mpMessage) {
          mpMessage.textContent = 'Modo offline. Las transferencias deberán confirmarse manualmente.';
        }
      }
    }
    
    selectPaymentMethod(methodId) {
      // Remover selección anterior
      document.querySelectorAll('.payment-method').forEach(element => {
        element.classList.remove('selected');
      });
      
      // Seleccionar el nuevo método
      const methodElement = document.querySelector(`.payment-method[data-id="${methodId}"]`);
      if (methodElement) {
        methodElement.classList.add('selected');
      }
      
      // Guardar método seleccionado
      this.selectedMethod = this.paymentMethods.find(method => method.id === methodId);
      
      // Actualizar detalles del método de pago
      this.updatePaymentDetails(methodId);
      
      // Notificar selección
      this.onPaymentSelect(this.selectedMethod);
    }
    
    updatePaymentDetails(methodId) {
      const detailsContainer = document.getElementById('payment-details');
      if (!detailsContainer) return;
      
      // Contenido específico para cada método de pago
      switch (methodId) {
        case 'efectivo':
          detailsContainer.innerHTML = `
            <div class="form-group">
              <label for="monto-efectivo">Monto recibido:</label>
              <input type="number" id="monto-efectivo" class="form-control" step="0.01">
            </div>
            <div class="form-group">
              <label for="cambio-efectivo">Cambio a devolver:</label>
              <input type="number" id="cambio-efectivo" class="form-control" readonly>
            </div>
            <button type="button" class="btn btn-success" id="confirmar-efectivo">Confirmar Pago</button>
          `;
          
          // Calcular cambio automáticamente
          const montoEfectivo = document.getElementById('monto-efectivo');
          const cambioEfectivo = document.getElementById('cambio-efectivo');
          
          if (montoEfectivo && cambioEfectivo) {
            montoEfectivo.addEventListener('input', () => {
              const montoRecibido = parseFloat(montoEfectivo.value) || 0;
              const total = this.getCurrentTotal();
              const cambio = montoRecibido > total ? montoRecibido - total : 0;
              cambioEfectivo.value = cambio.toFixed(2);
            });
          }
          
          // Confirmar pago en efectivo
          const confirmarEfectivo = document.getElementById('confirmar-efectivo');
          if (confirmarEfectivo) {
            confirmarEfectivo.addEventListener('click', () => {
              const montoRecibido = parseFloat(document.getElementById('monto-efectivo').value) || 0;
              const total = this.getCurrentTotal();
              
              if (montoRecibido < total) {
                this.showNotification('El monto recibido es menor al total', 'error');
                return;
              }
              
              this.handlePaymentReceived({
                method: 'efectivo',
                amount: total,
                receivedAmount: montoRecibido,
                change: montoRecibido - total
              });
            });
          }
          break;
          
        case 'transferencia':
          detailsContainer.innerHTML = `
            <div class="bank-details">
              <p>Transferir el importe a la siguiente cuenta:</p>
              <p><strong>Banco:</strong> Banco de la Nación Argentina</p>
              <p><strong>Titular:</strong> EAstore S.A.</p>
              <p><strong>CUIT:</strong> 30-12345678-9</p>
              <p><strong>CBU:</strong> 0110000000000000000000</p>
              <p><strong>Alias:</strong> EASTORE.VENTAS</p>
            </div>
            <div class="form-actions mt-2">
              <button type="button" class="btn" id="ver-qr-transferencia">Ver QR</button>
              <button type="button" class="btn btn-success" id="confirmar-transferencia">Confirmar Transferencia</button>
            </div>
          `;
          
          // Mostrar QR de transferencia
          const verQrTransferencia = document.getElementById('ver-qr-transferencia');
          if (verQrTransferencia) {
            verQrTransferencia.addEventListener('click', () => {
              this.showQrModal('transferencia');
            });
          }
          
          // Confirmar transferencia manualmente
          const confirmarTransferencia = document.getElementById('confirmar-transferencia');
          if (confirmarTransferencia) {
            confirmarTransferencia.addEventListener('click', () => {
              this.handlePaymentReceived({
                method: 'transferencia',
                amount: this.getCurrentTotal(),
                reference: `Manual-${Date.now()}`
              });
            });
          }
          break;
          
        case 'tarjeta_debito':
        case 'tarjeta_credito':
          const cardType = methodId === 'tarjeta_debito' ? 'Débito' : 'Crédito';
          
          detailsContainer.innerHTML = `
            <div class="card-payment">
              <p>Pago con Tarjeta de ${cardType}</p>
              <div class="form-group">
                <label for="terminal-id">Terminal:</label>
                <select id="terminal-id" class="form-control">
                  <option value="1">Terminal 1</option>
                  <option value="2">Terminal 2</option>
                </select>
              </div>
              <div class="form-group">
                <label for="card-number">Últimos 4 dígitos:</label>
                <input type="text" id="card-number" maxlength="4" pattern="[0-9]*">
              </div>
              <div class="form-group">
                <label for="cuotas">Cuotas:</label>
                <select id="cuotas" ${methodId === 'tarjeta_debito' ? 'disabled' : ''}>
                  <option value="1">1 cuota</option>
                  <option value="3">3 cuotas</option>
                  <option value="6">6 cuotas</option>
                  <option value="12">12 cuotas</option>
                </select>
              </div>
              <button type="button" class="btn btn-success" id="confirmar-tarjeta">Confirmar Pago</button>
            </div>
          `;
          
          // Confirmar pago con tarjeta
          const confirmarTarjeta = document.getElementById('confirmar-tarjeta');
          if (confirmarTarjeta) {
            confirmarTarjeta.addEventListener('click', () => {
              const terminalId = document.getElementById('terminal-id').value;
              const cardLastDigits = document.getElementById('card-number').value;
              const cuotas = document.getElementById('cuotas').value;
              
              if (!cardLastDigits || cardLastDigits.length !== 4) {
                this.showNotification('Ingrese los últimos 4 dígitos de la tarjeta', 'error');
                return;
              }
              
              this.handlePaymentReceived({
                method: methodId,
                amount: this.getCurrentTotal(),
                terminal: terminalId,
                cardLastDigits: cardLastDigits,
                installments: parseInt(cuotas)
              });
            });
          }
          break;
          
        case 'qr':
          detailsContainer.innerHTML = `
            <div class="qr-payment">
              <p>Pago mediante código QR</p>
              <div class="form-actions">
                <button type="button" class="btn" id="generar-qr">Generar QR</button>
                <button type="button" class="btn btn-success" id="confirmar-qr">Confirmar Pago</button>
              </div>
            </div>
          `;
          
          // Generar QR
          const generarQr = document.getElementById('generar-qr');
          if (generarQr) {
            generarQr.addEventListener('click', () => {
              this.showQrModal('qr');
            });
          }
          
          // Confirmar pago QR manualmente
          const confirmarQr = document.getElementById('confirmar-qr');
          if (confirmarQr) {
            confirmarQr.addEventListener('click', () => {
              this.handlePaymentReceived({
                method: 'qr',
                amount: this.getCurrentTotal(),
                reference: `QR-${Date.now()}`
              });
            });
          }
          break;
      }
    }
    
    showQrModal(type) {
      const modal = document.getElementById('payment-modal');
      const modalTitle = document.getElementById('payment-modal-title');
      const modalContent = document.getElementById('payment-modal-content');
      
      if (!modal || !modalTitle || !modalContent) return;
      
      // Configurar título y contenido según el tipo
      if (type === 'transferencia') {
        modalTitle.textContent = 'QR para Transferencia';
        
        // Generar QR para transferencia
        this.generateTransferQr(modalContent);
      } else if (type === 'qr') {
        modalTitle.textContent = 'QR de Pago';
        
        // Generar QR para pago
        this.generatePaymentQr(modalContent);
      }
      
      // Mostrar modal
      modal.style.display = 'flex';
    }
    
    async generateTransferQr(container) {
      container.innerHTML = `
        <div class="text-center">
          <div class="loading-spinner mb-2"></div>
          <p>Generando código QR...</p>
        </div>
      `;
      
      try {
        // En implementación real, esto haría una llamada al API
        // Por ahora simulamos una llamada con setTimeout
        setTimeout(() => {
          container.innerHTML = `
            <div class="text-center">
              <img src="assets/qr-transfer-sample.png" alt="QR de Transferencia" class="qr-code-img">
              <p class="mt-2">Escanea con la aplicación de tu banco</p>
              <button type="button" class="btn btn-outline mt-2" id="download-qr">Descargar QR</button>
            </div>
          `;
          
          // Evento para descargar QR (simulado)
          const downloadBtn = document.getElementById('download-qr');
          if (downloadBtn) {
            downloadBtn.addEventListener('click', () => {
              this.showNotification('QR descargado correctamente', 'success');
            });
          }
        }, 1000);
      } catch (error) {
        console.error('Error al generar QR de transferencia:', error);
        container.innerHTML = `
          <div class="text-center">
            <p class="text-danger">Error al generar el código QR. Intente nuevamente.</p>
            <button type="button" class="btn mt-2" id="retry-qr">Reintentar</button>
          </div>
        `;
        
        const retryBtn = document.getElementById('retry-qr');
        if (retryBtn) {
          retryBtn.addEventListener('click', () => {
            this.generateTransferQr(container);
          });
        }
      }
    }
    
    async generatePaymentQr(container) {
      container.innerHTML = `
        <div class="text-center">
          <div class="loading-spinner mb-2"></div>
          <p>Conectando con MercadoPago...</p>
        </div>
      `;
      
      try {
        // Si estamos en modo offline o MercadoPago no está activo
        if (!this.mpIntegrationActive) {
          throw new Error('MercadoPago no disponible');
        }
        
        // Generar transacción en MercadoPago
        const response = await fetch('/api/mercadopago/qr', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            amount: this.getCurrentTotal(),
            description: 'Compra en EAstore'
          })
        });
        
        if (response.ok) {
          const data = await response.json();
          this.currentTransactionId = data.transactionId;
          
          container.innerHTML = `
            <div class="text-center">
              <img src="${data.qrImageUrl || 'assets/qr-sample.png'}" alt="QR de Pago" class="qr-code-img">
              <p class="mt-2">Escanea con la aplicación de MercadoPago</p>
              <p class="mp-transaction-id">ID: ${data.transactionId}</p>
              <div class="transaction-status" id="transaction-status">
                <span class="status-indicator status-pending"></span>
                <span>Esperando pago...</span>
              </div>
            </div>
          `;
          
          // Iniciar polling específico para esta transacción
          this.pollTransactionStatus(data.transactionId);
        } else {
          throw new Error('Error al generar QR de pago');
        }
      } catch (error) {
        console.error('Error al generar QR de pago:', error);
        
        // Modo offline o error: mostrar QR de muestra
        container.innerHTML = `
          <div class="text-center">
            <img src="assets/qr-sample.png" alt="QR de Pago (Muestra)" class="qr-code-img">
            <p class="mt-2">Modo Offline - QR de muestra</p>
            <div class="mt-2">
              <button type="button" class="btn btn-success" id="simulate-payment">Simular Pago Recibido</button>
            </div>
          </div>
        `;
        
        // Botón para simular pago recibido
        const simulateBtn = document.getElementById('simulate-payment');
        if (simulateBtn) {
          simulateBtn.addEventListener('click', () => {
            this.handlePaymentReceived({
              method: 'qr',
              amount: this.getCurrentTotal(),
              reference: `QR-Offline-${Date.now()}`
            });
            
            document.getElementById('payment-modal').style.display = 'none';
          });
        }
      }
    }
    
    pollTransactionStatus(transactionId) {
      // Limpiar intervalo anterior si existe
      if (this.pollingInterval) {
        clearInterval(this.pollingInterval);
      }
      
      // Configurar nuevo intervalo para esta transacción
      this.pollingInterval = setInterval(async () => {
        try {
          const response = await fetch(`/api/mercadopago/transaction/${transactionId}`);
          
          if (response.ok) {
            const data = await response.json();
            
            if (data.status === 'approved') {
              // Pago aprobado
              clearInterval(this.pollingInterval);
              
              // Actualizar estado en modal
              const statusElement = document.getElementById('transaction-status');
              if (statusElement) {
                statusElement.innerHTML = `
                  <span class="status-indicator status-success"></span>
                  <span>Pago aprobado</span>
                `;
              }
              
              // Notificar pago recibido
              this.handlePaymentReceived({
                method: 'qr',
                amount: this.getCurrentTotal(),
                mpTransactionId: transactionId,
                mpReference: data.reference
              });
              
              // Cerrar modal después de 2 segundos
              setTimeout(() => {
                document.getElementById('payment-modal').style.display = 'none';
              }, 2000);
            } else if (data.status === 'rejected') {
              // Pago rechazado
              clearInterval(this.pollingInterval);
              
              // Actualizar estado en modal
              const statusElement = document.getElementById('transaction-status');
              if (statusElement) {
                statusElement.innerHTML = `
                  <span class="status-indicator status-error"></span>
                  <span>Pago rechazado</span>
                `;
              }
            }
            // Para otros estados (pending, in_process) simplemente continuamos esperando
          }
        } catch (error) {
          console.error('Error al verificar estado de transacción:', error);
        }
      }, 3000); // Consultar cada 3 segundos
    }
    
    startNotificationPolling() {
      // Iniciar polling general de notificaciones (no específico de una transacción)
      setInterval(async () => {
        if (!this.mpIntegrationActive) return;
        
        try {
          const response = await fetch('/api/mercadopago/notifications');
          
          if (response.ok) {
            const notifications = await response.json();
            
            // Procesar notificaciones
            notifications.forEach(notification => {
              // Solo procesar notificaciones no vistas
              if (!notification.seen && notification.status === 'approved') {
                // Mostrar notificación
                this.showPaymentNotification(notification);
              }
            });
          }
        } catch (error) {
          console.error('Error al consultar notificaciones:', error);
        }
      }, 10000); // Consultar cada 10 segundos
    }
    
    showPaymentNotification(paymentData) {
      // Crear notificación emergente
      const notificationDiv = document.createElement('div');
      notificationDiv.className = 'notification success';
      notificationDiv.innerHTML = `
        <div class="notification-header">
          <strong>Pago Recibido</strong>
          <button class="notification-close">&times;</button>
        </div>
        <p>Se ha recibido un pago por $${paymentData.amount.toFixed(2)}</p>
        <p>Referencia: ${paymentData.reference}</p>
      `;
      
      // Agregar al DOM
      document.body.appendChild(notificationDiv);
      
      // Configurar evento para cerrar
      const closeButton = notificationDiv.querySelector('.notification-close');
      if (closeButton) {
        closeButton.addEventListener('click', () => {
          notificationDiv.remove();
        });
      }
      
      // Eliminar automáticamente después de 10 segundos
      setTimeout(() => {
        if (document.body.contains(notificationDiv)) {
          notificationDiv.remove();
        }
      }, 10000);
    }
    
    handlePaymentReceived(paymentData) {
      // Ejecutar callback con los datos del pago
      this.onPaymentReceived(paymentData);
      
      // Mostrar notificación
      this.showNotification(`Pago con ${this.getPaymentMethodName(paymentData.method)} registrado correctamente`, 'success');
    }
    
    getPaymentMethodName(methodId) {
      const method = this.paymentMethods.find(m => m.id === methodId);
      return method ? method.name : methodId;
    }
    
    showNotification(message, type = 'success') {
      // Crear el elemento de notificación
      const notification = document.createElement('div');
      notification.className = `notification ${type}`;
      notification.textContent = message;
      
      // Agregar al DOM
      document.body.appendChild(notification);
      
      // Eliminar después de 3 segundos
      setTimeout(() => {
        notification.remove();
      }, 3000);
    }
    
    /**
     * Obtiene el total actual de la factura
     * Este método debería ser implementado según la estructura de la aplicación
     */
    getCurrentTotal() {
      // En la implementación real, esto obtendría el total del facturador
      // Por ahora devolvemos un valor fijo para la simulación
      return 1000;
    }
    
    /**
     * Comprueba si el método de pago seleccionado requiere facturación ARCA
     * @returns {boolean} Verdadero si requiere ARCA, falso en caso contrario
     */
    requiresARCA() {
      return this.selectedMethod && this.selectedMethod.requiresARCA;
    }
    
    /**
     * Obtiene los datos del método de pago seleccionado
     * @returns {Object|null} Datos del método de pago o null si no hay método seleccionado
     */
    getPaymentData() {
      return this.selectedMethod;
    }
  }
  
  export default PaymentOptions;