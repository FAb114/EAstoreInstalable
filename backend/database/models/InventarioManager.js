const StockService = require('./StockService');
const ExportService = require('./ExportService');

class InventarioManager {
  ajustarStock(id, cantidad, tipo) {
    return StockService.ajustarStock(id, cantidad, tipo);
  }

  exportarInventarioACSV() {
    return ExportService.exportarInventarioACSV();
  }

  // Otros métodos que quieras mover también pueden seguir este patrón...
}

module.exports = InventarioManager;
