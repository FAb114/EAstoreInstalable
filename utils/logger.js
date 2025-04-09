/**
 * logger.js
 * Sistema de logging para facilitar el debugging
 * 
 * Este módulo proporciona funcionalidades de registro de eventos
 * y errores para facilitar el debugging y monitoreo de la aplicación.
 */

const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const util = require('util');

class Logger {
  constructor() {
    this.logLevels = {
      ERROR: 0,
      WARN: 1,
      INFO: 2,
      DEBUG: 3
    };
    
    // Nivel de log predeterminado (puede cambiarse en config)
    this.currentLevel = this.logLevels.INFO;
    
    // Configuración inicial
    this.initialize();
  }

  /**
   * Inicializa el sistema de logs
   */
  initialize() {
    try {
      // Crear directorio de logs si no existe
      this.logDir = app ? path.join(app.getPath('userData'), 'logs') : path.join(__dirname, '..', 'logs');
      fs.mkdirSync(this.logDir, { recursive: true });
      
      // Cargar configuración
      this.loadConfig();
      
      // Archivo de log actual
      const date = new Date().toISOString().split('T')[0];
      this.logFile = path.join(this.logDir, `easture-${date}.log`);
      
      // Rotar logs antiguos
      this.rotateOldLogs();
      
      this.info('Sistema de logging inicializado');
    } catch (error) {
      console.error('Error al inicializar el sistema de logs:', error);
    }
  }

  /**
   * Carga la configuración del logger
   */
  loadConfig() {
    try {
      const configPath = path.join(__dirname, '..', 'config', 'app-config.js');
      if (fs.existsSync(configPath)) {
        const config = require(configPath);
        if (config.logging && this.logLevels[config.logging.level] !== undefined) {
          this.currentLevel = this.logLevels[config.logging.level];
        }
        
        // Otras configuraciones de logging
        this.maxLogFiles = config.logging?.maxLogFiles || 30; // Mantener 30 días de logs por defecto
        this.consoleOutput = config.logging?.consoleOutput !== false; // true por defecto
      }
    } catch (error) {
      console.error('Error al cargar configuración de logging:', error);
    }
  }

  /**
   * Registra un mensaje de error
   * @param {String} message - Mensaje de error
   * @param {Error|Object} [error] - Objeto de error opcional
   */
  error(message, error = null) {
    if (this.currentLevel >= this.logLevels.ERROR) {
      const logMessage = this.formatLogMessage('ERROR', message);
      this.writeLog(logMessage);
      
      // Registrar detalles del error si se proporciona
      if (error) {
        let errorDetails;
        if (error instanceof Error) {
          errorDetails = `${error.name}: ${error.message}\nStack: ${error.stack}`;
        } else {
          errorDetails = util.inspect(error);
        }
        this.writeLog(`ERROR DETAILS: ${errorDetails}`);
      }
      
      if (this.consoleOutput) {
        console.error(logMessage);
        if (error) console.error(error);
      }
    }
  }

  /**
   * Registra un mensaje de advertencia
   * @param {String} message - Mensaje de advertencia
   */
  warn(message) {
    if (this.currentLevel >= this.logLevels.WARN) {
      const logMessage = this.formatLogMessage('WARN', message);
      this.writeLog(logMessage);
      if (this.consoleOutput) console.warn(logMessage);
    }
  }

  /**
   * Registra un mensaje informativo
   * @param {String} message - Mensaje informativo
   */
  info(message) {
    if (this.currentLevel >= this.logLevels.INFO) {
      const logMessage = this.formatLogMessage('INFO', message);
      this.writeLog(logMessage);
      if (this.consoleOutput) console.info(logMessage);
    }
  }

  /**
   * Registra un mensaje de depuración
   * @param {String} message - Mensaje de depuración
   * @param {Object} [data] - Datos adicionales opcionales
   */
  debug(message, data = null) {
    if (this.currentLevel >= this.logLevels.DEBUG) {
      const logMessage = this.formatLogMessage('DEBUG', message);
      this.writeLog(logMessage);
      
      if (data) {
        const dataString = util.inspect(data, { depth: null, colors: false });
        this.writeLog(`DEBUG DATA: ${dataString}`);
      }
      
      if (this.consoleOutput) {
        console.debug(logMessage);
        if (data) console.debug(data);
      }
    }
  }

  /**
   * Formatea un mensaje de log
   * @private
   */
  formatLogMessage(level, message) {
    const timestamp = new Date().toISOString();
    return `[${timestamp}] [${level}] ${message}`;
  }

  /**
   * Escribe un mensaje en el archivo de log
   * @private
   */
  writeLog(message) {
    try {
      fs.appendFileSync(this.logFile, message + '\n');
    } catch (error) {
      console.error('Error al escribir en el archivo de log:', error);
    }
  }

  /**
   * Rota los archivos de log antiguos
   * @private
   */
  rotateOldLogs() {
    try {
      const logFiles = fs.readdirSync(this.logDir)
        .filter(file => file.startsWith('easture-') && file.endsWith('.log'));
      
      // Ordenar por fecha (más antiguos primero)
      logFiles.sort();
      
      // Eliminar logs antiguos si exceden el máximo
      if (logFiles.length > this.maxLogFiles) {
        const filesToDelete = logFiles.slice(0, logFiles.length - this.maxLogFiles);
        for (const file of filesToDelete) {
          fs.unlinkSync(path.join(this.logDir, file));
          this.info(`Log rotado: ${file}`);
        }
      }
    } catch (error) {
      console.error('Error al rotar archivos de log:', error);
    }
  }

  /**
   * Cambia el nivel de log en tiempo de ejecución
   * @param {String} level - Nivel de log ('ERROR', 'WARN', 'INFO', 'DEBUG')
   */
  setLogLevel(level) {
    if (this.logLevels[level] !== undefined) {
      this.currentLevel = this.logLevels[level];
      this.info(`Nivel de log cambiado a: ${level}`);
    } else {
      this.warn(`Nivel de log inválido: ${level}`);
    }
  }

  /**
   * Crea una instantánea del estado actual de la aplicación
   * @param {String} reason - Motivo de la instantánea
   * @param {Object} appState - Estado de la aplicación
   */
  snapshot(reason, appState) {
    const snapshotFile = path.join(this.logDir, `snapshot-${Date.now()}.json`);
    try {
      const snapshot = {
        timestamp: new Date().toISOString(),
        reason,
        state: appState
      };
      
      fs.writeFileSync(snapshotFile, JSON.stringify(snapshot, null, 2));
      this.info(`Instantánea creada: ${snapshotFile}`);
    } catch (error) {
      this.error(`Error al crear instantánea: ${error.message}`, error);
    }
  }
}

// Exportar una instancia única
module.exports = new Logger();