/**
 * sucursal.js
 * Modelo para gestionar las sucursales
 * 
 * Este modelo representa las diferentes sucursales de EAstore
 * y mantiene información importante sobre cada una.
 */

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Sucursal = sequelize.define('Sucursal', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    
    nombre: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: true
      }
    },
    
    direccion: {
      type: DataTypes.STRING(200),
      allowNull: false
    },
    
    localidad: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    
    provincia: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    
    codigoPostal: {
      type: DataTypes.STRING(10),
      allowNull: false
    },
    
    telefono: {
      type: DataTypes.STRING(20)
    },
    
    email: {
      type: DataTypes.STRING(100),
      validate: {
        isEmail: true
      }
    },
    
    esPrincipal: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    
    responsable: {
      type: DataTypes.STRING(100)
    },
    
    // Punto de venta para facturación ARCA (AFIP)
    puntoVenta: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
      validate: {
        min: 1,
        max: 99999
      }
    },
    
    // Configuración de impresoras
    configuracionImpresoras: {
      type: DataTypes.TEXT,
      allowNull: true,
      get() {
        const value = this.getDataValue('configuracionImpresoras');
        return value ? JSON.parse(value) : null;
      },
      set(value) {
        this.setDataValue('configuracionImpresoras', 
          value ? JSON.stringify(value) : null
        );
      }
    },
    
    // Horario de atención
    horarioApertura: {
      type: DataTypes.STRING(5),
      allowNull: true,
      validate: {
        is: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/  // Formato HH:MM
      }
    },
    
    horarioCierre: {
      type: DataTypes.STRING(5),
      allowNull: true,
      validate: {
        is: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/  // Formato HH:MM
      }
    },
    
    diasAtencion: {
      type: DataTypes.STRING(100),
      allowNull: true,
      get() {
        const value = this.getDataValue('diasAtencion');
        return value ? JSON.parse(value) : [];
      },
      set(value) {
        this.setDataValue('diasAtencion', 
          value ? JSON.stringify(value) : JSON.stringify([])
        );
      }
    },
    
    activo: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    
    fechaAlta: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    
    coordenadas: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        isValidCoordinates(value) {
          if (!value) return;
          
          // Validar formato de coordenadas (latitud,longitud)
          const regex = /^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/;
          if (!regex.test(value)) {
            throw new Error('Formato de coordenadas inválido. Debe ser "latitud,longitud"');
          }
        }
      }
    }
  }, {
    tableName: 'sucursales',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['nombre']
      },
      {
        unique: true,
        fields: ['puntoVenta']
      }
    ]
  });

  // Asociaciones
  Sucursal.associate = function(models) {
    // Una sucursal tiene muchos clientes
    Sucursal.hasMany(models.Cliente, {
      foreignKey: 'sucursalId',
      as: 'clientes'
    });
    
    // Una sucursal tiene muchos productos
    Sucursal.hasMany(models.Producto, {
      foreignKey: 'sucursalId',
      as: 'productos'
    });
    
    // Una sucursal tiene muchas facturas
    Sucursal.hasMany(models.Factura, {
      foreignKey: 'sucursalId',
      as: 'facturas'
    });
    
    // Una sucursal tiene muchas transacciones
    Sucursal.hasMany(models.Transaccion, {
      foreignKey: 'sucursalId',
      as: 'transacciones'
    });
    
    // Una sucursal tiene muchos usuarios
    Sucursal.hasMany(models.Usuario, {
      foreignKey: 'sucursalId',
      as: 'usuarios'
    });
  };

  // Métodos de instancia
  Sucursal.prototype.getStockDisponible = async function(productoId) {
    const { InventarioManager } = sequelize.models;
    return await InventarioManager.getStockSucursal(this.id, productoId);
  };
  
  Sucursal.prototype.getVentasDiarias = async function(fecha = new Date()) {
    const { Factura } = sequelize.models;
    const startOfDay = new Date(fecha);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(fecha);
    endOfDay.setHours(23, 59, 59, 999);
    
    return await Factura.findAll({
      where: {
        sucursalId: this.id,
        fechaEmision: {
          [sequelize.Sequelize.Op.between]: [startOfDay, endOfDay]
        },
        anulada: false
      }
    });
  };
  
  Sucursal.prototype.toJSON = function() {
    const values = { ...this.get() };
    
    // Eliminar datos sensibles si es necesario
    delete values.createdAt;
    delete values.updatedAt;
    
    return values;
  };

  // Hooks
  Sucursal.beforeCreate(async (sucursal, options) => {
    // Asegurarse que solo una sucursal sea principal
    if (sucursal.esPrincipal) {
      await Sucursal.update(
        { esPrincipal: false },
        { where: { esPrincipal: true } }
      );
    }
    
    // Asignar días de atención por defecto si no se especifican
    if (!sucursal.diasAtencion || sucursal.diasAtencion.length === 0) {
      sucursal.diasAtencion = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
    }
  });

  // Métodos estáticos
  Sucursal.findPrincipal = async function() {
    return await this.findOne({
      where: { esPrincipal: true }
    });
  };
  
  Sucursal.getAllActive = async function() {
    return await this.findAll({
      where: { activo: true },
      order: [['esPrincipal', 'DESC'], ['nombre', 'ASC']]
    });
  };

  return Sucursal;
};