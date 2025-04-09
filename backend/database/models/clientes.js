// Modelo de Cliente para EAstore
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Cliente = sequelize.define('Cliente', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },
    nombre: {
      type: DataTypes.STRING,
      allowNull: false
    },
    tipo_documento: {
      type: DataTypes.ENUM('DNI', 'CUIT', 'CUIL', 'Pasaporte'),
      defaultValue: 'DNI'
    },
    numero_documento: {
      type: DataTypes.STRING,
      unique: true
    },
    email: {
      type: DataTypes.STRING,
      validate: {
        isEmail: true
      }
    },
    telefono: {
      type: DataTypes.STRING
    },
    direccion: {
      type: DataTypes.STRING
    },
    localidad: {
      type: DataTypes.STRING
    },
    provincia: {
      type: DataTypes.STRING
    },
    codigo_postal: {
      type: DataTypes.STRING
    },
    condicion_iva: {
      type: DataTypes.ENUM('Consumidor Final', 'Responsable Inscripto', 'Monotributista', 'Exento'),
      defaultValue: 'Consumidor Final'
    },
    notas: {
      type: DataTypes.TEXT
    },
    fecha_alta: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    },
    ultima_compra: {
      type: DataTypes.DATE
    },
    activo: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    sync_status: {
      type: DataTypes.ENUM('synced', 'pending', 'error'),
      defaultValue: 'synced'
    }
  });
  
  // Método para filtrar clientes
  Cliente.buscarPorDocumento = async function(numeroDoc) {
    return await this.findOne({
      where: {
        numero_documento: numeroDoc
      }
    });
  };
  
  // Método para verificar si necesita datos adicionales según ARCA/AFIP
  Cliente.requiereDatosAdicionales = function(montoFactura, condicionIva) {
    // Montos para consumidor final sin datos según AFIP/ARCA
    const montoLimite = condicionIva === 'Consumidor Final' ? 39000 : 0;
    return montoFactura > montoLimite;
  };
  
  return Cliente;
};
