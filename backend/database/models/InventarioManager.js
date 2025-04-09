
// backend/database/models/InventarioManager.js
const db = require('../db'); // Asegurate que este sea tu archivo de conexión better-sqlite3

class InventarioManager {
  constructor() {}

  getProductoPorId(id) {
    const stmt = db.prepare('SELECT * FROM productos WHERE id = ?');
    return stmt.get(id);
  }

  actualizarStock(id, nuevoStock) {
    const stmt = db.prepare('UPDATE productos SET stock = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?');
    stmt.run(nuevoStock, id);
  }

  registrarMovimientoStock(movimiento) {
    const stmt = db.prepare(`
      INSERT INTO movimientos_stock (producto, stockAnterior, stockNuevo, tipo, cantidad, motivo, notas, usuario, fecha, sucursal)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      movimiento.producto,
      movimiento.stockAnterior,
      movimiento.stockNuevo,
      movimiento.tipo,
      movimiento.cantidad,
      movimiento.motivo,
      movimiento.notas,
      movimiento.usuario,
      movimiento.fecha,
      movimiento.sucursal
    );
  }

  getCategoriasUnicas() {
    const stmt = db.prepare('SELECT DISTINCT categoria FROM productos');
    return stmt.all().map(row => row.categoria);
  }
}

module.exports = InventarioManager;
