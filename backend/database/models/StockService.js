const db = require('../db');

function ajustarStock(id, cantidad, tipo) {
  const producto = db.prepare('SELECT * FROM productos WHERE id = ?').get(id);
  if (!producto) {
    throw new Error('Producto no encontrado');
  }

  let nuevoStock = tipo === 'entrada' 
    ? producto.stock + cantidad 
    : producto.stock - cantidad;

  if (nuevoStock < 0) nuevoStock = 0;

  db.prepare('UPDATE productos SET stock = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ?').run(nuevoStock, id);

  db.prepare(`
    INSERT INTO movimientos_stock (producto, stockAnterior, stockNuevo, tipo, cantidad, motivo, notas, usuario, fecha, sucursal)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    producto.stock,
    nuevoStock,
    tipo,
    cantidad,
    tipo === 'entrada' ? 'Ingreso manual' : 'Egreso manual',
    '',
    'sistema',
    new Date().toISOString(),
    'principal'
  );

  return { success: true, nuevoStock };
}

module.exports = {
  ajustarStock
};
