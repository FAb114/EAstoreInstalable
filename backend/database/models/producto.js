const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const productoSchema = new mongoose.Schema({
  _id: {
    type: String,
    default: () => uuidv4()
  },
  codigo: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  nombre: {
    type: String,
    required: true,
    trim: true
  },
  descripcion: {
    type: String,
    trim: true
  },
  precio: {
    type: Number,
    required: true,
    min: 0
  },
  costo: {  // <-- antes llamado "precioCompra"
    type: Number,
    default: 0,
    min: 0
  },
  stock: {
    type: Number,
    default: 0,
    min: 0
  },
  stockMinimo: {
    type: Number,
    default: 5,
    min: 0
  },
  categoria: {
    type: String,
    trim: true
  },
  marca: {
    type: String,
    trim: true
  },
  proveedor: {
    type: String,
    ref: 'Proveedor'
  },
  activo: {
    type: Boolean,
    default: true
  },
  impuesto: {
    tipo: {
      type: String,
      enum: ['IVA', 'EXENTO'],
      default: 'IVA'
    },
    porcentaje: {
      type: Number,
      default: 21,
      min: 0
    }
  },
  imagenes: [{
    url: String,
    alt: String
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  versionKey: false
});

// Middleware para actualizar el campo updatedAt antes de cada update
productoSchema.pre('findOneAndUpdate', function(next) {
  this.set({ updatedAt: new Date() });
  next();
});

// Método para calcular el precio con impuestos
productoSchema.methods.precioConImpuestos = function() {
  if (this.impuesto.tipo === 'EXENTO') {
    return this.precio;
  }
  return this.precio * (1 + (this.impuesto.porcentaje / 100));
};

// Método para calcular el margen de ganancia
productoSchema.methods.margenGanancia = function() {
  if (this.costo === 0) {
    return 0;
  }
  return ((this.precio - this.costo) / this.costo) * 100;
};

// Método para verificar si el stock está por debajo del mínimo
productoSchema.methods.stockBajo = function() {
  return this.stock <= this.stockMinimo;
};

// Crear índices para búsquedas rápidas
productoSchema.index({ codigo: 1 });
productoSchema.index({ nombre: 'text', descripcion: 'text' });
productoSchema.index({ categoria: 1 });
productoSchema.index({ marca: 1 });

const Producto = mongoose.model('Producto', productoSchema);

module.exports = Producto;
