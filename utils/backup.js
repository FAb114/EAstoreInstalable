/**
 * Sistema de respaldo automático para EAstore Facturador
 * Realiza copias de seguridad periódicas de la base de datos
 * y permite restaurar desde copias previas
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const moment = require('moment');
const logger = require('./logger');
const config = require('../config/app-config');

// Configuración de rutas para backups
const appDataPath = process.env.APPDATA || (process.platform === 'darwin' ? 
    path.join(process.env.HOME, 'Library', 'Application Support') : 
    path.join(process.env.HOME, '.local', 'share'));
    
const backupDir = path.join(appDataPath, 'EAstore', 'backups');
const dbPath = path.join(appDataPath, 'EAstore', 'eastore.db');

// Asegurar que existe el directorio de backups
if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
    logger.info(`Directorio de respaldos creado en: ${backupDir}`);
}

/**
 * Realiza un backup completo de la base de datos
 * @param {string} [motivo='auto'] - Motivo del backup (auto, manual, pre-update)
 * @returns {Promise<string>} Ruta del archivo de backup generado
 */
async function realizarBackup(motivo = 'auto') {
    const timestamp = moment().format('YYYYMMDD_HHmmss');
    const backupFileName = `backup_${motivo}_${timestamp}.db`;
    const backupPath = path.join(backupDir, backupFileName);
    
    logger.info(`Iniciando backup ${motivo} de la base de datos...`);
    
    try {
        // Para SQLite, una copia del archivo es suficiente como backup
        await fs.promises.copyFile(dbPath, backupPath);
        
        logger.info(`Backup completado exitosamente: ${backupPath}`);
        
        // Limpieza de backups antiguos
        await limpiarBackupsAntiguos();
        
        return backupPath;
    } catch (error) {
        logger.error(`Error al realizar backup: ${error.message}`);
        throw new Error(`No se pudo realizar el backup: ${error.message}`);
    }
}

/**
 * Restaura la base de datos desde un archivo de backup
 * @param {string} backupPath - Ruta del archivo de backup a restaurar
 * @returns {Promise<boolean>} Resultado de la operación
 */
async function restaurarBackup(backupPath) {
    if (!fs.existsSync(backupPath)) {
        throw new Error(`El archivo de backup no existe: ${backupPath}`);
    }
    
    logger.info(`Iniciando restauración desde backup: ${backupPath}`);
    
    try {
        // Realizar un backup previo a la restauración por seguridad
        const preRestoreBackup = await realizarBackup('pre-restauracion');
        logger.info(`Backup de seguridad creado antes de restaurar: ${preRestoreBackup}`);
        
        // Cerrar conexiones con la base de datos antes de restaurar
        // Este proceso varía según cómo se implemente la conexión a la DB
        // Esta función debe ser implementada según el sistema utilizado
        await cerrarConexionesDB();
        
        // Restaurar copiando el archivo de backup
        await fs.promises.copyFile(backupPath, dbPath);
        
        logger.info(`Restauración completada exitosamente desde: ${backupPath}`);
        return true;
    } catch (error) {
        logger.error(`Error al restaurar desde backup: ${error.message}`);
        throw new Error(`No se pudo restaurar el backup: ${error.message}`);
    }
}

/**
 * Elimina backups antiguos según la política de retención
 */
async function limpiarBackupsAntiguos() {
    try {
        const files = await fs.promises.readdir(backupDir);
        const backupFiles = files.filter(f => f.startsWith('backup_') && f.endsWith('.db'));
        
        // Ordenar por fecha (más reciente primero)
        backupFiles.sort((a, b) => {
            const dateA = a.match(/\d{8}_\d{6}/)[0];
            const dateB = b.match(/\d{8}_\d{6}/)[0];
            return dateB.localeCompare(dateA);
        });
        
        // Conservar configuración basada en el tipo de backup
        const keepAuto = config.backup.keepAutoBackups || 7;
        const keepManual = config.backup.keepManualBackups || 10;
        
        const autoBackups = backupFiles.filter(f => f.includes('_auto_'));
        const manualBackups = backupFiles.filter(f => f.includes('_manual_'));
        
        // Eliminar backups automáticos antiguos
        if (autoBackups.length > keepAuto) {
            for (let i = keepAuto; i < autoBackups.length; i++) {
                const filePath = path.join(backupDir, autoBackups[i]);
                await fs.promises.unlink(filePath);
                logger.info(`Backup automático antiguo eliminado: ${autoBackups[i]}`);
            }
        }
        
        // Eliminar backups manuales antiguos
        if (manualBackups.length > keepManual) {
            for (let i = keepManual; i < manualBackups.length; i++) {
                const filePath = path.join(backupDir, manualBackups[i]);
                await fs.promises.unlink(filePath);
                logger.info(`Backup manual antiguo eliminado: ${manualBackups[i]}`);
            }
        }
    } catch (error) {
        logger.error(`Error al limpiar backups antiguos: ${error.message}`);
    }
}

/**
 * Cierra todas las conexiones activas con la base de datos
 * @returns {Promise<void>}
 */
async function cerrarConexionesDB() {
    // Implementación depende del sistema de base de datos utilizado
    // Este es un placeholder - debe ser implementado según el sistema utilizado
    logger.info('Cerrando conexiones a la base de datos antes de la restauración');
    
    // Simulación del cierre de conexiones
    return new Promise(resolve => {
        setTimeout(() => {
            logger.info('Conexiones a la base de datos cerradas');
            resolve();
        }, 1000);
    });
}

/**
 * Programa backups automáticos según la configuración
 */
function programarBackupsAutomaticos() {
    const intervaloHoras = config.backup.autoBackupIntervalHours || 24;
    const intervaloMs = intervaloHoras * 60 * 60 * 1000;
    
    logger.info(`Programando backups automáticos cada ${intervaloHoras} horas`);
    
    setInterval(async () => {
        try {
            await realizarBackup('auto');
        } catch (error) {
            logger.error(`Error en backup automático programado: ${error.message}`);
        }
    }, intervaloMs);
}

// Exportar funcionalidades
module.exports = {
    realizarBackup,
    restaurarBackup,
    programarBackupsAutomaticos,
    limpiarBackupsAntiguos,
    obtenerListadoBackups: async () => {
        try {
            const files = await fs.promises.readdir(backupDir);
            return files
                .filter(f => f.startsWith('backup_') && f.endsWith('.db'))
                .map(filename => {
                    const stats = fs.statSync(path.join(backupDir, filename));
                    const match = filename.match(/backup_([^_]+)_(\d{8}_\d{6})\.db/);
                    return {
                        filename,
                        path: path.join(backupDir, filename),
                        tipo: match ? match[1] : 'desconocido',
                        fecha: match ? moment(match[2], 'YYYYMMDD_HHmmss').toDate() : stats.mtime,
                        tamaño: stats.size
                    };
                })
                .sort((a, b) => b.fecha - a.fecha);
        } catch (error) {
            logger.error(`Error al obtener listado de backups: ${error.message}`);
            return [];
        }
    }
};