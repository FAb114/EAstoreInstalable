const express = require('express');
const router = express.Router();
const productoService = require('../services/productos');

// Obtener todos los productos (con filtro opcional)
router.get('/', async (req, res) => {
  try {
    const productos = await productoService.buscarProductos(req.query);
    res.json(productos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener producto por ID
router.get('/:id', async (req, res) => {
  try {
    const producto = await productoService.obtenerProductoPorId(req.params.id);
    res.json(producto);
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

// Crear producto
router.post('/', async (req, res) => {
  try {
    const nuevoProducto = await productoService.crearProducto(req.body);
    res.status(201).json(nuevoProducto);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Actualizar producto
router.put('/:id', async (req, res) => {
  try {
    const producto = await productoService.actualizarProducto(req.params.id, req.body);
    res.json(producto);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Eliminar (desactivar) producto
router.delete('/:id', async (req, res) => {
  try {
    await productoService.eliminarProducto(req.params.id);
    res.status(204).send();
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Ajustar stock
router.post('/:id/stock', async (req, res) => {
  try {
    const { cantidad, motivo } = req.body;
    const resultado = await productoService.ajustarStock(req.params.id, cantidad, motivo);
    res.json(resultado);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Productos con stock bajo
router.get('/stock/bajo', async (req, res) => {
  try {
    const productos = await productoService.obtenerProductosStockBajo();
    res.json(productos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Importar productos
router.post('/importar', async (req, res) => {
  try {
    const resultado = await productoService.importarProductos(req.body);
    res.json(resultado);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Exportar productos
router.get('/exportar', async (req, res) => {
  try {
    const { formato = 'csv' } = req.query;
    const datos = await productoService.exportarProductos(formato);
    res.setHeader('Content-Disposition', `attachment; filename=productos.${formato}`);
    res.send(datos);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
