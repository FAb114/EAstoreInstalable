// backend/api/productos.js
const express = require('express');
const router = express.Router();
const productoService = require('../services/productos');

// Ruta: Obtener todos los productos (con filtros opcionales en query)
router.get('/', async (req, res) => {
  try {
    const productos = await productoService.buscarProductos(req.query);
    res.json(productos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Ruta: Obtener un producto por ID
router.get('/:id', async (req, res) => {
  try {
    const producto = await productoService.obtenerProductoPorId(req.params.id);
    res.json(producto);
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

// Ruta: Crear un nuevo producto (alta individual)
router.post('/', async (req, res) => {
  try {
    const { nombre, codigo, precio } = req.body;
    console.log("Tiene nombre:", !!req.body.nombre);
    console.log("Tiene código:", !!req.body.codigo);
    console.log("Tiene precio:", !!req.body.precio);
    
    // Validar campos obligatorios
    if (!nombre || !codigo || !precio) {
      return res.status(400).json({ 
        error: "Nombre, código y precio son campos obligatorios" 
      });
    }
    
    const nuevoProducto = await productoService.crearProducto(req.body);
    res.status(201).json(nuevoProducto);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Ruta: Actualizar un producto
router.put('/:id', async (req, res) => {
  try {
    const productoActualizado = await productoService.actualizarProducto(req.params.id, req.body);
    res.json(productoActualizado);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Ruta: Eliminar (desactivar) un producto
router.delete('/:id', async (req, res) => {
  try {
    await productoService.eliminarProducto(req.params.id);
    res.status(204).send();
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Ruta: Ajustar stock de un producto
router.post('/:id/stock', async (req, res) => {
  try {
    const { cantidad, motivo } = req.body;
    const resultado = await productoService.ajustarStock(req.params.id, cantidad, motivo);
    res.json(resultado);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Ruta: Obtener productos con stock bajo
router.get('/stock/bajo', async (req, res) => {
  try {
    const productosBajo = await productoService.obtenerProductosStockBajo();
    res.json(productosBajo);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Ruta: Importar productos (alta masiva)
router.post('/importar', async (req, res) => {
  try {
    const resultado = await productoService.importarProductos(req.body);
    res.json(resultado);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Ruta: Exportar productos
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
