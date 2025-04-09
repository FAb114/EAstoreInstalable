/**
 * Servicio de Productos para EAstore
 * Maneja la gestión del catálogo de productos usando SQLite
 */

const DatabaseService = require('../database/db');
const logger = require('../../utils/logger');
const syncService = require('./sync');

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

      // Verificar si ya existe un producto con el mismo código
      const productoExistente = await this.db.queryOne(
        'SELECT * FROM productos WHERE codigo = ?', 
        [productoData.codigo]
      );

      if (productoExistente) {
        throw new Error(`Ya existe un producto con el código ${productoData.codigo}`);
      }

      // Preparar datos para inserción
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

      // Insertar en la base de datos
      const resultado = this.db.insert('productos', nuevoProducto);
      
      logger.info(`Producto ${resultado.id} creado exitosamente`);

      // Registrar movimiento de stock inicial si es necesario
      if (productoData.stock && productoData.stock > 0) {
        await this.ajustarStock(resultado.id, productoData.stock, 'inicial');
      }

      // Marcar para sincronización si estamos offline
      if (await syncService.isOffline()) {
        await syncService.marcarParaSincronizacion('productos', resultado.id);
      }

      return { id: resultado.id, ...nuevoProducto };
    } catch (error) {
      logger.error('Error al crear producto:', error);
      throw new Error(`Error al crear producto: ${error.message}`);
    }
  }

  async actualizarProducto(productoId, productoData) {
    try {
      logger.info(`Actualizando producto ${productoId}`);

      // Verificar si el producto existe
      const producto = await this.db.get('productos', productoId);
      if (!producto) {
        throw new Error('Producto no encontrado');
      }

      // Verificar si el código ya existe en otro producto
      if (productoData.codigo && productoData.codigo !== producto.codigo) {
        const productoExistente = await this.db.queryOne(
          'SELECT * FROM productos WHERE codigo = ? AND id != ?', 
          [productoData.codigo, productoId]
        );

        if (productoExistente) {
          throw new Error(`Ya existe otro producto con el código ${productoData.codigo}`);
        }
      }

      const stockAnterior = producto.stock;

      // Preparar datos para actualización
      const datosActualizados = {
        codigo: productoData.codigo || producto.codigo,
        nombre: productoData.nombre || producto.nombre,
        descripcion: productoData.descripcion !== undefined ? productoData.descripcion : producto.descripcion,
        precio: productoData.precio !== undefined ? productoData.precio : producto.precio,
        costo: productoData.costo !== undefined ? productoData.costo : producto.costo,
        iva: productoData.impuestos !== undefined ? productoData.impuestos : producto.iva,
        categoria: productoData.categoria || producto.categoria,
        stock: productoData.stock !== undefined ? productoData.stock : producto.stock,
        stock_minimo: productoData.stockMinimo !== undefined ? productoData.stockMinimo : producto.stock_minimo,
        marca: productoData.proveedor !== undefined ? productoData.proveedor : producto.marca,
        activo: productoData.activo !== undefined ? (productoData.activo ? 1 : 0) : producto.activo,
        updated_at: new Date().toISOString()
      };

      // Actualizar en la base de datos
      this.db.update('productos', productoId, datosActualizados);
      
      logger.info(`Producto ${productoId} actualizado exitosamente`);

      // Registrar movimiento de stock si es necesario
      if (productoData.stock !== undefined && productoData.stock !== stockAnterior) {
        const diferencia = productoData.stock - stockAnterior;
        const motivo = diferencia > 0 ? 'ingreso_manual' : 'egreso_manual';
        await this.ajustarStock(productoId, Math.abs(diferencia), motivo);
      }

      // Marcar para sincronización si estamos offline
      if (await syncService.isOffline()) {
        await syncService.marcarParaSincronizacion('productos', productoId);
      }

      return { id: productoId, ...datosActualizados };
    } catch (error) {
      logger.error(`Error al actualizar producto ${productoId}:`, error);
      throw new Error(`Error al actualizar producto: ${error.message}`);
    }
  }

  async obtenerProductoPorId(productoId) {
    try {
      const producto = await this.db.get('productos', productoId);
      if (!producto) {
        throw new Error('Producto no encontrado');
      }
      return producto;
    } catch (error) {
      logger.error(`Error al obtener producto ${productoId}:`, error);
      throw new Error(`Error al obtener producto: ${error.message}`);
    }
  }

  async buscarProductoPorCodigo(codigo) {
    try {
      const producto = await this.db.queryOne(
        'SELECT * FROM productos WHERE codigo = ?', 
        [codigo]
      );
      return producto;
    } catch (error) {
      logger.error(`Error al buscar producto por código ${codigo}:`, error);
      throw new Error(`Error al buscar producto por código: ${error.message}`);
    }
  }

  async buscarProductos(filtros = {}) {
    try {
      // Construir la consulta SQL con filtros
      let query = 'SELECT * FROM productos WHERE 1=1';
      let params = [];

      if (filtros.activo !== undefined) {
        query += ' AND activo = ?';
        params.push(filtros.activo ? 1 : 0);
      }

      if (filtros.categoria) {
        query += ' AND categoria = ?';
        params.push(filtros.categoria);
      }

      if (filtros.nombre) {
        query += ' AND nombre LIKE ?';
        params.push(`%${filtros.nombre}%`);
      }

      if (filtros.codigo) {
        query += ' AND codigo LIKE ?';
        params.push(`%${filtros.codigo}%`);
      }

      query += ' ORDER BY nombre ASC';

      return await this.db.query(query, params);
    } catch (error) {
      logger.error('Error al buscar productos:', error);
      throw new Error(`Error al buscar productos: ${error.message}`);
    }
  }

  async eliminarProducto(productoId) {
    try {
      logger.info(`Eliminando producto ${productoId}`);

      const producto = await this.db.get('productos', productoId);
      if (!producto) {
        throw new Error('Producto no encontrado');
      }

      // En lugar de eliminar físicamente, desactivamos el producto
      await this.db.update('productos', productoId, { activo: 0, updated_at: new Date().toISOString() });

      if (await syncService.isOffline()) {
        await syncService.marcarParaSincronizacion('productos', productoId);
      }

      logger.info(`Producto ${productoId} desactivado exitosamente`);
      return true;
    } catch (error) {
      logger.error(`Error al eliminar producto ${productoId}:`, error);
      throw new Error(`Error al eliminar producto: ${error.message}`);
    }
  }

  async ajustarStock(productoId, cantidad, motivo) {
    try {
      logger.info(`Ajustando stock del producto ${productoId}`);

      // Obtener el producto
      const producto = await this.db.get('productos', productoId);
      if (!producto) {
        throw new Error('Producto no encontrado');
      }

      let nuevoStock = producto.stock;
      if (motivo === 'ingreso_manual' || motivo === 'inicial' || motivo === 'ajuste_positivo') {
        nuevoStock += cantidad;
      } else {
        nuevoStock -= cantidad;
        if (nuevoStock < 0) nuevoStock = 0;
      }

      // Actualizar el stock
      await this.db.update('productos', productoId, {
        stock: nuevoStock,
        updated_at: new Date().toISOString()
      });

      // Crear registro de movimiento de stock
      const movimiento = {
        producto_id: productoId,
        cantidad: cantidad,
        tipo: motivo.startsWith('ingreso') || motivo === 'inicial' || motivo === 'ajuste_positivo' ? 'entrada' : 'salida',
        motivo: motivo,
        stock_anterior: producto.stock,
        stock_nuevo: nuevoStock,
        fecha: new Date().toISOString(),
        usuario: 'sistema'
      };

      // Asumimos que existe una tabla de movimientos_stock
      // Si no existe, deberías crearla en db.js
      const movimientoResult = await this.db.insert('movimientos_stock', movimiento);

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

  async obtenerProductosStockBajo() {
    try {
      // Obtener productos con stock menor o igual a su stock mínimo
      const productos = await this.db.query(
        `SELECT * FROM productos 
         WHERE activo = 1 AND stock <= stock_minimo
         ORDER BY stock ASC`
      );

      return productos;
    } catch (error) {
      logger.error('Error al obtener productos con stock bajo:', error);
      throw new Error(`Error al obtener productos con stock bajo: ${error.message}`);
    }
  }

  async importarProductos(archivo) {
    try {
      logger.info('Iniciando importación de productos');

      const productosImportados = [];
      const errores = [];

      // Simulación de datos (en un caso real, leerías del archivo)
      const datos = [
        { nombre: 'Producto Importado 1', codigo: 'P001', precio: 100 },
        { nombre: 'Producto Importado 2', codigo: 'P002', precio: 200 }
      ];

      for (const dato of datos) {
        try {
          const producto = await this.crearProducto(dato);
          productosImportados.push(producto);
        } catch (error) {
          errores.push({
            linea: datos.indexOf(dato) + 1,
            error: error.message,
            datos: dato
          });
        }
      }

      logger.info(`Importación finalizada: ${productosImportados.length} productos importados, ${errores.length} errores`);

      return {
        success: errores.length === 0,
        importados: productosImportados.length,
        errores: errores
      };
    } catch (error) {
      logger.error('Error al importar productos:', error);
      throw new Error(`Error al importar productos: ${error.message}`);
    }
  }

  async exportarProductos(formato = 'csv', filtros = {}) {
    try {
      logger.info(`Exportando productos en formato ${formato}`);

      const productos = await this.buscarProductos(filtros);

      let datos;

      switch (formato.toLowerCase()) {
        case 'csv':
          // Generar encabezado CSV
          let csv = 'id,codigo,nombre,descripcion,precio,stock\n';
          
          // Agregar datos de productos
          productos.forEach(producto => {
            csv += `${producto.id},${producto.codigo},"${producto.nombre}","${producto.descripcion || ''}",${producto.precio},${producto.stock}\n`;
          });
          
          datos = Buffer.from(csv);
          break;

        case 'excel':
          // Simulación de Excel 
          datos = Buffer.from('Excel simulado');
          break;

        default:
          throw new Error(`Formato no soportado: ${formato}`);
      }

      logger.info(`Exportación finalizada: ${productos.length} productos exportados`);
      return datos;
    } catch (error) {
      logger.error(`Error al exportar productos en formato ${formato}:`, error);
      throw new Error(`Error al exportar productos: ${error.message}`);
    }
  }
}

module.exports = new ProductoService();