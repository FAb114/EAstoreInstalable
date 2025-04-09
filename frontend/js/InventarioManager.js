// frontend/utils/InventarioManager.js

class InventarioManager {
  constructor(productoService) {
    this.productoService = productoService;
  }

  async ajustarStock(productoId, cantidad, tipo, motivo = 'Ajuste manual') {
    try {
      const producto = await this.productoService.obtener(productoId);
      if (!producto) {
        throw new Error('Producto no encontrado');
      }

      const stockAnterior = producto.stock || 0;
      let stockNuevo;

      if (tipo === 'incremento') {
        stockNuevo = stockAnterior + cantidad;
      } else if (tipo === 'reduccion') {
        stockNuevo = Math.max(0, stockAnterior - cantidad);
      } else {
        throw new Error('Tipo de ajuste inválido');
      }

      await this.productoService.actualizar(productoId, {
        stock: stockNuevo
      });

      // ✅ Registrar el movimiento de stock si la API lo permite
      if (window.eastoreAPI?.guardarMovimientoStock) {
        window.eastoreAPI.guardarMovimientoStock({
          productId: productoId,
          oldStock: stockAnterior,
          newStock: stockNuevo,
          type: tipo,
          amount: cantidad,
          reason: motivo,
          notes: ''
        });
      }

      return {
        productoId,
        tipo,
        cantidad,
        motivo,
        stockAnterior,
        stockNuevo
      };
    } catch (error) {
      console.error('Error al ajustar el stock:', error.message);
      throw error;
    }
  }

  async verDetallesProducto(productoId) {
    return await this.productoService.obtener(productoId);
  }

  async exportarInventarioAExcel() {
    const productos = await this.productoService.listar({});
    // Implementar lógica de exportación según tu preferencia
    console.log('Exportando inventario...', productos);
  }

  async mostrarNotificacion(mensaje, tipo = 'info') {
    if (window.eastoreAPI?.on) {
      window.eastoreAPI.on('notificacion', { mensaje, tipo });
    } else {
      console.log(`[${tipo.toUpperCase()}] ${mensaje}`);
    }
  }
}

export default InventarioManager;
