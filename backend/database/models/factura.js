// Modelo de Factura para EAstore
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Factura = sequelize.define('Factura', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    numero: {
      type: DataTypes.STRING,
      unique: true
    },
    tipo: {
      type: DataTypes.ENUM('A', 'B', 'C', 'X'),
      allowNull: false,
      defaultValue: 'B'
    },
    fecha: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    cae: {
      type: DataTypes.STRING,
      comment: 'CAE generado por AFIP/ARCA'
    },
    vencimiento_cae: {
      type: DataTypes.DATE
    },
    punto_venta: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    sucursal_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    subtotal: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false
    },
    iva_21: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0
    },
    iva_10_5: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0
    },
    iva_27: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0
    },
    iva_exento: {
      type: DataTypes.DECIMAL(12, 2),
      defaultValue: 0
    },
    total: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false
    },
    forma_pago: {
      type: DataTypes.ENUM('Efectivo', 'Tarjeta Débito', 'Tarjeta Crédito', 'Transferencia', 'MercadoPago', 'QR'),
      allowNull: false
    },
    estado: {
      type: DataTypes.ENUM('Pendiente', 'Pagada', 'Anulada', 'Rechazada'),
      defaultValue: 'Pendiente'
    },
    afip_enviada: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    observaciones: {
      type: DataTypes.TEXT
    },
    factura_relacionada: {
      type: DataTypes.INTEGER,
      comment: 'Para notas de crédito o débito'
    },
    sync_status: {
      type: DataTypes.ENUM('synced', 'pending', 'error'),
      defaultValue: 'synced'
    }
  });
  
  // Método para generar número de factura 
  Factura.generarNumero = async function(tipo, puntoVenta) {
    // Buscar el último número para este tipo y punto de venta
    const ultimaFactura = await this.findOne({
      where: {
        tipo: tipo,
        punto_venta: puntoVenta
      },
      order: [['numero', 'DESC']]
    });
    
    let ultimoNumero = 0;
    if (ultimaFactura && ultimaFactura.numero) {
      // Extraer el número de factura (último segmento)
      const parts = ultimaFactura.numero.split('-');
      ultimoNumero = parseInt(parts[parts.length - 1], 10);
    }
    
    // Incrementar y formatear
    const nuevoNumero = ultimoNumero + 1;
    return `${puntoVenta.toString().padStart(4, '0')}-${nuevoNumero.toString().padStart(8, '0')}`;
  };
  
  // Método para calcular el total con impuestos
  Factura.prototype.calcularTotal = function() {
    return parseFloat(this.subtotal) +
      parseFloat(this.iva_21) +
      parseFloat(this.iva_10_5) +
      parseFloat(this.iva_27);
  };
  
  // Método para saber si requiere CAE (según método de pago)
  Factura.prototype.requiereCAE = function() {
    // No se fiscalizan pagos en efectivo según el requerimiento
    return this.forma_pago !== 'Efectivo';
  };
  
  return Factura;
};
