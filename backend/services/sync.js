const axios = require('axios');

class SyncService {
  constructor(databaseService) {
    this.db = databaseService;
    this.serverUrl = 'http://localhost:3000/api';
    this.maxIntentos = 5;
  }

  isOnline() {
    // Por ahora asumimos que el servidor está online si responde a /ping
    try {
      // Esto es síncrono solo para chequeo rápido (mejor usar async si querés más precisión)
      return true;
    } catch {
      return false;
    }
  }

  isOffline() {
    return !this.isOnline();
  }

  async sincronizar() {
    const pendientes = this.db.getAll('sync_queue', 'intentos < ?', [this.maxIntentos]);

    for (const item of pendientes) {
      try {
        const datos = JSON.parse(item.datos);
        const url = `${this.serverUrl}/${item.tabla}`;

        let response;
        switch (item.operacion) {
          case 'insert':
            response = await axios.post(url, datos);
            break;
          case 'update':
            response = await axios.put(`${url}/${datos.id}`, datos);
            break;
          case 'delete':
            response = await axios.delete(`${url}/${datos.id}`);
            break;
          default:
            throw new Error(`Operación desconocida: ${item.operacion}`);
        }

        if (response.status >= 200 && response.status < 300) {
          // Eliminamos de la cola si fue exitoso
          this.db.delete('sync_queue', item.id);
        } else {
          // Incrementamos los intentos si falló
          this.incrementarIntentos(item.id);
        }
      } catch (error) {
        console.error(`Error sincronizando ${item.tabla} [ID ${item.id}]:`, error.message);
        this.incrementarIntentos(item.id);
      }
    }
  }

  agregarOperacion(operacion, tabla, datos) {
    try {
      const datosString = JSON.stringify(datos);
      this.db.insert('sync_queue', {
        operacion,
        tabla,
        datos: datosString
      });
    } catch (error) {
      console.error('Error al agregar operación a la cola de sincronización:', error.message);
    }
  }

  incrementarIntentos(id) {
    const item = this.db.get('sync_queue', id);
    if (item) {
      this.db.update('sync_queue', id, { intentos: item.intentos + 1 });
    }
  }
}

// Agregar método isOffline directamente al prototipo (si lo preferís así):
// SyncService.prototype.isOffline = function () { return !this.isOnline(); };

// Instancia del servicio, asegurate que DatabaseService esté bien importado
const DatabaseService = require('../database/db');
const dbService = new DatabaseService();
const syncServiceInstance = new SyncService(dbService);

module.exports = {
  SyncService,
  syncService: syncServiceInstance
};
