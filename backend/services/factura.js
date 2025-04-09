/**
 * Servicio de Facturación para EAstore
 * Maneja toda la lógica de negocio relacionada con la creación, 
 * procesamiento y almacenamiento de facturas
 */

const db = require('../database/db');
const Factura = require('../database/models/factura');
const Cliente = require('../database/models/clientes');
const InventarioManager = require('../database/models/InventarioManager');
const afipService = require('../api/afip');
const emailService = require('./email');
const whatsappService = require('../api/whatsapp');
const syncService = require('./sync');
const logger = require('../../utils/logger');
const mercadoPagoService = require('../api/mercadopago');

class FacturaService {
  /**
   * Crea una nueva factura
   * @param {Object} datosFactura - Datos de la factura a crear
   * @returns {Promise<Object>} - Factura creada
   */
  async crearFactura(datosFactura) {
    try {
      logger.info('Iniciando creación de factura');
      
      // Validar datos del cliente
      const clienteData = await this.validarCliente(datosFactura.cliente);
      
      // Validar productos y actualizar inventario
      const productosValidados = await this.validarProductos(datosFactura.productos);
      
      // Calcular totales
      const totales = this.calcularTotales(productosValidados);
      
      // Crear objeto de factura
      const nuevaFactura = {
        numero: await this.generarNumeroFactura(datosFactura.tipoFactura),
        fecha: new Date(),
        cliente: clienteData,
        productos: productosValidados,
        subtotal: totales.subtotal,
        impuestos: totales.impuestos,
        total: totales.total,
        metodoPago: datosFactura.metodoPago,
        tipoFactura: datosFactura.tipoFactura,
        estado: 'pendiente',
        sucursal: datosFactura.sucursal,
        usuario: datosFactura.usuario
      };
      
      // Guardar en base de datos
      const facturaGuardada = await Factura.create(nuevaFactura);
      logger.info(`Factura #${facturaGuardada.numero} creada exitosamente`);
      
      // Marcar para sincronización si estamos offline
      if (!navigator.onLine) {
        await syncService.marcarParaSincronizacion('facturas', facturaGuardada.id);
      }
      
      return facturaGuardada;
    } catch (error) {
      logger.error('Error al crear factura:', error);
      throw new Error(`Error al crear factura: ${error.message}`);
    }
  }
  
  /**
   * Genera un número único de factura según el tipo
   * @param {String} tipoFactura - Tipo de factura (A, B, C)
   * @returns {Promise<String>} - Número de factura generado
   */
  async generarNumeroFactura(tipoFactura) {
    try {
      const ultimaFactura = await Factura.findOne({
        where: { tipoFactura },
        order: [['createdAt', 'DESC']]
      });
      
      const puntoVenta = '0001';
      const ultimoNumero = ultimaFactura ? parseInt(ultimaFactura.numero.split('-')[1]) : 0;
      const nuevoNumero = (ultimoNumero + 1).toString().padStart(8, '0');
      
      return `${puntoVenta}-${nuevoNumero}`;
    } catch (error) {
      logger.error('Error generando número de factura:', error);
      throw new Error('No se pudo generar el número de factura');
    }
  }
  
  /**
   * Valida y actualiza datos del cliente
   * @param {Object} clienteData - Datos del cliente
   * @returns {Promise<Object>} - Cliente validado
   */
  async validarCliente(clienteData) {
    // Si solo tenemos el nombre del cliente y el monto requiere datos completos
    if (clienteData.requiereDatosCompletos && !clienteData.documento) {
      throw new Error('Se requieren datos completos del cliente para esta factura');
    }
    
    // Buscar si el cliente ya existe
    let cliente = null;
    if (clienteData.id) {
      cliente = await Cliente.findByPk(clienteData.id);
    } else if (clienteData.documento) {
      cliente = await Cliente.findOne({ where: { documento: clienteData.documento } });
    }
    
    // Si no existe y tenemos suficientes datos, lo creamos
    if (!cliente && clienteData.nombre) {
      if (clienteData.requiereDatosCompletos && (!clienteData.documento || !clienteData.email)) {
        throw new Error('Faltan datos obligatorios del cliente');
      }
      
      cliente = await Cliente.create({
        nombre: clienteData.nombre,
        documento: clienteData.documento || null,
        email: clienteData.email || null,
        telefono: clienteData.telefono || null,
        direccion: clienteData.direccion || null
      });
    }
    
    if (!cliente) {
      throw new Error('No se pudo validar el cliente');
    }
    
    return cliente;
  }
  
  /**
   * Valida productos y actualiza inventario
   * @param {Array} productos - Lista de productos a facturar
   * @returns {Promise<Array>} - Productos validados
   */
  async validarProductos(productos) {
    if (!productos || productos.length === 0) {
      throw new Error('La factura debe contener al menos un producto');
    }
    
    const productosValidados = [];
    const inventarioManager = new InventarioManager();
    
    for (const item of productos) {
      // Verificar stock
      await inventarioManager.verificarStock(item.productoId, item.cantidad);
      
      // Reservar producto del inventario
      await inventarioManager.reservarProducto(item.productoId, item.cantidad);
      
      // Agregar a la lista de productos validados
      productosValidados.push({
        productoId: item.productoId,
        cantidad: item.cantidad,
        precioUnitario: item.precioUnitario,
        subtotal: item.precioUnitario * item.cantidad
      });
    }
    
    return productosValidados;
  }
  
  /**
   * Calcula los totales de la factura
   * @param {Array} productos - Lista de productos
   * @returns {Object} - Objeto con subtotal, impuestos y total
   */
  calcularTotales(productos) {
    const subtotal = productos.reduce((acc, item) => acc + item.subtotal, 0);
    const tasaImpuesto = 0.21; // 21% IVA
    const impuestos = subtotal * tasaImpuesto;
    const total = subtotal + impuestos;
    
    return {
      subtotal: parseFloat(subtotal.toFixed(2)),
      impuestos: parseFloat(impuestos.toFixed(2)),
      total: parseFloat(total.toFixed(2))
    };
  }
  
  /**
   * Finaliza una factura, integrando con AFIP si es necesario
   * @param {Number} facturaId - ID de la factura a finalizar
   * @param {Boolean} facturarAFIP - Si debe integrarse con AFIP
   * @returns {Promise<Object>} - Factura finalizada
   */
  async finalizarFactura(facturaId, facturarAFIP = false) {
    try {
      const factura = await Factura.findByPk(facturaId);
      
      if (!factura) {
        throw new Error('Factura no encontrada');
      }
      
      if (factura.estado === 'finalizada') {
        throw new Error('La factura ya está finalizada');
      }
      
      // Integramos con AFIP/ARCA si es necesario
      if (facturarAFIP && this.requiereAfip(factura.metodoPago)) {
        const resultadoAfip = await afipService.generarFacturaElectronica({
          tipoComprobante: factura.tipoFactura,
          puntoVenta: factura.numero.split('-')[0],
          numeroComprobante: factura.numero.split('-')[1],
          fechaComprobante: factura.fecha,
          importeTotal: factura.total,
          cliente: factura.cliente
        });
        
        factura.cae = resultadoAfip.cae;
        factura.fechaVencimientoCAE = resultadoAfip.fechaVencimiento;
      }
      
      // Actualizar estado
      factura.estado = 'finalizada';
      await factura.save();
      
      return factura;
    } catch (error) {
      logger.error('Error al finalizar factura:', error);
      throw new Error(`Error al finalizar factura: ${error.message}`);
    }
  }
  
  /**
   * Determina si el método de pago requiere integración con AFIP
   * @param {String} metodoPago - Método de pago
   * @returns {Boolean} - True si requiere AFIP
   */
  requiereAfip(metodoPago) {
    const metodosConAfip = ['transferencia', 'tarjeta_debito', 'tarjeta_credito', 'qr'];
    return metodosConAfip.includes(metodoPago);
  }
  
  /**
   * Imprime o envía la factura según el medio especificado
   * @param {Number} facturaId - ID de la factura
   * @param {String} medio - Medio de salida (ticket, factura, whatsapp, email)
   * @param {Object} opciones - Opciones adicionales según el medio
   * @returns {Promise<Object>} - Resultado de la operación
   */
  async distribuirFactura(facturaId, medio, opciones = {}) {
    try {
      const factura = await Factura.findByPk(facturaId, {
        include: ['cliente', 'productos']
      });
      
      if (!factura) {
        throw new Error('Factura no encontrada');
      }
      
      switch (medio) {
        case 'ticket':
          return this.imprimirTicket(factura, opciones);
        
        case 'factura':
          return this.imprimirFacturaA4(factura, opciones);
        
        case 'whatsapp':
          if (!factura.cliente.telefono) {
            throw new Error('El cliente no tiene número de teléfono registrado');
          }
          return await whatsappService.enviarFactura(factura, factura.cliente.telefono);
        
        case 'email':
          if (!factura.cliente.email) {
            throw new Error('El cliente no tiene email registrado');
          }
          return await emailService.enviarFactura(factura, factura.cliente.email);
        
        default:
          throw new Error(`Medio no soportado: ${medio}`);
      }
    } catch (error) {
      logger.error(`Error al distribuir factura por ${medio}:`, error);
      throw new Error(`Error al distribuir factura: ${error.message}`);
    }
  }
  
  /**
   * Genera e imprime un ticket de venta en formato 58mm
   * @param {Object} factura - Factura a imprimir
   * @param {Object} opciones - Opciones de impresión
   * @returns {Promise<Object>} - Resultado de la impresión
   */
  async imprimirTicket(factura, opciones) {
    try {
      // Lógica de generación e impresión de ticket
      logger.info(`Imprimiendo ticket para factura #${factura.numero}`);
      
      // Aquí iría la integración con la impresora térmica
      // Esta es una implementación básica que puede reemplazarse con la biblioteca
      // específica para tu impresora
      
      return { success: true, message: 'Ticket impreso correctamente' };
    } catch (error) {
      logger.error('Error al imprimir ticket:', error);
      throw new Error(`Error al imprimir ticket: ${error.message}`);
    }
  }
  
  /**
   * Genera e imprime una factura en formato A4
   * @param {Object} factura - Factura a imprimir
   * @param {Object} opciones - Opciones de impresión
   * @returns {Promise<Object>} - Resultado de la impresión
   */
  async imprimirFacturaA4(factura, opciones) {
    try {
      // Lógica de generación e impresión de factura A4
      logger.info(`Imprimiendo factura A4 #${factura.numero}`);
      
      // Aquí iría la integración con la impresora de sistema
      
      return { success: true, message: 'Factura A4 impresa correctamente' };
    } catch (error) {
      logger.error('Error al imprimir factura A4:', error);
      throw new Error(`Error al imprimir factura A4: ${error.message}`);
    }
  }
  
  /**
   * Verifica si hay pagos pendientes de procesar en MercadoPago
   * @returns {Promise<Array>} - Lista de pagos recibidos
   */
  async verificarPagosMercadoPago() {
    try {
      const pagosRecibidos = await mercadoPagoService.obtenerPagosRecientes();
      
      // Procesar cada pago recibido
      for (const pago of pagosRecibidos) {
        await this.procesarPagoRecibido(pago);
      }
      
      return pagosRecibidos;
    } catch (error) {
      logger.error('Error al verificar pagos de MercadoPago:', error);
      throw new Error('Error al verificar pagos de MercadoPago');
    }
  }
  
  /**
   * Procesa un pago recibido
   * @param {Object} pago - Datos del pago recibido
   * @returns {Promise<Object>} - Resultado del procesamiento
   */
  async procesarPagoRecibido(pago) {
    try {
      // Buscar factura asociada al pago
      const factura = await Factura.findOne({
        where: { referenciaPago: pago.referencia }
      });
      
      if (!factura) {
        logger.warn(`Pago recibido sin factura asociada: ${pago.id}`);
        return { success: false, message: 'No se encontró factura asociada al pago' };
      }
      
      // Actualizar estado de la factura
      factura.estadoPago = 'pagado';
      factura.fechaPago = new Date();
      await factura.save();
      
      logger.info(`Pago procesado exitosamente para factura #${factura.numero}`);
      return { success: true, message: 'Pago procesado correctamente', factura };
    } catch (error) {
      logger.error('Error al procesar pago:', error);
      throw new Error(`Error al procesar pago: ${error.message}`);
    }
  }
  
  /**
   * Busca facturas según criterios
   * @param {Object} filtros - Criterios de búsqueda
   * @returns {Promise<Array>} - Facturas encontradas
   */
  async buscarFacturas(filtros = {}) {
    try {
      return await Factura.findAll({
        where: filtros,
        include: ['cliente', 'productos'],
        order: [['fecha', 'DESC']]
      });
    } catch (error) {
      logger.error('Error al buscar facturas:', error);
      throw new Error('Error al buscar facturas');
    }
  }
}

module.exports = new FacturaService();