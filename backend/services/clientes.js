/**
 * Servicio de Clientes para EAstore
 * Maneja la gestión de clientes
 */

const Cliente = require('../database/models/clientes');
const logger = require('../../utils/logger');
const emailService = require('./email');
const syncService = require('./sync');

class ClienteService {
  /**
   * Crea un nuevo cliente
   * @param {Object} clienteData - Datos del cliente
   * @returns {Promise<Object>} - Cliente creado
   */
  async crearCliente(clienteData) {
    try {
      logger.info('Creando nuevo cliente');
      
      // Validar datos obligatorios
      if (!clienteData.nombre) {
        throw new Error('El nombre del cliente es obligatorio');
      }
      
      // Validar si ya existe un cliente con el mismo documento
      if (clienteData.documento) {
        const clienteExistente = await Cliente.findOne({
          where: { documento: clienteData.documento }
        });
        
        if (clienteExistente) {
          throw new Error(`Ya existe un cliente con el documento ${clienteData.documento}`);
        }
      }
      
      // Crear el cliente
      const nuevoCliente = await Cliente.create({
        nombre: clienteData.nombre,
        documento: clienteData.documento || null,
        email: clienteData.email || null,
        telefono: clienteData.telefono || null,
        direccion: clienteData.direccion || null,
        tipoCliente: clienteData.tipoCliente || 'regular',
        observaciones: clienteData.observaciones || null
      });
      
      logger.info(`Cliente ${nuevoCliente.id} creado exitosamente`);
      
      // Enviar email de bienvenida si tiene email
      if (nuevoCliente.email) {
        try {
          await emailService.enviarEmailBienvenida(nuevoCliente);
        } catch (emailError) {
          logger.warn('No se pudo enviar el email de bienvenida:', emailError);
          // No detener el flujo si falla el envío del email
        }
      }
      
      // Marcar para sincronización si estamos offline
      if (!navigator.onLine) {
        await syncService.marcarParaSincronizacion('clientes', nuevoCliente.id);
      }
      
      return nuevoCliente;
    } catch (error) {
      logger.error('Error al crear cliente:', error);
      throw new Error(`Error al crear cliente: ${error.message}`);
    }
  }
  
  /**
   * Actualiza los datos de un cliente
   * @param {Number} clienteId - ID del cliente
   * @param {Object} clienteData - Nuevos datos del cliente
   * @returns {Promise<Object>} - Cliente actualizado
   */
  async actualizarCliente(clienteId, clienteData) {
    try {
      logger.info(`Actualizando cliente ${clienteId}`);
      
      // Buscar cliente
      const cliente = await Cliente.findByPk(clienteId);
      if (!cliente) {
        throw new Error('Cliente no encontrado');
      }
      
      // Validar si el nuevo documento ya existe en otro cliente
      if (clienteData.documento && clienteData.documento !== cliente.documento) {
        const clienteExistente = await Cliente.findOne({
          where: { documento: clienteData.documento }
        });
        
        if (clienteExistente && clienteExistente.id !== clienteId) {
          throw new Error(`Ya existe otro cliente con el documento ${clienteData.documento}`);
        }
      }
      
      // Actualizar campos
      await cliente.update({
        nombre: clienteData.nombre || cliente.nombre,
        documento: clienteData.documento || cliente.documento,
        email: clienteData.email || cliente.email,
        telefono: clienteData.telefono || cliente.telefono,
        direccion: clienteData.direccion || cliente.direccion,
        tipoCliente: clienteData.tipoCliente || cliente.tipoCliente,
        observaciones: clienteData.observaciones || cliente.observaciones
      });
      
      logger.info(`Cliente ${clienteId} actualizado exitosamente`);
      
      // Marcar para sincronización si estamos offline
      if (!navigator.onLine) {
        await syncService.marcarParaSincronizacion('clientes', clienteId);
      }
      
      return cliente;
    } catch (error) {
      logger.error(`Error al actualizar cliente ${clienteId}:`, error);
      throw new Error(`Error al actualizar cliente: ${error.message}`);
    }
  }
  
  /**
   * Obtiene un cliente por su ID
   * @param {Number} clienteId - ID del cliente
   * @returns {Promise<Object>} - Cliente encontrado
   */
  async obtenerClientePorId(clienteId) {
    try {
      const cliente = await Cliente.findByPk(clienteId);
      
      if (!cliente) {
        throw new Error('Cliente no encontrado');
      }
      
      return cliente;
    } catch (error) {
      logger.error(`Error al obtener cliente ${clienteId}:`, error);
      throw new Error(`Error al obtener cliente: ${error.message}`);
    }
  }
  
  /**
   * Busca un cliente por número de documento
   * @param {String} documento - Número de documento
   * @returns {Promise<Object>} - Cliente encontrado
   */
  async buscarClientePorDocumento(documento) {
    try {
      const cliente = await Cliente.findOne({
        where: { documento }
      });
      
      return cliente;
    } catch (error) {
      logger.error(`Error al buscar cliente por documento ${documento}:`, error);
      throw new Error(`Error al buscar cliente por documento: ${error.message}`);
    }
  }
  
  /**
   * Busca clientes según criterios
   * @param {Object} filtros - Criterios de búsqueda
   * @returns {Promise<Array>} - Clientes encontrados
   */
  async buscarClientes(filtros = {}) {
    try {
      return await Cliente.findAll({
        where: filtros,
        order: [['nombre', 'ASC']]
    });
} catch (error) {
  logger.error('Error al buscar clientes:', error);
  throw new Error(`Error al buscar clientes: ${error.message}`);
}
}

/**
* Elimina un cliente
* @param {Number} clienteId - ID del cliente a eliminar
* @returns {Promise<Boolean>} - True si se eliminó correctamente
*/
async eliminarCliente(clienteId) {
try {
  logger.info(`Eliminando cliente ${clienteId}`);
  
  const cliente = await Cliente.findByPk(clienteId);
  if (!cliente) {
    throw new Error('Cliente no encontrado');
  }
  
  // Verificar si el cliente tiene facturas asociadas
  const tieneFaturasAsociadas = await this.verificarFacturasAsociadas(clienteId);
  if (tieneFaturasAsociadas) {
    throw new Error('No se puede eliminar el cliente porque tiene facturas asociadas');
  }
  
  await cliente.destroy();
  
  // Marcar para sincronización si estamos offline
  if (!navigator.onLine) {
    await syncService.marcarParaSincronizacion('clientes_eliminados', clienteId);
  }
  
  logger.info(`Cliente ${clienteId} eliminado exitosamente`);
  return true;
} catch (error) {
  logger.error(`Error al eliminar cliente ${clienteId}:`, error);
  throw new Error(`Error al eliminar cliente: ${error.message}`);
}
}

/**
* Verifica si un cliente tiene facturas asociadas
* @param {Number} clienteId - ID del cliente
* @returns {Promise<Boolean>} - True si tiene facturas asociadas
*/
async verificarFacturasAsociadas(clienteId) {
try {
  const Factura = require('../database/models/factura');
  const cantidadFacturas = await Factura.count({
    where: { clienteId }
  });
  
  return cantidadFacturas > 0;
} catch (error) {
  logger.error(`Error al verificar facturas asociadas al cliente ${clienteId}:`, error);
  throw new Error('Error al verificar facturas asociadas');
}
}

/**
* Importa clientes desde un archivo
* @param {Buffer} archivo - Archivo con datos de clientes
* @returns {Promise<Object>} - Resultado de la importación
*/
async importarClientes(archivo) {
try {
  logger.info('Iniciando importación de clientes');
  
  // Esta función debería implementarse según el formato del archivo
  // (CSV, Excel, etc.) utilizando bibliotecas como csv-parser, xlsx, etc.
  
  // Ejemplo básico (esta implementación es un placeholder)
  const clientesImportados = [];
  const errores = [];
  
  // Simulación de procesamiento
  const datos = [
    { nombre: 'Cliente Importado 1', documento: '12345678', email: 'cliente1@example.com' },
    { nombre: 'Cliente Importado 2', documento: '87654321', email: 'cliente2@example.com' }
  ];
  
  for (const dato of datos) {
    try {
      const cliente = await this.crearCliente(dato);
      clientesImportados.push(cliente);
    } catch (error) {
      errores.push({
        linea: datos.indexOf(dato) + 1,
        error: error.message,
        datos: dato
      });
    }
  }
  
  logger.info(`Importación finalizada: ${clientesImportados.length} clientes importados, ${errores.length} errores`);
  
  return {
    success: errores.length === 0,
    importados: clientesImportados.length,
    errores: errores
  };
} catch (error) {
  logger.error('Error al importar clientes:', error);
  throw new Error(`Error al importar clientes: ${error.message}`);
}
}

/**
* Exporta clientes a un formato específico
* @param {String} formato - Formato de exportación (csv, excel, etc.)
* @param {Object} filtros - Filtros para los clientes a exportar
* @returns {Promise<Buffer>} - Datos exportados
*/
async exportarClientes(formato = 'csv', filtros = {}) {
try {
  logger.info(`Exportando clientes en formato ${formato}`);
  
  // Obtener clientes según filtros
  const clientes = await this.buscarClientes(filtros);
  
  // Esta función debería implementarse según el formato requerido
  // utilizando bibliotecas como json2csv, xlsx, etc.
  
  // Ejemplo básico (esta implementación es un placeholder)
  let datos;
  
  switch (formato.toLowerCase()) {
    case 'csv':
      // Simular generación de CSV
      datos = Buffer.from('id,nombre,documento,email\n1,Cliente 1,12345678,cliente1@example.com');
      break;
    
    case 'excel':
      // Simular generación de Excel
      datos = Buffer.from('Excel simulado');
      break;
    
    default:
      throw new Error(`Formato no soportado: ${formato}`);
  }
  
  logger.info(`Exportación finalizada: ${clientes.length} clientes exportados`);
  return datos;
} catch (error) {
  logger.error(`Error al exportar clientes en formato ${formato}:`, error);
  throw new Error(`Error al exportar clientes: ${error.message}`);
}
}
}

module.exports = new ClienteService();