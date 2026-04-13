const { validationResult } = require('express-validator');
const productosModel = require('../models/productosModel');

async function crearProducto(req, res, next) {
  console.log("=== INICIO DE DEPURACIÓN ===");
  console.log("1. ¿Llegó archivo?:", req.file ? "SÍ ✅" : "NO ❌");
  console.log("2. Body recibido:", req.body);
  try {
    const imagen_url = req.file ? req.file.path : null;

    const productoParaDB = {
      nombre: req.body.nombre,
      descripcion: req.body.descripcion,
      id_categoria: parseInt(req.body.id_categoria),
      imagen_url: imagen_url
    };

    let variantesParaDB = [];
    try {
      if (req.body.variantes) {
        variantesParaDB = typeof req.body.variantes === 'string' 
          ? JSON.parse(req.body.variantes) 
          : req.body.variantes;
      }
    } catch (e) {
      console.error("Error al parsear variantes:", e);
      variantesParaDB = [];
    }

    if (variantesParaDB.length === 0) {
      variantesParaDB.push({
        nombre_variante: 'Único',
        stock: parseInt(req.body.stock) || 0,
        precio_compra: parseFloat(req.body.precio_compra) || 0,
        precio_venta: parseFloat(req.body.precio_venta) || 0
      });
    }

    const resultado = await productosModel.insertarConVariantes(productoParaDB, variantesParaDB);

    res.status(201).json({ 
      mensaje: 'Producto creado con éxito', 
      id: resultado.id_producto 
    });

  } catch (err) {
    console.error("ERROR DETECTADO EN EL BACKEND:", err.message);
    next(err);
  }
}

async function actualizarProducto(req, res, next) {
  try {
    const { id } = req.params;
    const datosActualizar = {
      nombre: req.body.nombre,
      descripcion: req.body.descripcion,
      id_categoria: parseInt(req.body.id_categoria),
      imagen_url: req.file ? req.file.path : req.body.imagen_url, 
    };

    const variantes = typeof req.body.variantes === "string" 
      ? JSON.parse(req.body.variantes) 
      : req.body.variantes;

    const resultado = await productosModel.actualizarConVariantes(id, datosActualizar, variantes);
    res.json({ mensaje: "Producto y variantes actualizados correctamente", resultado });
  } catch (err) {
    next(err);
  }
}

async function eliminarProducto(req, res, next) {
  try {
    const { id } = req.params;
    const eliminado = await productosModel.eliminar(id);
    if (!eliminado) return res.status(404).json({ error: "Producto no encontrado" });
    res.json({ mensaje: "Producto eliminado correctamente" });
  } catch (err) {
    next(err);
  }
}

async function listarProductos(req, res, next) {
  try {
    const productos = await productosModel.obtenerTodosConVariantes();
    res.json(productos);
  } catch (err) {
    next(err);
  }
}

// ✅ CORREGIDO: se agrega campo `categoria` y se usa `id_producto` consistente
async function listarCatalogo(req, res, next) {
  try {
    const productos = await productosModel.obtenerTodosConVariantes();
    const catalogo = productos
      .filter((p) => p.stock_total > 0)
      .map((p) => ({
        id_producto: p.id_producto,   // consistente con el frontend
        nombre: p.nombre,
        descripcion: p.descripcion,
        precio_min: p.precio_min,
        imagen_url: p.imagen_url,
        categoria: p.nombre_categoria, // ✅ necesario para el filtro del catálogo público
        variantes: p.variantes,
      }));
    res.json(catalogo);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  crearProducto,
  actualizarProducto,
  listarProductos,
  listarCatalogo,
  eliminarProducto
};