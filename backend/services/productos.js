const DatabaseService = require('../database/db');
const logger = require('../../utils/logger');
const { syncService } = require('./sync');


class ProductoService {
  constructor() {
    this.db = new DatabaseService();
  }

  async crearProducto(productoData) {
    try {
      logger.info('Creando nuevo producto');

      if (!productoData.nombre || !productoData.codigo || !productoData.precio) {
        throw new Error('Nombre, código y precio son campos obligatorios');
      }

      const productoExistente = this.db.queryOne(
        'SELECT * FROM productos WHERE codigo = ?',
        [productoData.codigo]
      );

      if (productoExistente) {
        throw new Error(`Ya existe un producto con el código ${productoData.codigo}`);
      }

      const nuevoProducto = {
        codigo: productoData.codigo,
        nombre: productoData.nombre,
        descripcion: productoData.descripcion || null,
        precio: productoData.precio,
        costo: productoData.costo || 0,
        iva: productoData.impuestos || 21,
        categoria: productoData.categoria || 'general',
        stock: productoData.stock || 0,
        stock_minimo: productoData.stockMinimo || 5,
        marca: productoData.proveedor || null,
        activo: productoData.activo !== undefined ? (productoData.activo ? 1 : 0) : 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const resultado = this.db.insert('productos', nuevoProducto);
      logger.info(`Producto ${resultado.id} creado exitosamente`);

      if (productoData.stock && productoData.stock > 0) {
        await this.ajustarStock(resultado.id, productoData.stock, 'inicial');
      }

      if (await syncService.isOffline()) {
        await syncService.marcarParaSincronizacion('productos', resultado.id);
      }

      return { id: resultado.id, ...nuevoProducto };
    } catch (error) {
      logger.error('Error al crear producto:', error);
      throw new Error(`Error al crear producto: ${error.message}`);
    }
  }

  async ajustarStock(productoId, cantidad, motivo) {
    try {
      logger.info(`Ajustando stock del producto ${productoId}`);

      const producto = this.db.queryOne(
        'SELECT * FROM productos WHERE id = ?',
        [productoId]
      );
      if (!producto) throw new Error('Producto no encontrado');

      if (typeof producto.stock !== 'number') {
        throw new Error('Stock actual del producto es inválido');
      }

      const cantidadNumerica = Number(cantidad);
      if (isNaN(cantidadNumerica)) {
        throw new Error('Cantidad inválida para ajustar stock');
      }

      let nuevoStock = producto.stock;
      const tipoMovimiento = (typeof motivo === 'string' && 
        (motivo.startsWith('ingreso') || motivo === 'inicial' || motivo === 'ajuste_positivo'))
        ? 'entrada'
        : 'salida';

      if (tipoMovimiento === 'entrada') {
        nuevoStock += cantidadNumerica;
      } else {
        nuevoStock -= cantidadNumerica;
        if (nuevoStock < 0) nuevoStock = 0;
      }

      this.db.update('productos', {
        stock: nuevoStock,
        updated_at: new Date().toISOString()
      }, { id: productoId });

      const movimiento = {
        producto_id: productoId,
        cantidad: cantidadNumerica,
        tipo: tipoMovimiento,
        motivo: motivo || 'ajuste',
        stock_anterior: producto.stock,
        stock_nuevo: nuevoStock,
        fecha: new Date().toISOString(),
        usuario: 'sistema',
        sincronizado: 0
      };

      const movimientoResult = this.db.insert('movimientos_stock', movimiento);

      if (await syncService.isOffline()) {
        await syncService.marcarParaSincronizacion('movimientos_stock', movimientoResult.id);
      }

      return {
        productoId,
        stockAnterior: producto.stock,
        stockNuevo: nuevoStock,
        movimientoId: movimientoResult.id
      };
    } catch (error) {
      logger.error(`Error al ajustar stock del producto ${productoId}:`, error);
      throw new Error(`Error al ajustar stock: ${error.message}`);
    }
  }
}

module.exports = new ProductoService();
