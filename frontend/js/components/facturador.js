// frontend/js/components/facturador.js

document.addEventListener('DOMContentLoaded', function() {
    // Referencias a elementos del DOM
    const formaPago = document.getElementById('formaPago');
    const emitirFacturaAfipBtn = document.getElementById('emitirFacturaAfip');
    const emitirFacturaBtn = document.getElementById('emitirFactura');
    const campoMercadoPago = document.getElementById('campo-mercadopago');
    const datosAdicionales = document.getElementById('datosAdicionales');
    const totalElement = document.getElementById('total');
    
    // Constantes
    const LIMITE_DATOS_ADICIONALES = 50000; // Monto límite para solicitar datos adicionales
    
    // Variables de estado
    let facturaActual = {
      items: [],
      total: 0,
      subtotal: 0,
      iva: 0,
      cliente: {},
      tipoFactura: '',
      formaPago: ''
    };
    
    // Inicializar fecha actual
    document.getElementById('fechaFactura').valueAsDate = new Date();
    
    // Escuchar cambios en forma de pago
    formaPago.addEventListener('change', function() {
      const valor = this.value;
      
      // Habilitar botón ARCA solo para métodos electrónicos
      if (valor === 'transferencia' || valor === 'tarjeta_debito' || 
          valor === 'tarjeta_credito' || valor === 'mercadopago_qr') {
        emitirFacturaAfipBtn.disabled = false;
      } else {
        emitirFacturaAfipBtn.disabled = true;
      }
      
      // Mostrar campo de espera para MercadoPago
      if (valor === 'mercadopago_qr' || valor === 'transferencia') {
        campoMercadoPago.style.display = 'block';
        // Iniciar escucha de pagos de MercadoPago
        iniciarEscuchaPagos();
      } else {
        campoMercadoPago.style.display = 'none';
      }
      
      facturaActual.formaPago = valor;
    });
    
    // Escuchar click en botón Agregar Producto
    document.getElementById('agregarProducto').addEventListener('click', function() {
      // Abrir modal de búsqueda de productos
      const productosModal = new bootstrap.Modal(document.getElementById('productosModal'));
      productosModal.show();
      
      // Cargar productos disponibles (aquí llamaríamos a una API real)
      cargarProductosDisponibles();
    });
    
    // Simular carga de productos
    function cargarProductosDisponibles() {
      const productosDisponibles = [
        { codigo: 'SMART001', nombre: 'Smart TV 55"', precio: 350000, stock: 15 },
        { codigo: 'CELULAR001', nombre: 'Smartphone Galaxy S22', precio: 280000, stock: 20 },
        { codigo: 'NOTEBOOK001', nombre: 'Notebook Lenovo 14"', precio: 450000, stock: 8 },
        { codigo: 'AURICULAR001', nombre: 'Auriculares Bluetooth', precio: 35000, stock: 30 }
      ];
      
      const listaProductos = document.getElementById('listaProductos');
      listaProductos.innerHTML = '';
      
      productosDisponibles.forEach(producto => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${producto.codigo}</td>
          <td>${producto.nombre}</td>
          <td>$${producto.precio.toLocaleString()}</td>
          <td>${producto.stock}</td>
          <td>
            <button class="btn btn-sm btn-primary agregar-producto-btn" 
                    data-codigo="${producto.codigo}" 
                    data-nombre="${producto.nombre}" 
                    data-precio="${producto.precio}">
              <i class="bi bi-plus"></i> Agregar
            </button>
          </td>
        `;
        listaProductos.appendChild(tr);
      });
      
      // Agregar evento a los botones de agregar
      document.querySelectorAll('.agregar-producto-btn').forEach(btn => {
        btn.addEventListener('click', function() {
          const codigo = this.dataset.codigo;
          const nombre = this.dataset.nombre;
          const precio = parseFloat(this.dataset.precio);
          
          agregarProductoAFactura(codigo, nombre, precio);
          
          // Cerrar modal
          bootstrap.Modal.getInstance(document.getElementById('productosModal')).hide();
        });
      });
    }
    
    // Función para agregar producto a la factura
    function agregarProductoAFactura(codigo, nombre, precio) {
      const productoExistente = facturaActual.items.find(item => item.codigo === codigo);
      
      if (productoExistente) {
        productoExistente.cantidad++;
        productoExistente.subtotal = productoExistente.cantidad * productoExistente.precio;
      } else {
        facturaActual.items.push({
          codigo: codigo,
          nombre: nombre,
          precio: precio,
          cantidad: 1,
          subtotal: precio
        });
      }
      
      actualizarTablaProductos();
      calcularTotales();
    }
    
    // Actualizar tabla de productos
    function actualizarTablaProductos() {
      const productosFactura = document.getElementById('productos-factura');
      productosFactura.innerHTML = '';
      
      facturaActual.items.forEach((item, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${item.codigo}</td>
          <td>${item.nombre}</td>
          <td>$${item.precio.toLocaleString()}</td>
          <td>
            <div class="input-group input-group-sm">
              <button class="btn btn-outline-secondary decrementar-btn" data-index="${index}">-</button>
              <input type="number" class="form-control text-center cantidad-input" value="${item.cantidad}" min="1" data-index="${index}">
              <button class="btn btn-outline-secondary incrementar-btn" data-index="${index}">+</button>
            </div>
          </td>
          <td>$${item.subtotal.toLocaleString()}</td>
          <td>
            <button class="btn btn-sm btn-danger eliminar-item-btn" data-index="${index}">
              <i class="bi bi-trash"></i>
            </button>
          </td>
        `;
        productosFactura.appendChild(tr);
      });
      
      // Agregar eventos a los botones de cantidad
      document.querySelectorAll('.decrementar-btn').forEach(btn => {
        btn.addEventListener('click', function() {
          const index = parseInt(this.dataset.index);
          if (facturaActual.items[index].cantidad > 1) {
            facturaActual.items[index].cantidad--;
            facturaActual.items[index].subtotal = facturaActual.items[index].cantidad * facturaActual.items[index].precio;
            actualizarTablaProductos();
            calcularTotales();
          }
        });
      });
      
      document.querySelectorAll('.incrementar-btn').forEach(btn => {
        btn.addEventListener('click', function() {
          const index = parseInt(this.dataset.index);
          facturaActual.items[index].cantidad++;
          facturaActual.items[index].subtotal = facturaActual.items[index].cantidad * facturaActual.items[index].precio;
          actualizarTablaProductos();
          calcularTotales();
        });
      });
      
      document.querySelectorAll('.cantidad-input').forEach(input => {
        input.addEventListener('change', function() {
          const index = parseInt(this.dataset.index);
          const cantidad = parseInt(this.value);
          if (cantidad >= 1) {
            facturaActual.items[index].cantidad = cantidad;
            facturaActual.items[index].subtotal = facturaActual.items[index].cantidad * facturaActual.items[index].precio;
            calcularTotales();
          } else {
            this.value = 1;
          }
        });
      });
      
      document.querySelectorAll('.eliminar-item-btn').forEach(btn => {
        btn.addEventListener('click', function() {
          const index = parseInt(this.dataset.index);
          facturaActual.items.splice(index, 1);
          actualizarTablaProductos();
          calcularTotales();
        });
      });
    }
    
    // Calcular totales
    function calcularTotales() {
      const subtotal = facturaActual.items.reduce((total, item) => total + item.subtotal, 0);
      const iva = subtotal * 0.21; // 21% de IVA
      const total = subtotal + iva;
      
      document.getElementById('subtotal').textContent = `$${subtotal.toLocaleString()}`;
      document.getElementById('iva').textContent = `$${iva.toLocaleString()}`;
      document.getElementById('total').textContent = `$${total.toLocaleString()}`;
      
      facturaActual.subtotal = subtotal;
      facturaActual.iva = iva;
      facturaActual.total = total;
      
      // Verificar si se necesitan datos adicionales del cliente
      if (total >= LIMITE_DATOS_ADICIONALES && datosAdicionales.style.display === 'none') {
        mostrarDatosAdicionales();
      }
    }
    
    // Mostrar campos adicionales del cliente
    function mostrarDatosAdicionales() {
      datosAdicionales.style.display = 'flex';
      
      // Mostrar modal de advertencia
      const modalHtml = `
        <div class="modal fade" id="datosAdicionalesModal" tabindex="-1">
          <div class="modal-dialog">
            <div class="modal-content">
              <div class="modal-header">
                <h5 class="modal-title">Información Adicional Requerida</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
              </div>
              <div class="modal-body">
                <div class="alert alert-warning">
                  <i class="bi bi-exclamation-triangle"></i>
                  <strong>Atención:</strong> El monto de la factura supera el límite establecido por ARCA.
                  Se requieren datos adicionales del cliente.
                </div>
              </div>
              <div class="modal-footer">
                <button type="button" class="btn btn-primary" data-bs-dismiss="modal">Entendido</button>
              </div>
            </div>
          </div>
        </div>
      `;
      
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = modalHtml;
      document.body.appendChild(tempDiv.firstElementChild);
      
      const modal = new bootstrap.Modal(document.getElementById('datosAdicionalesModal'));
      modal.show();
      
      // Eliminar el modal del DOM cuando se cierre
      document.getElementById('datosAdicionalesModal').addEventListener('hidden.bs.modal', function() {
        this.remove();
      });
    }
    
    // Iniciar escucha de pagos de MercadoPago
    function iniciarEscuchaPagos() {
      // En un caso real, esto se conectaría al webhook de MercadoPago
      // Aquí simulamos la recepción de un pago después de unos segundos
      setTimeout(() => {
        // Simular recepción de pago
        const pagoRecibido = {
          monto: facturaActual.total,
          tipo: facturaActual.formaPago === 'mercadopago_qr' ? 'QR MercadoPago' : 'Transferencia',
          estado: 'aprobado',
          fecha: new Date()
        };
        
        notificarPagoRecibido(pagoRecibido);
      }, 5000); // Simular demora de 5 segundos
    }
    
    // Notificar pago recibido
    function notificarPagoRecibido(pago) {
      // Actualizar campo de MercadoPago
      campoMercadoPago.innerHTML = `
        <div class="alert alert-success">
          <i class="bi bi-check-circle"></i> ¡Pago recibido correctamente! 
          Monto: $${pago.monto.toLocaleString()}
        </div>
      `;
      
      // Mostrar modal de notificación
      document.getElementById('montoPago').textContent = `$${pago.monto.toLocaleString()}`;
      const notificacionModal = new bootstrap.Modal(document.getElementById('notificacionPagoModal'));
      notificacionModal.show();
      
      // Reproducir sonido de notificación
      const audio = new Audio('assets/notification.mp3');
      audio.play();
    }
    
    // Acción de botón Guardar e Imprimir
    document.getElementById('emitirFactura').addEventListener('click', function() {
      // Validar formulario
      if (!validarFormulario()) {
        return;
      }
      
      // Simular guardado de factura
      const facturaGuardada = {
        ...facturaActual,
        id: generarIdFactura(),
        fecha: document.getElementById('fechaFactura').value,
        tipoFactura: document.getElementById('tipoFactura').value,
        cliente: {
          nombre: document.getElementById('nombreCliente').value,
          dni: document.getElementById('dniCliente')?.value || '',
          email: document.getElementById('emailCliente')?.value || '',
          telefono: document.getElementById('telefonoCliente')?.value || '',
          direccion: document.getElementById('direccionCliente')?.value || ''
        }
      };
      
      // Mostrar modal de opciones de impresión/envío
      const opcionesModal = new bootstrap.Modal(document.getElementById('opcionesFacturaModal'));
      opcionesModal.show();
      
      // Guardar factura en estado global para acceder desde los botones del modal
      window.facturaImpresion = facturaGuardada;
    });
    
    // Validar formulario antes de guardar
    function validarFormulario() {
      // Verificar que haya productos
      if (facturaActual.items.length === 0) {
        mostrarAlerta('Debe agregar al menos un producto a la factura', 'danger');
        return false;
      }
      
      // Verificar tipo de factura
      if (!document.getElementById('tipoFactura').value) {
        mostrarAlerta('Debe seleccionar un tipo de factura', 'danger');
        return false;
      }
      
      // Verificar nombre de cliente
      if (!document.getElementById('nombreCliente').value.trim()) {
        mostrarAlerta('Debe ingresar el nombre del cliente', 'danger');
        return false;
      }
      
      // Verificar forma de pago
      if (!document.getElementById('formaPago').value) {
        mostrarAlerta('Debe seleccionar una forma de pago', 'danger');
        return false;
      }
      
      // Verificar datos adicionales si son requeridos
      if (facturaActual.total >= LIMITE_DATOS_ADICIONALES) {
        if (!document.getElementById('dniCliente').value.trim()) {
          mostrarAlerta('Debe ingresar el DNI/CUIT del cliente', 'danger');
          return false;
        }
        
        if (!document.getElementById('emailCliente').value.trim()) {
          mostrarAlerta('Debe ingresar el email del cliente', 'danger');
          return false;
        }
      }
      
      return true;
    }
    
    // Mostrar alerta
    function mostrarAlerta(mensaje, tipo) {
      const alertaHtml = `
        <div class="alert alert-${tipo} alert-dismissible fade show mt-3" role="alert">
          ${mensaje}
          <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        </div>
      `;
      
      const alertaContainer = document.createElement('div');
      alertaContainer.innerHTML = alertaHtml;
      
      document.getElementById('formulario-factura').prepend(alertaContainer.firstElementChild);
      
      // Eliminar alerta después de 5 segundos
      setTimeout(() => {
        const alertas = document.querySelectorAll('.alert');
        alertas.forEach(alerta => {
          const bsAlerta = bootstrap.Alert.getInstance(alerta);
          if (bsAlerta) {
            bsAlerta.close();
          } else {
            alerta.remove();
          }
        });
      }, 5000);
    }
    
    // Generar ID único para factura
    function generarIdFactura() {
      const fecha = new Date();
      const año = fecha.getFullYear().toString().substr(-2);
      const mes = (fecha.getMonth() + 1).toString().padStart(2, '0');
      const dia = fecha.getDate().toString().padStart(2, '0');
      const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      
      return `F${año}${mes}${dia}-${random}`;
    }
    
    // Eventos para botones del modal de opciones de impresión
    document.getElementById('imprimirTicket').addEventListener('click', function() {
      imprimirFactura('ticket');
    });
    
    document.getElementById('imprimirFacturaA4').addEventListener('click', function() {
      imprimirFactura('a4');
    });
    
    document.getElementById('enviarWhatsapp').addEventListener('click', function() {
      enviarFacturaPorWhatsapp();
    });
    
    document.getElementById('enviarEmail').addEventListener('click', function() {
      enviarFacturaPorEmail();
    });
    
    // Función para imprimir factura
    function imprimirFactura(formato) {
      const factura = window.facturaImpresion;
      
      // En un caso real, esto llamaría a una API para generar e imprimir la factura
      // Aquí simulamos el proceso
      console.log(`Imprimiendo factura en formato ${formato}:`, factura);
      
      // Usar la API de Electron para imprimir
      window.api.imprimirFactura(factura, formato)
        .then(result => {
          mostrarAlerta('Factura impresa correctamente', 'success');
          reiniciarFactura();
        })
        .catch(error => {
          mostrarAlerta('Error al imprimir factura', 'danger');
        });
      
      // Cerrar modal
      bootstrap.Modal.getInstance(document.getElementById('opcionesFacturaModal')).hide();
    }
    
    // Función para enviar factura por WhatsApp
    function enviarFacturaPorWhatsapp() {
      const factura = window.facturaImpresion;
      
      // Solicitar número de teléfono si no está en los datos del cliente
      let telefono = factura.cliente.telefono;
      
      if (!telefono) {
        telefono = prompt('Ingrese el número de teléfono del cliente (con código de país, ej: 5491112345678):');
        
        if (!telefono) {
          mostrarAlerta('Operación cancelada', 'warning');
          return;
        }
      }
      
      // Usar la API de Electron para enviar por WhatsApp
      window.api.enviarWhatsapp(factura, telefono)
        .then(result => {
          mostrarAlerta('Factura enviada por WhatsApp correctamente', 'success');
          reiniciarFactura();
        })
        .catch(error => {
          mostrarAlerta('Error al enviar factura por WhatsApp', 'danger');
        });
      
      // Cerrar modal
      bootstrap.Modal.getInstance(document.getElementById('opcionesFacturaModal')).hide();
    }
    
    // Función para enviar factura por Email
    function enviarFacturaPorEmail() {
      const factura = window.facturaImpresion;
      
      // Solicitar email si no está en los datos del cliente
      let email = factura.cliente.email;
      
      if (!email) {
        email = prompt('Ingrese el email del cliente:');
        
        if (!email) {
          mostrarAlerta('Operación cancelada', 'warning');
          return;
        }
      }
      
      // Usar la API de Electron para enviar por Email
      window.api.enviarEmail(factura, email)
        .then(result => {
          mostrarAlerta('Factura enviada por Email correctamente', 'success');
          reiniciarFactura();
        })
        .catch(error => {
          mostrarAlerta('Error al enviar factura por Email', 'danger');
        });
      
      // Cerrar modal
      bootstrap.Modal.getInstance(document.getElementById('opcionesFacturaModal')).hide();
    }
    
    // Reiniciar factura después de guardar/imprimir
    function reiniciarFactura() {
      // Reiniciar objeto de factura
      facturaActual = {
        items: [],
        total: 0,
        subtotal: 0,
        iva: 0,
        cliente: {},
        tipoFactura: '',
        formaPago: ''
      };
      
      // Reiniciar formulario
      document.getElementById('factura-form').reset();
      document.getElementById('fechaFactura').valueAsDate = new Date();
      document.getElementById('productos-factura').innerHTML = '';
      document.getElementById('subtotal').textContent = '$0.00';
      document.getElementById('iva').textContent = '$0.00';
      document.getElementById('total').textContent = '$0.00';
      document.getElementById('datosAdicionales').style.display = 'none';
      document.getElementById('campo-mercadopago').style.display = 'none';
      document.getElementById('emitirFacturaAfip').disabled = true;
      
      // Generar nuevo número de factura
      document.getElementById('numeroFactura').value = generarNumeroFactura();
    }
    
    // Generar número de factura secuencial
    function generarNumeroFactura() {
      // En un caso real, esto vendría de la base de datos
      // Aquí simulamos un número secuencial
      const sucursal = '0001';
      const numero = Math.floor(Math.random() * 100000).toString().padStart(8, '0');
      
      return `${sucursal}-${numero}`;
    }
    
    // Botón para facturar con ARCA (AFIP)
    document.getElementById('emitirFacturaAfip').addEventListener('click', function() {
      // Validar formulario primero
      if (!validarFormulario()) {
        return;
      }
      
      // Preparar datos de factura
      const facturaData = {
        ...facturaActual,
        fecha: document.getElementById('fechaFactura').value,
        tipoFactura: document.getElementById('tipoFactura').value,
        numeroFactura: document.getElementById('numeroFactura').value,
        cliente: {
          nombre: document.getElementById('nombreCliente').value,
          dni: document.getElementById('dniCliente')?.value || '',
          email: document.getElementById('emailCliente')?.value || '',
          telefono: document.getElementById('telefonoCliente')?.value || '',
          direccion: document.getElementById('direccionCliente')?.value || ''
        }
      };
      
      // Mostrar indicador de carga
      this.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Procesando...';
      this.disabled = true;
      
      // Llamar a la API de AFIP a través de Electron
      window.api.emitirFacturaAfip(facturaData)
        .then(resultado => {
          // Restaurar botón
          this.innerHTML = '<img src="assets/afip-logo.png" alt="ARCA" height="20"> Facturar ARCA';
          this.disabled = false;
          
          if (resultado.success) {
            mostrarAlerta('Factura electrónica emitida correctamente', 'success');
            
            // Actualizar número de factura en el formulario
            document.getElementById('numeroFactura').value = resultado.numeroFactura;
            
            // Abrir modal de opciones de impresión/envío
            const opcionesModal = new bootstrap.Modal(document.getElementById('opcionesFacturaModal'));
            opcionesModal.show();
            
            // Guardar factura actualizada
            window.facturaImpresion = {
              ...facturaData,
              numeroFactura: resultado.numeroFactura,
              cae: resultado.cae,
              vencimientoCae: resultado.vencimientoCae
            };
          } else {
            mostrarAlerta(`Error al emitir factura electrónica: ${resultado.error}`, 'danger');
          }
        })
        .catch(error => {
          // Restaurar botón
          this.innerHTML = '<img src="assets/afip-logo.png" alt="ARCA" height="20"> Facturar ARCA';
          this.disabled = false;
          
          mostrarAlerta('Error al conectar con ARCA (AFIP)', 'danger');
        });
    });
    
    // Escuchar eventos de conexión
    window.api.onConnectionStatus((event, online) => {
      document.getElementById('online-status').classList.toggle('d-none', !online);
      document.getElementById('offline-status').classList.toggle('d-none', online);
      
      // Deshabilitar botón AFIP si está offline
      if (!online) {
        document.getElementById('emitirFacturaAfip').disabled = true;
      } else if (facturaActual.formaPago === 'transferencia' || 
                 facturaActual.formaPago === 'tarjeta_debito' || 
                 facturaActual.formaPago === 'tarjeta_credito' || 
                 facturaActual.formaPago === 'mercadopago_qr') {
        document.getElementById('emitirFacturaAfip').disabled = false;
      }
    });
    
    // Escuchar notificaciones de pago
    window.api.onPagoRecibido((event, pago) => {
      notificarPagoRecibido(pago);
    });
    
    // Inicializar
    document.getElementById('numeroFactura').value = generarNumeroFactura();
  });
  