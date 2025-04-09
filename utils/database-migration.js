/**
 * database-migrations.js
 * Herramienta para migrar datos entre sucursales
 * 
 * Este módulo permite la exportación e importación de datos entre diferentes
 * sucursales de EAstore, asegurando la integridad y consistencia de los datos.
 */

const fs = require('fs');
const path = require('path');
const { dialog } = require('electron');
const db = require('../backend/database/db');
const logger = require('./logger');
const crypto = require('crypto');

class DatabaseMigrations {
  constructor() {
    this.db = db;
    this.migrationTypes = {
      FULL: 'full',       // Migración completa de todos los datos
      INCREMENTAL: 'incremental', // Solo cambios desde última sincronización
      SELECTIVE: 'selective'  // Tablas específicas seleccionadas
    };
  }

  /**
   * Exporta datos desde la sucursal actual a un archivo
   * @param {String} type - Tipo de migración (full, incremental, selective)
   * @param {Array} tables - Tablas a migrar (solo para selective)
   * @param {Number} sucursalId - ID de la sucursal origen
   * @returns {Promise<String>} - Ruta del archivo de migración generado
   */
  async exportData(type = this.migrationTypes.FULL, tables = [], sucursalId) {
    try {
      logger.info(`Iniciando exportación de datos. Tipo: ${type}`);
      
      // Obtener datos según el tipo de migración
      let dataToExport = {};
      
      if (type === this.migrationTypes.FULL) {
        // Exportación completa de todas las tablas
        dataToExport = await this._exportAllTables(sucursalId);
      } else if (type === this.migrationTypes.INCREMENTAL) {
        // Exportación incremental desde última sincronización
        const lastSyncDate = await this._getLastSyncDate(sucursalId);
        dataToExport = await this._exportIncrementalData(lastSyncDate, sucursalId);
      } else if (type === this.migrationTypes.SELECTIVE) {
        // Exportación selectiva de tablas específicas
        dataToExport = await this._exportSelectedTables(tables, sucursalId);
      }
      
      // Añadir metadatos a la exportación
      const exportData = {
        metadata: {
          exportDate: new Date().toISOString(),
          exportType: type,
          sucursalId: sucursalId,
          version: require('../package.json').version,
          checksum: this._generateChecksum(JSON.stringify(dataToExport))
        },
        data: dataToExport
      };
      
      // Guardar a archivo
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `easture_migration_${type}_${timestamp}.json`;
      const filePath = path.join(app.getPath('userData'), 'migrations', fileName);
      
      // Asegurar que el directorio existe
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      
      // Escribir archivo
      fs.writeFileSync(filePath, JSON.stringify(exportData, null, 2));
      
      logger.info(`Exportación completada: ${filePath}`);
      return filePath;
    } catch (error) {
      logger.error(`Error al exportar datos: ${error.message}`, error);
      throw new Error(`Error al exportar datos: ${error.message}`);
    }
  }
  
  /**
   * Importa datos desde un archivo de migración
   * @param {String} filePath - Ruta del archivo de migración
   * @param {Number} targetSucursalId - ID de la sucursal destino
   * @returns {Promise<Object>} - Resultado de la importación
   */
  async importData(filePath, targetSucursalId) {
    try {
      logger.info(`Iniciando importación de datos desde ${filePath}`);
      
      // Leer archivo de migración
      const fileContent = fs.readFileSync(filePath, 'utf8');
      const importData = JSON.parse(fileContent);
      
      // Validar estructura y checksums
      this._validateImportData(importData);
      
      // Validar compatibilidad con sucursal destino
      await this._validateSucursalCompatibility(importData.metadata.sucursalId, targetSucursalId);
      
      // Preparar transacción para importación atómica
      const transaction = await this.db.transaction();
      
      try {
        // Importar cada tabla en el orden correcto para mantener integridad referencial
        const importResults = await this._importTables(importData.data, transaction, targetSucursalId);
        
        // Registrar sincronización
        await this._recordSyncEvent(importData.metadata, targetSucursalId, transaction);
        
        // Confirmar transacción
        await transaction.commit();
        
        logger.info(`Importación completada exitosamente para sucursal ${targetSucursalId}`);
        return {
          success: true,
          message: 'Importación completada exitosamente',
          results: importResults
        };
      } catch (error) {
        // Revertir transacción en caso de error
        await transaction.rollback();
        logger.error(`Error durante la importación: ${error.message}`, error);
        throw error;
      }
    } catch (error) {
      logger.error(`Error al importar datos: ${error.message}`, error);
      throw new Error(`Error al importar datos: ${error.message}`);
    }
  }
  
  /**
   * Obtiene el historial de migraciones realizadas
   * @param {Number} sucursalId - ID de la sucursal 
   * @returns {Promise<Array>} - Historial de migraciones
   */
  async getMigrationHistory(sucursalId) {
    try {
      const history = await this.db.models.Sincronizacion.findAll({
        where: { sucursalId },
        order: [['fechaSincronizacion', 'DESC']]
      });
      
      return history;
    } catch (error) {
      logger.error(`Error al obtener historial de migraciones: ${error.message}`, error);
      throw new Error(`Error al obtener historial de migraciones: ${error.message}`);
    }
  }
  
  /**
   * Muestra un diálogo para seleccionar el archivo de migración
   * @returns {Promise<String>} - Ruta del archivo seleccionado
   */
  async selectMigrationFile() {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: 'Archivos de migración', extensions: ['json'] }
      ],
      title: 'Seleccione el archivo de migración'
    });
    
    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    
    return result.filePaths[0];
  }
  
  // Métodos privados
  
  /**
   * Exporta todas las tablas de la base de datos
   * @private
   */
  async _exportAllTables(sucursalId) {
    const tables = {};
    const models = this.db.models;
    
    // Exportar cada tabla teniendo en cuenta relaciones
    // Primero tablas sin dependencias
    tables.sucursales = await models.Sucursal.findAll({
      where: sucursalId ? { id: sucursalId } : {}
    });
    
    tables.clientes = await models.Cliente.findAll({
      where: sucursalId ? { sucursalId } : {}
    });
    
    tables.productos = await models.Producto.findAll({
      where: sucursalId ? { sucursalId } : {}
    });
    
    // Luego tablas con dependencias
    tables.facturas = await models.Factura.findAll({
      where: sucursalId ? { sucursalId } : {},
      include: [{ all: true }]
    });
    
    tables.transacciones = await models.Transaccion.findAll({
      where: sucursalId ? { sucursalId } : {},
      include: [{ all: true }]
    });
    
    return tables;
  }
  
  /**
   * Exporta datos incrementales desde la última sincronización
   * @private
   */
  async _exportIncrementalData(lastSyncDate, sucursalId) {
    const tables = {};
    const models = this.db.models;
    const whereClause = {
      updatedAt: { [this.db.Sequelize.Op.gte]: lastSyncDate },
      ...(sucursalId ? { sucursalId } : {})
    };
    
    // Exportar solo registros modificados desde la última sincronización
    tables.clientes = await models.Cliente.findAll({ where: whereClause });
    tables.productos = await models.Producto.findAll({ where: whereClause });
    tables.facturas = await models.Factura.findAll({ 
      where: whereClause,
      include: [{ all: true }]
    });
    tables.transacciones = await models.Transaccion.findAll({ 
      where: whereClause,
      include: [{ all: true }]
    });
    
    return tables;
  }
  
  /**
   * Exporta tablas específicas seleccionadas
   * @private
   */
  async _exportSelectedTables(tables, sucursalId) {
    const data = {};
    const models = this.db.models;
    const whereClause = sucursalId ? { sucursalId } : {};
    
    for (const table of tables) {
      if (models[this._capitalizeFirstLetter(table)]) {
        data[table] = await models[this._capitalizeFirstLetter(table)].findAll({
          where: whereClause,
          ...(table === 'facturas' || table === 'transacciones' ? { include: [{ all: true }] } : {})
        });
      }
    }
    
    return data;
  }
  
  /**
   * Obtiene la fecha de la última sincronización
   * @private
   */
  async _getLastSyncDate(sucursalId) {
    const lastSync = await this.db.models.Sincronizacion.findOne({
      where: { sucursalId },
      order: [['fechaSincronizacion', 'DESC']]
    });
    
    return lastSync ? lastSync.fechaSincronizacion : new Date(0);
  }
  
  /**
   * Importa las tablas en el orden correcto
   * @private
   */
  async _importTables(data, transaction, targetSucursalId) {
    const results = {};
    const models = this.db.models;
    
    // Importar en orden para mantener integridad referencial
    if (data.sucursales) {
      results.sucursales = await this._importTable(models.Sucursal, data.sucursales, transaction);
    }
    
    if (data.clientes) {
      results.clientes = await this._importTable(models.Cliente, data.clientes, transaction, { sucursalId: targetSucursalId });
    }
    
    if (data.productos) {
      results.productos = await this._importTable(models.Producto, data.productos, transaction, { sucursalId: targetSucursalId });
    }
    
    if (data.facturas) {
      results.facturas = await this._importTable(models.Factura, data.facturas, transaction, { sucursalId: targetSucursalId });
    }
    
    if (data.transacciones) {
      results.transacciones = await this._importTable(models.Transaccion, data.transacciones, transaction, { sucursalId: targetSucursalId });
    }
    
    return results;
  }
  
  /**
   * Importa una tabla específica
   * @private
   */
  async _importTable(model, data, transaction, overrides = {}) {
    const results = {
      created: 0,
      updated: 0,
      skipped: 0
    };
    
    for (const item of data) {
      // Preparar datos con posibles sobreescrituras (ej: cambiar sucursalId)
      const itemData = { ...item, ...overrides };
      
      // Buscar si el registro ya existe
      const existingRecord = await model.findOne({
        where: { id: item.id },
        transaction
      });
      
      if (existingRecord) {
        // Actualizar registro existente
        await existingRecord.update(itemData, { transaction });
        results.updated++;
      } else {
        // Crear nuevo registro
        await model.create(itemData, { transaction });
        results.created++;
      }
    }
    
    return results;
  }
  
  /**
   * Registra un evento de sincronización
   * @private
   */
  async _recordSyncEvent(metadata, targetSucursalId, transaction) {
    await this.db.models.Sincronizacion.create({
      sucursalId: targetSucursalId,
      fechaSincronizacion: new Date(),
      tipoSincronizacion: metadata.exportType,
      sucursalOrigen: metadata.sucursalId,
      detalles: JSON.stringify(metadata)
    }, { transaction });
  }
  
  /**
   * Valida los datos de importación
   * @private
   */
  _validateImportData(importData) {
    // Verificar estructura básica
    if (!importData.metadata || !importData.data) {
      throw new Error('Estructura de archivo de migración inválida');
    }
    
    // Verificar checksum
    const calculatedChecksum = this._generateChecksum(JSON.stringify(importData.data));
    if (calculatedChecksum !== importData.metadata.checksum) {
      throw new Error('El archivo de migración está corrupto o ha sido modificado');
    }
    
    // Verificar versión compatible
    const currentVersion = require('../package.json').version;
    if (!this._isVersionCompatible(currentVersion, importData.metadata.version)) {
      throw new Error(`Versión incompatible. Archivo: ${importData.metadata.version}, Actual: ${currentVersion}`);
    }
  }
  
  /**
   * Valida compatibilidad entre sucursales
   * @private
   */
  async _validateSucursalCompatibility(sourceSucursalId, targetSucursalId) {
    // Verificar que la sucursal de destino existe
    const targetSucursal = await this.db.models.Sucursal.findByPk(targetSucursalId);
    if (!targetSucursal) {
      throw new Error(`La sucursal de destino (ID: ${targetSucursalId}) no existe`);
    }
    
    // Verificar que no sea la misma sucursal
    if (sourceSucursalId === targetSucursalId) {
      throw new Error('No se puede importar a la misma sucursal de origen');
    }
  }
  
  /**
   * Genera un checksum para verificar integridad de datos
   * @private
   */
  _generateChecksum(data) {
    return crypto.createHash('sha256').update(data).digest('hex');
  }
  
  /**
   * Verifica compatibilidad de versiones
   * @private
   */
  _isVersionCompatible(currentVersion, fileVersion) {
    // Implementación simple: misma versión mayor
    const currentMajor = currentVersion.split('.')[0];
    const fileMajor = fileVersion.split('.')[0];
    return currentMajor === fileMajor;
  }
  
  /**
   * Capitaliza la primera letra de un string
   * @private
   */
  _capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
  }
}

module.exports = new DatabaseMigrations();