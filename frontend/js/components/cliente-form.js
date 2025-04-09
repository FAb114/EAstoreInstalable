/**
 * EAstore - Componente de Formulario de Cliente
 * Maneja la recopilación de datos de clientes para facturación
 */

class ClienteForm {
    constructor(options = {}) {
      this.container = options.container || document.getElementById('cliente-form-container');
      this.onClienteSelect = options.onClienteSelect || (() => {});
      this.arcaLimit = options.arcaLimit || 15000; // Límite para solicitar datos adicionales según ARCA
      this.clientesCache = [];
      this.selectedCliente = null;
      
      this.init();
    }
    
    init() {
      this.render();
      this.setupEventListeners();
      this.loadClientes();
    }
    
    render() {
      if (!this.container) return;
      
      this.container.innerHTML = `
        <div class="card">
          <div class="form-group">
            <label for="cliente-search">Buscar Cliente:</label>
            <div class="search-container">
              <input type="text" id="cliente-search" placeholder="Nombre o CUIT/DNI del cliente" autocomplete="off">
              <div id="cliente-results" class="search-results"></div>
            </div>
          </div>
          
          <div class="cliente-details" id="cliente-details">
            <!-- Los detalles del cliente se mostrarán aquí -->
            <p class="text-medium">No hay cliente seleccionado</p>
          </div>
          
          <div class="form-actions">
            <button type="button" class="btn btn-outline" id="nuevo-cliente-btn">Nuevo Cliente</button>
          </div>
        </div>
        
        <!-- Modal para Nuevo Cliente o Datos Adicionales -->
        <div class="modal-overlay" id="cliente-modal" style="display: none;">
          <div class="modal">
            <div class="modal-header">
              <h3 class="modal-title" id="modal-title">Nuevo Cliente</h3>
              <button class="modal-close" id="modal-close">&times;</button>
            </div>
            <form id="cliente-form">
              <div class="form-row">
                <div class="form-col">
                  <div class="form-group">
                    <label for="nombre">Nombre/Razón Social *</label>
                    <input type="text" id="nombre" required>
                  </div>
                </div>
                <div class="form-col">
                  <div class="form-group">
                    <label for="tipo-documento">Tipo de Documento *</label>
                    <select id="tipo-documento">
                      <option value="DNI">DNI</option>
                      <option value="CUIT">CUIT</option>
                      <option value="CUIL">CUIL</option>
                      <option value="LE">Libreta de Enrolamiento</option>
                      <option value="LC">Libreta Cívica</option>
                    </select>
                  </div>
                </div>
              </div>
              
              <div class="form-row">
                <div class="form-col">
                  <div class="form-group">
                    <label for="numero-documento">Número de Documento *</label>
                    <input type="text" id="numero-documento" required>
                  </div>
                </div>
                <div class="form-col">
                  <div class="form-group">
                    <label for="tipo-cliente">Condición IVA *</label>
                    <select id="tipo-cliente">
                      <option value="CONSUMIDOR_FINAL">Consumidor Final</option>
                      <option value="RESPONSABLE_INSCRIPTO">Responsable Inscripto</option>
                      <option value="MONOTRIBUTO">Monotributista</option>
                      <option value="EXENTO">Exento</option>
                    </select>
                  </div>
                </div>
              </div>
              
              <div class="form-row">
                <div class="form-col">
                  <div class="form-group">
                    <label for="email">Email</label>
                    <input type="email" id="email">
                  </div>
                </div>
                <div class="form-col">
                  <div class="form-group">
                    <label for="telefono">Teléfono</label>
                    <input type="tel" id="telefono">
                  </div>
                </div>
              </div>
              
              <div class="form-group">
                <label for="direccion">Dirección</label>
                <input type="text" id="direccion">
              </div>
              
              <div class="form-actions">
                <button type="submit" class="btn btn-primary">Guardar</button>
                <button type="button" class="btn btn-outline" id="cancel-form">Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      `;
    }
    
    setupEventListeners() {
      const searchInput = document.getElementById('cliente-search');
      const resultsContainer = document.getElementById('cliente-results');
      const nuevoClienteBtn = document.getElementById('nuevo-cliente-btn');
      const clienteModal = document.getElementById('cliente-modal');
      const modalClose = document.getElementById('modal-close');
      const cancelForm = document.getElementById('cancel-form');
      const clienteForm = document.getElementById('cliente-form');
      
      // Búsqueda de clientes
      if (searchInput) {
        searchInput.addEventListener('input', (e) => {
          this.searchClientes(e.target.value);
        });
        
        // Ocultar resultados al hacer clic fuera
        document.addEventListener('click', (e) => {
          if (!searchInput.contains(e.target) && !resultsContainer.contains(e.target)) {
            resultsContainer.innerHTML = '';
          }
        });
      }
      
      // Nuevo cliente
      if (nuevoClienteBtn) {
        nuevoClienteBtn.addEventListener('click', () => {
          document.getElementById('modal-title').textContent = 'Nuevo Cliente';
          clienteForm.reset();
          clienteModal.style.display = 'flex';
        });
      }
      
      // Cerrar modal
      if (modalClose) {
        modalClose.addEventListener('click', () => {
          clienteModal.style.display = 'none';
        });
      }
      
      if (cancelForm) {
        cancelForm.addEventListener('click', () => {
          clienteModal.style.display = 'none';
        });
      }
      
      // Envío del formulario
      if (clienteForm) {
        clienteForm.addEventListener('submit', (e) => {
          e.preventDefault();
          this.saveCliente();
        });
      }
    }
    
    async loadClientes() {
      try {
        const response = await fetch('/api/clientes');
        if (response.ok) {
          this.clientesCache = await response.json();
        } else {
          console.error('Error al cargar clientes');
          
          // Modo offline: cargar desde localStorage
          const cachedClientes = localStorage.getItem('clientes-cache');
          if (cachedClientes) {
            this.clientesCache = JSON.parse(cachedClientes);
          }
        }
      } catch (error) {
        console.error('Error al cargar clientes:', error);
        
        // Modo offline: cargar desde localStorage
        const cachedClientes = localStorage.getItem('clientes-cache');
        if (cachedClientes) {
          this.clientesCache = JSON.parse(cachedClientes);
        }
      }
    }
    
    searchClientes(query) {
      if (!query || query.length < 2) {
        document.getElementById('cliente-results').innerHTML = '';
        return;
      }
      
      query = query.toLowerCase();
      const results = this.clientesCache.filter(cliente => 
        cliente.nombre.toLowerCase().includes(query) || 
        cliente.numeroDocumento?.toLowerCase().includes(query)
      ).slice(0, 5); // Limitar a 5 resultados
      
      this.renderSearchResults(results);
    }
    
    renderSearchResults(results) {
      const resultsContainer = document.getElementById('cliente-results');
      
      if (results.length === 0) {
        resultsContainer.innerHTML = '<div class="search-item">No se encontraron clientes</div>';
        return;
      }
      
      resultsContainer.innerHTML = results.map(cliente => `
        <div class="search-item" data-id="${cliente.id}">
          <strong>${cliente.nombre}</strong>
          ${cliente.numeroDocumento ? `<span>${cliente.tipoDocumento}: ${cliente.numeroDocumento}</span>` : ''}
        </div>
      `).join('');
      
      // Agregar eventos click a los resultados
      document.querySelectorAll('.search-item').forEach(item => {
        item.addEventListener('click', () => {
          const clienteId = item.getAttribute('data-id');
          const cliente = this.clientesCache.find(c => c.id == clienteId);
          if (cliente) {
            this.selectCliente(cliente);
            document.getElementById('cliente-results').innerHTML = '';
            document.getElementById('cliente-search').value = cliente.nombre;
          }
        });
      });
    }
    
    selectCliente(cliente) {
      this.selectedCliente = cliente;
      
      const detailsContainer = document.getElementById('cliente-details');
      if (!detailsContainer) return;
      
      detailsContainer.innerHTML = `
        <div class="cliente-info">
          <h3>${cliente.nombre}</h3>
          ${cliente.tipoDocumento && cliente.numeroDocumento ? 
            `<p><strong>${cliente.tipoDocumento}:</strong> ${cliente.numeroDocumento}</p>` : ''}
          ${cliente.tipoCliente ? `<p><strong>Condición IVA:</strong> ${this.formatCondicionIva(cliente.tipoCliente)}</p>` : ''}
          ${cliente.email ? `<p><strong>Email:</strong> ${cliente.email}</p>` : ''}
          ${cliente.telefono ? `<p><strong>Teléfono:</strong> ${cliente.telefono}</p>` : ''}
        </div>
      `;
      
      // Notificar selección
      this.onClienteSelect(cliente);
    }
    
    formatCondicionIva(tipo) {
      const formatos = {
        'CONSUMIDOR_FINAL': 'Consumidor Final',
        'RESPONSABLE_INSCRIPTO': 'Responsable Inscripto',
        'MONOTRIBUTO': 'Monotributista',
        'EXENTO': 'Exento'
      };
      
      return formatos[tipo] || tipo;
    }
    
    async saveCliente() {
      const cliente = {
        nombre: document.getElementById('nombre').value,
        tipoDocumento: document.getElementById('tipo-documento').value,
        numeroDocumento: document.getElementById('numero-documento').value,
        tipoCliente: document.getElementById('tipo-cliente').value,
        email: document.getElementById('email').value,
        telefono: document.getElementById('telefono').value,
        direccion: document.getElementById('direccion').value
      };
      
      try {
        // Intentar guardar en el servidor
        const response = await fetch('/api/clientes', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(cliente)
        });
        
        if (response.ok) {
          const savedCliente = await response.json();
          
          // Actualizar la caché y localStorage
          this.clientesCache.push(savedCliente);
          localStorage.setItem('clientes-cache', JSON.stringify(this.clientesCache));
          
          // Seleccionar el cliente recién creado
          this.selectCliente(savedCliente);
          
          // Cerrar modal
          document.getElementById('cliente-modal').style.display = 'none';
          document.getElementById('cliente-search').value = savedCliente.nombre;
          
          // Mostrar notificación
          this.showNotification('Cliente guardado correctamente', 'success');
        } else {
          // Error en el servidor, intentar guardar localmente
          console.error('Error al guardar el cliente en el servidor');
          this.saveClienteOffline(cliente);
        }
      } catch (error) {
        console.error('Error al guardar cliente:', error);
        this.saveClienteOffline(cliente);
      }
    }
    
    saveClienteOffline(cliente) {
      // Generar ID temporal
      cliente.id = 'temp_' + Date.now();
      cliente.pendienteSincronizacion = true;
      
      // Agregar a la caché
      this.clientesCache.push(cliente);
      
      // Guardar en localStorage
      localStorage.setItem('clientes-cache', JSON.stringify(this.clientesCache));
      
      // Seleccionar el cliente
      this.selectCliente(cliente);
      
      // Cerrar modal
      document.getElementById('cliente-modal').style.display = 'none';
      document.getElementById('cliente-search').value = cliente.nombre;
      
      // Mostrar notificación
      this.showNotification('Cliente guardado en modo offline', 'warning');
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
     * Verifica si se necesitan datos adicionales según el monto de la factura
     * @param {number} monto - Monto total de la factura
     */
    verificarDatosRequeridos(monto) {
      if (!this.selectedCliente || monto > this.arcaLimit) {
        // Si no hay cliente seleccionado o el monto supera el límite, se requieren datos adicionales
        if (!this.selectedCliente) {
          // No hay cliente, solicitar datos básicos
          document.getElementById('modal-title').textContent = 'Datos del Cliente';
          document.getElementById('cliente-form').reset();
        } else {
          // Hay cliente pero se requieren datos adicionales
          document.getElementById('modal-title').textContent = 'Datos Adicionales Requeridos';
          
          // Pre-completar el formulario con los datos existentes
          document.getElementById('nombre').value = this.selectedCliente.nombre || '';
          document.getElementById('tipo-documento').value = this.selectedCliente.tipoDocumento || 'DNI';
          document.getElementById('numero-documento').value = this.selectedCliente.numeroDocumento || '';
          document.getElementById('tipo-cliente').value = this.selectedCliente.tipoCliente || 'CONSUMIDOR_FINAL';
          document.getElementById('email').value = this.selectedCliente.email || '';
          document.getElementById('telefono').value = this.selectedCliente.telefono || '';
          document.getElementById('direccion').value = this.selectedCliente.direccion || '';
        }
        
        // Mostrar el modal
        document.getElementById('cliente-modal').style.display = 'flex';
        return false;
      }
      
      return true;
    }
    
    /**
     * Obtiene los datos del cliente seleccionado
     * @returns {Object|null} Datos del cliente o null si no hay cliente seleccionado
     */
    getClienteData() {
      return this.selectedCliente;
    }
  }
  
  export default ClienteForm;