// backend/index.js
const express = require('express');
const cors = require('cors');
const app = express();

// Habilitar CORS y JSON
app.use(cors());
app.use(express.json());

// Importar las rutas de productos
const productosRouter = require('./api/productos');
app.use('/api/productos', productosRouter);

// Rutas para otros servicios (ej: afip, mercadopago, whatsapp) pueden agregarse aquí

// Ruta de Health Check para sincronización
app.get('/api/health', (req, res) => {
  res.send('API funcionando correctamente');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
