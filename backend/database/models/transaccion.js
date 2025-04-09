/**
 * transaccion.js
 * Modelo para transacciones
 * 
 * Este modelo representa las transacciones financieras
 * en el sistema de facturación de EAstore.
 */

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Transaccion = sequelize.define('Transaccion', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    
    // ID de la factura relacionada (puede ser null para pagos a cuenta)
    facturaId: {
      type: DataTypes.UUID,
      allowNull: true
    },
    
    // ID del cliente relacionado
    clienteId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    
    // ID de la sucursal donde ocurrió la transacción
    sucursalId: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    
    // Tipo de transacción
    tipo: {
      type: DataTypes.ENUM,
      values: ['PAGO', 'COBRO', 'DEVOLUCIÓN', 'AJUSTE', 'ANTICIPO'],
      allowNull: false
    },
    
    // Método de pago
    medioPago: {
      type: DataTypes.ENUM,
      values: ['EFECTIVO', 'TRANSFERENCIA', 'TARJETA_DEBITO', 'TARJETA_CREDITO', 'QR', 'MERCADOPAGO', 'CHEQUE', 'OTRO'],
      allowNull: false
    },
    
    // Monto de la transacción
    monto: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      validate: {
        isDecimal: true,
        min: 0.01
      }
    },
    
    // Moneda
    moneda: {
      type: DataTypes.STRING(3),
      defaultValue: 'ARS',
      validate: {
        isIn: [['ARS', 'USD', 'EUR']]
      }
    },
    
    // Para pagos con tarjeta o transferencias
    datosAdicionales: {
      type: DataTypes.TEXT,
      allowNull: true,
      get() {
        const value = this.getDataValue('datosAdicionales');
        return value ? JSON.parse(value) : null;
      },
      set(value) {
        this.setDataValue('datosAdicionales', 
          value ? JSON.stringify(value) : null
        );
      }
    },
    
    // Referencias externas (ID de MercadoPago, etc.)
    referenciaPago: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    
    // Estado de la transacción
    estado: {
      type: DataTypes.ENUM,
      values: ['PENDIENTE', 'CONFIRMADO', 'RECHAZADO', 'ANULADO'],
      defaultValue: 'PENDIENTE'
    },
    
    // Fecha y hora de la transacción
    fechaHora: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      allowNull: false
    },
    
    // Usuario que registró la transacción
    usuarioId: {
      type: DataTypes.UUID,
      allowNull: true
    },
    
    // Notas o comentarios
    notas: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    
    // Si la transacción fue sincronizada con AFIP/ARCA
    sincronizadoARCA: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    
    // Cuotas (para pagos con tarjeta)
    cuotas: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
      validate: {
        min: 1,
        max: 24
      }
    },
    
    // Si la transacción es para factura en modo offline
    modoOffline: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    
    // Campo para almacenar recibos o comprobantes (base64)
    comprobante: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    tableName: 'transacciones',
    timestamps: true,
    indexes: [
      {
        fields: ['facturaId']
      },
      {
        fields: ['clienteId']
      },
      {
        fields: ['fechaHora']
      },
      {
        fields: ['estado']
      },
      {
        fields: ['medioPago']
      }
    ]
  });

  // Asociaciones
  Transaccion.associate = function(models) {
    // Una transacción pertenece a una factura (opcional)
    Transaccion.belongsTo(models.Factura, {
      foreignKey: 'facturaId',
      as: 'factura',
      constraints: false // Permite que facturaId sea null
    });
    
    // Una transacción pertenece a un cliente
    Transaccion.belongsTo(models.Cliente, {
      foreignKey: 'clienteId',
      as: 'cliente'
    });
    
    // Una transacción pertenece a una sucursal
    Transaccion.belongsTo(models.Sucursal, {
      foreignKey: 'sucursalId',
      as: 'sucursal'
    });
    
    // Una transacción puede estar asociada a un usuario
    Transaccion.belongsTo(models.Usuario, {
      foreignKey: 'usuarioId',
      as: 'usuario',
      constraints: false
    });
  };

  // Métodos de instancia
  Transaccion.prototype.confirmar = async function() {
    if (this.estado === 'PENDIENTE') {
      this.estado = 'CONFIRMADO';
      await this.save();
      
      // Si está asociado a una factura, actualizar su estado
      if (this.facturaId) {
        const { Factura } = sequelize.models;
        const factura = await Factura.findByPk(this.facturaId);
        
        if (factura) {
          return await factura.registrarPago(this);
        }
      }
      
      return true;
    }
    return false;
  };
  
  Transaccion.prototype.anular = async function(motivo) {
    if (this.estado !== 'ANULADO') {
      const estadoAnterior = this.estado;
      this.estado = 'ANULADO';
      this.notas = this.notas ? `${this.notas}\nANULADO: ${motivo}` : `ANULADO: ${motivo}`;
      await this.save();
      
      // Si estaba confirmado y asociado a una factura, actualizar la factura
      if (estadoAnterior === 'CONFIRMADO' && this.facturaId) {
        const { Factura } = sequelize.models;
        const factura = await Factura.findByPk(this.facturaId);
        
        if (factura) {
          return await factura.anularPago(this);
        }
      }
      
      return true;
    }
    return false;
  };
  
  Transaccion.prototype.getDetallesFormateados = function() {
    const detalle = {
      id: this.id,
      tipo: this.tipo,
      medioPago: this.medioPago,
      monto: this.monto,
      moneda: this.moneda,
      estado: this.estado,
      fecha: this.fechaHora,
      referencia: this.referenciaPago || 'N/A'
    };
    
    // Añadir detalles específicos según el medio de pago
    if (this.medioPago === 'TARJETA_CREDITO' || this.medioPago === 'TARJETA_DEBITO') {
      const datos = this.datosAdicionales || {};
      detalle.tarjeta = {
        tipo: datos.tipoTarjeta || 'N/D',
        ultimos4: datos.ultimos4 || 'xxxx',
        cuotas: this.cuotas
      };
    } else if (this.medioPago === 'TRANSFERENCIA') {
      const datos = this.datosAdicionales || {};
      detalle.transferencia = {
        banco: datos.banco || 'N/D',
        cbu: datos.cbu ? `...${datos.cbu.slice(-4)}` : 'N/D',
        titular: datos.titular || 'N/D'
      };
    } else if (this.medioPago === 'QR' || this.medioPago === 'MERCADOPAGO') {
      detalle.operacion = this.referenciaPago || 'N/D';
    }
    
    return detalle;
  };

  // Hooks
  Transaccion.beforeCreate(async (transaccion) => {
    // Si la transacción es un pago con tarjeta de crédito, validar cuotas
    if (transaccion.medioPago === 'TARJETA_CREDITO' && transaccion.cuotas < 1) {
      transaccion.cuotas = 1;
    }
    
    // Para pagos que no sean en efectivo, establecer estado inicial como PENDIENTE
    if (transaccion.medioPago !== 'EFECTIVO' && !transaccion.estado) {
      transaccion.estado = 'PENDIENTE';
    } else if (transaccion.medioPago === 'EFECTIVO' && !transaccion.estado) {
      // Los pagos en efectivo se confirman automáticamente
      transaccion.estado = 'CONFIRMADO';
    }
  });

  // Métodos estáticos
  Transaccion.findByReferencia = async function(referencia) {
    return await this.findOne({
      where: { referenciaPago: referencia }
    });
  };
  
  Transaccion.obtenerPagosPendientes = async function(sucursalId = null) {
    const where = { 
      estado: 'PENDIENTE' 
    };
    
    if (sucursalId) {
      where.sucursalId = sucursalId;
    }
    
    return await this.findAll({
      where,
      include: [
        {
          association: 'cliente',
          attributes: ['id', 'nombre', 'email', 'telefono']
        },
        {
          association: 'factura',
          attributes: ['id', 'numero', 'tipoComprobante', 'total']
        }
      ],
      order: [['fechaHora', 'DESC']]
    });
  };
  
  Transaccion.obtenerEstadisticas = async function(sucursalId, fechaInicio, fechaFin) {
    const where = {
      sucursalId,
      fechaHora: {
        [sequelize.Sequelize.Op.between]: [fechaInicio, fechaFin]
      },
      estado: 'CONFIRMADO'
    };
    
    // Agrupar por medio de pago
    const estadisticas = await this.findAll({
      attributes: [
        'medioPago',
        [sequelize.fn('COUNT', sequelize.col('id')), 'cantidad'],
        [sequelize.fn('SUM', sequelize.col('monto')), 'total']
      ],
      where,
      group: ['medioPago'],
      raw: true
    });
    
    return estadisticas;
  };

  return Transaccion;
};