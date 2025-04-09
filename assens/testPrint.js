const { generarContenidoFactura } = require('./backend/helpers/contenidoFactura');
const PrintService = require('./backend/services/print');

const facturaEjemplo = {
  cliente: {
    nombre: 'Juan Pérez',
  },
  productos: [
    { nombre: 'Auriculares Bluetooth', cantidad: 1, precio: 5999.99 },
    { nombre: 'Mouse Gamer RGB', cantidad: 2, precio: 3200 },
  ],
  total: 5999.99 + (2 * 3200),
  tipo: 'A',
  cae: '789654123123',
  fecha: '05/04/2025',
  sucursal: {
    nombre: 'Sucursal Central'
  }
};

(async () => {
  const html = generarContenidoFactura(facturaEjemplo);
  const printer = new PrintService();
  await printer.imprimirHTML(html);
})();
