const fs = require('fs');
const path = require('path');
const db = require('../db');

function exportarInventarioACSV() {
  const productos = db.prepare('SELECT * FROM productos').all();

  const encabezado = 'ID,Código,Nombre,Descripción,Precio,Stock\n';
  const contenido = productos.map(p =>
    `${p.id},${p.codigo},"${p.nombre}","${p.descripcion || ''}",${p.precio},${p.stock}`
  ).join('\n');

  const csv = encabezado + contenido;
  const filePath = path.join(__dirname, '../../../export_inventario.csv');
  fs.writeFileSync(filePath, csv);

  return filePath;
}

module.exports = {
  exportarInventarioACSV
};
