/**
 * Componente Selector de Productos
 * Permite buscar, seleccionar y añadir productos al facturador
 * Con funciones para filtrar por categorías, códigos y nombres
 */
class ProductoSelector {
  constructor() {
    this.productos = [];
    this.productosSeleccionados = [];
    this.categorias = [];
    this.sucursalActual = null;
    this.contenedorPrincipal = null;
    this.searchTimeout = null;
    this.elementosDOM = {};
  }

  /**
   * Inicializa el selector de productos
   * @param {string} containerId - ID del contenedor donde se montará el componente
   * @param {number} sucursalId - ID de la sucursal actual
   */
  async init(containerId, sucursalId) {
    this.sucursalActual = sucursalId;
    this.contenedorPrincipal = document.getElementById(containerId);
    
    if (!this.contenedorPrincipal) {
      console.error('No se encontró el contenedor para el selector de productos');
      return;
    }
    
    await this.cargarCategorias();
    await this.cargarProductos();
    this.renderizar();
    this.agregarEventListeners();
  }

  /**
   * Carga las categorías de productos desde la base de datos
   */
  async cargarCategorias() {
    try {
      const response = await window.api.invoke('obtener-categorias', this.sucursalActual);
      if (response.success) {
        this.categorias = response.data;
      } else {
        console.error('Error al cargar categorías:', response.error);
        this.mostrarNotificacion('Error al cargar categorías', 'error');
      }
    } catch (error) {
      console.error('Error al cargar categorías:', error);
      this.categorias = [];
    }
  }

  /**
   * Carga los productos desde la base de datos
   * @param {Object} filtros - Filtros para la búsqueda de productos
   */
  async cargarProductos(filtros = {}) {
    try {
      const params = {
        sucursalId: this.sucursalActual,
        ...filtros
      };
      
      const response = await window.api.invoke('obtener-productos', params);
      
      if (response.success) {
        this.productos = response.data;
        this.actualizarListaProductos();
      } else {
        console.error('Error al cargar productos:', response.error);
        this.mostrarNotificacion('Error al cargar productos', 'error');
      }
    } catch (error) {
      console.error('Error al cargar productos:', error);
      this.productos = [];
      this.actualizarListaProductos();
    }
  }

  /**
   * Renderiza el componente completo
   */
  renderizar() {
    this.contenedorPrincipal.innerHTML = `
      <div class="producto-selector">
        <div class="producto-selector__header">
          <h3>Selección de Productos</h3>
          <div class="producto-selector__search">
            <input type="text" id="producto-busqueda" placeholder="Buscar por código o nombre" class="form-control">
            <button id="btn-buscar-producto" class="btn btn-primary">
              <i class="fas fa-search"></i>
            </button>
          </div>
        </div>
        
        <div class="producto-selector__categorias">
          <select id="filtro-categoria" class="form-select">
            <option value="">Todas las categorías</option>
            ${this.categorias.map(cat => `<option value="${cat.id}">${cat.nombre}</option>`).join('')}
          </select>
        </div>
        
        <div class="producto-selector__disponibilidad">
          <label class="form-check-label">
            <input type="checkbox" id="solo-disponibles" class="form-check-input" checked>
            Mostrar solo productos con stock
          </label>
        </div>
        
        <div class="producto-selector__lista" id="lista-productos">
          <table class="table tabla-productos">
            <thead>
              <tr>
                <th>Código</th>
                <th>Producto</th>
                <th>Precio</th>
                <th>Stock</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody id="productos-tbody">
              <!-- Los productos se cargan dinámicamente aquí -->
            </tbody>
          </table>
        </div>
        
        <div class="producto-selector__seleccionados">
          <h4>Productos seleccionados</h4>
          <table class="table tabla-seleccionados">
            <thead>
              <tr>
                <th>Producto</th>
                <th>Cantidad</th>
                <th>Precio Unit.</th>
                <th>Subtotal</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody id="seleccionados-tbody">
              <!-- Los productos seleccionados se cargan dinámicamente aquí -->
            </tbody>
          </table>
          <div class="producto-selector__totales">
            <span>Total: </span>
            <span id="total-selector" class="total-selector">$0.00</span>
          </div>
          <div class="producto-selector__acciones">
            <button id="btn-agregar-seleccionados" class="btn btn-success">Agregar a factura</button>
            <button id="btn-limpiar-seleccion" class="btn btn-outline-danger">Limpiar selección</button>
          </div>
        </div>
      </div>
    `;
    
    // Guardar referencias a elementos DOM frecuentemente usados
    this.elementosDOM = {
      busquedaInput: document.getElementById('producto-busqueda'),
      filtroCategoria: document.getElementById('filtro-categoria'),
      soloDisponibles: document.getElementById('solo-disponibles'),
      productosTbody: document.getElementById('productos-tbody'),
      seleccionadosTbody: document.getElementById('seleccionados-tbody'),
      totalSelector: document.getElementById('total-selector'),
      btnAgregarSeleccionados: document.getElementById('btn-agregar-seleccionados'),
      btnLimpiarSeleccion: document.getElementById('btn-limpiar-seleccion')
    };
    
    this.actualizarListaProductos();
  }

  /**
   * Actualiza la lista de productos mostrados según los filtros aplicados
   */
  actualizarListaProductos() {
    if (!this.elementosDOM.productosTbody) return;
    
    const mostrarSoloDisponibles = this.elementosDOM.soloDisponibles && this.elementosDOM.soloDisponibles.checked;
    const productosFiltrados = mostrarSoloDisponibles 
      ? this.productos.filter(p => p.stock > 0)
      : this.productos;
    
    if (productosFiltrados.length === 0) {
      this.elementosDOM.productosTbody.innerHTML = `
        <tr>
          <td colspan="5" class="text-center">No se encontraron productos</td>
        </tr>
      `;
      return;
    }
    
    this.elementosDOM.productosTbody.innerHTML = productosFiltrados.map(producto => `
      <tr data-id="${producto.id}" class="${producto.stock <= 0 ? 'sin-stock' : ''}">
        <td>${producto.codigo}</td>
        <td>${producto.nombre}</td>
        <td>$${producto.precio.toFixed(2)}</td>
        <td>${producto.stock}</td>
        <td>
          <button class="btn btn-sm btn-primary btn-agregar-producto" 
            data-id="${producto.id}" 
            ${producto.stock <= 0 ? 'disabled' : ''}>
            <i class="fas fa-plus"></i>
          </button>
        </td>
      </tr>
    `).join('');
  }

  /**
   * Actualiza la lista de productos seleccionados
   */
  actualizarProductosSeleccionados() {
    if (!this.elementosDOM.seleccionadosTbody) return;
    
    if (this.productosSeleccionados.length === 0) {
      this.elementosDOM.seleccionadosTbody.innerHTML = `
        <tr>
          <td colspan="5" class="text-center">No hay productos seleccionados</td>
        </tr>
      `;
      this.elementosDOM.totalSelector.textContent = '$0.00';
      return;
    }
    
    let total = 0;
    
    this.elementosDOM.seleccionadosTbody.innerHTML = this.productosSeleccionados.map(item => {
      const subtotal = item.precio * item.cantidad;
      total += subtotal;
      
      return `
        <tr data-id="${item.id}">
          <td>${item.nombre}</td>
          <td>
            <div class="cantidad-control">
              <button class="btn btn-sm btn-outline-secondary btn-restar" data-id="${item.id}">-</button>
              <input type="number" class="form-control form-control-sm input-cantidad" 
                value="${item.cantidad}" min="1" max="${item.stockDisponible}" data-id="${item.id}">
              <button class="btn btn-sm btn-outline-secondary btn-sumar" data-id="${item.id}">+</button>
            </div>
          </td>
          <td>$${item.precio.toFixed(2)}</td>
          <td>$${subtotal.toFixed(2)}</td>
          <td>
            <button class="btn btn-sm btn-danger btn-quitar" data-id="${item.id}">
              <i class="fas fa-trash"></i>
            </button>
          </td>
        </tr>
      `;
    }).join('');
    
    this.elementosDOM.totalSelector.textContent = `$${total.toFixed(2)}`;
  }

  /**
   * Agrega los event listeners a los elementos del componente
   */
  agregarEventListeners() {
    // Búsqueda de productos
    this.elementosDOM.busquedaInput.addEventListener('input', (e) => {
      clearTimeout(this.searchTimeout);
      this.searchTimeout = setTimeout(() => {
        const busqueda = e.target.value.trim();
        this.cargarProductos({
          busqueda: busqueda,
          categoriaId: this.elementosDOM.filtroCategoria.value
        });
      }, 300);
    });
    
    // Filtro por categoría
    this.elementosDOM.filtroCategoria.addEventListener('change', (e) => {
      this.cargarProductos({
        busqueda: this.elementosDOM.busquedaInput.value.trim(),
        categoriaId: e.target.value
      });
    });
    
    // Filtro de disponibilidad
    this.elementosDOM.soloDisponibles.addEventListener('change', () => {
      this.actualizarListaProductos();
    });
    
    // Agregar producto a la selección
    this.contenedorPrincipal.addEventListener('click', (e) => {
      // Botón agregar producto
      if (e.target.closest('.btn-agregar-producto')) {
        const btn = e.target.closest('.btn-agregar-producto');
        const id = parseInt(btn.dataset.id);
        this.agregarProducto(id);
      }
      
      // Botón quitar producto
      if (e.target.closest('.btn-quitar')) {
        const btn = e.target.closest('.btn-quitar');
        const id = parseInt(btn.dataset.id);
        this.quitarProducto(id);
      }
      
      // Botón sumar cantidad
      if (e.target.closest('.btn-sumar')) {
        const btn = e.target.closest('.btn-sumar');
        const id = parseInt(btn.dataset.id);
        this.cambiarCantidad(id, 1);
      }
      
      // Botón restar cantidad
      if (e.target.closest('.btn-restar')) {
        const btn = e.target.closest('.btn-restar');
        const id = parseInt(btn.dataset.id);
        this.cambiarCantidad(id, -1);
      }
    });
    
    // Cambio manual de cantidad
    this.contenedorPrincipal.addEventListener('change', (e) => {
      if (e.target.classList.contains('input-cantidad')) {
        const id = parseInt(e.target.dataset.id);
        const nuevaCantidad = parseInt(e.target.value);
        this.actualizarCantidad(id, nuevaCantidad);
      }
    });
    
    // Botón agregar productos a factura
    this.elementosDOM.btnAgregarSeleccionados.addEventListener('click', () => {
      this.agregarProductosAFactura();
    });
    
    // Botón limpiar selección
    this.elementosDOM.btnLimpiarSeleccion.addEventListener('click', () => {
      this.limpiarSeleccion();
    });
  }

  /**
   * Agrega un producto a la selección
   * @param {number} id - ID del producto
   */
  agregarProducto(id) {
    const producto = this.productos.find(p => p.id === id);
    if (!producto || producto.stock <= 0) return;
    
    const existeEnSeleccion = this.productosSeleccionados.findIndex(p => p.id === id);
    
    if (existeEnSeleccion !== -1) {
      this.cambiarCantidad(id, 1);
    } else {
      this.productosSeleccionados.push({
        id: producto.id,
        codigo: producto.codigo,
        nombre: producto.nombre,
        precio: producto.precio,
        cantidad: 1,
        stockDisponible: producto.stock
      });
      
      this.actualizarProductosSeleccionados();
    }
  }

  /**
   * Quita un producto de la selección
   * @param {number} id - ID del producto
   */
  quitarProducto(id) {
    this.productosSeleccionados = this.productosSeleccionados.filter(p => p.id !== id);
    this.actualizarProductosSeleccionados();
  }

  /**
   * Cambia la cantidad de un producto seleccionado
   * @param {number} id - ID del producto
   * @param {number} cambio - Cantidad a sumar (positivo) o restar (negativo)
   */
  cambiarCantidad(id, cambio) {
    const indice = this.productosSeleccionados.findIndex(p => p.id === id);
    if (indice === -1) return;
    
    const producto = this.productosSeleccionados[indice];
    const nuevaCantidad = producto.cantidad + cambio;
    
    if (nuevaCantidad <= 0) {
      this.quitarProducto(id);
    } else if (nuevaCantidad <= producto.stockDisponible) {
      producto.cantidad = nuevaCantidad;
      this.actualizarProductosSeleccionados();
    } else {
      this.mostrarNotificacion(`No hay suficiente stock. Disponible: ${producto.stockDisponible}`, 'warning');
    }
  }

  /**
   * Actualiza la cantidad de un producto seleccionado
   * @param {number} id - ID del producto
   * @param {number} nuevaCantidad - Nueva cantidad del producto
   */
  actualizarCantidad(id, nuevaCantidad) {
    const indice = this.productosSeleccionados.findIndex(p => p.id === id);
    if (indice === -1) return;
  
    const producto = this.productosSeleccionados[indice];
  
    if (nuevaCantidad <= 0) {
      this.quitarProducto(id);
    } else if (nuevaCantidad <= producto.stockDisponible) {
      producto.cantidad = nuevaCantidad;
      this.actualizarProductosSeleccionados();
    } else {
      this.mostrarNotificacion(`No hay suficiente stock. Disponible: ${producto.stockDisponible}`, 'warning');
    }
  }

  /**
   * Agrega los productos seleccionados a la factura
   */
  agregarProductosAFactura() {
    if (this.productosSeleccionados.length === 0) {
      this.mostrarNotificacion('No hay productos seleccionados', 'warning');
      return;
    }
  
    const productos = this.productosSeleccionados.map(p => ({
      id: p.id,
      nombre: p.nombre,
      cantidad: p.cantidad,
      precio: p.precio
    }));
  
    // Emitir evento con los productos seleccionados
    const evento = new CustomEvent('productos-seleccionados', {
      detail: {
        productos: JSON.parse(JSON.stringify(this.productosSeleccionados))
      }
    });
    
    document.dispatchEvent(evento);
    
    // Opcional: limpiar la selección después de agregar a la factura
    this.limpiarSeleccion();
    
    this.mostrarNotificacion('Productos agregados a la factura', 'success');
  }

  /**
   * Limpia la selección de productos
   */
  limpiarSeleccion() {
    this.productosSeleccionados = [];
    this.actualizarProductosSeleccionados();
  }

  /**
   * Muestra una notificación usando el componente de notificaciones
   * @param {string} mensaje - Mensaje a mostrar
   * @param {string} tipo - Tipo de notificación (success, warning, error, info)
   */
  mostrarNotificacion(mensaje, tipo = 'info') {
    // Si existe el componente de notificaciones, lo usa
    if (window.notification) {
      window.notification.mostrar(mensaje, tipo);
    } else {
      // Fallback simple para notificaciones
      console.log(`Notificación (${tipo}): ${mensaje}`);
      
      const notificacion = document.createElement('div');
      notificacion.className = `notificacion notificacion--${tipo}`;
      notificacion.innerHTML = `
        <div class="notificacion__contenido">
          <p>${mensaje}</p>
        </div>
      `;
      
      document.body.appendChild(notificacion);
      
      setTimeout(() => {
        notificacion.classList.add('fadeout');
        setTimeout(() => {
          document.body.removeChild(notificacion);
        }, 300);
      }, 3000);
    }
  }
}

// Exportar el componente
window.ProductoSelector = ProductoSelector;