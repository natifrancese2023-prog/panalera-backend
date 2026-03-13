const { validationResult } = require('express-validator');
const productosModel = require('../models/productosModel');

exports.listarProductos = async (req, res, next) => {
  try {
    const productos = await productosModel.obtenerTodos();
    res.json(productos);
  } catch (err) {
    next(err);
  }
};

exports.crearProducto = async (req, res, next) => {
  const errores = validationResult(req);
  if (!errores.isEmpty()) {
    return res.status(400).json({ errores: errores.array() });
  }

  try {
    const { nombre, id_categoria } = req.body;

    // Verificar duplicado por nombre + categoría
    const existente = await productosModel.obtenerPorNombreYCategoria(nombre, id_categoria);
    if (existente) {
      return res.status(409).json({ error: 'Ya existe un producto con ese nombre en esa categoría' });
    }

    const producto = await productosModel.insertar(req.body);
    res.status(201).json({ mensaje: 'Producto creado', producto });
  } catch (err) {
    next(err);
  }


};
exports.actualizarProducto = async (req, res, next) => {
  const errores = validationResult(req);
  if (!errores.isEmpty()) {
    return res.status(400).json({ errores: errores.array() });
  }

  try {
    const { id } = req.params;
    const producto = await productosModel.actualizar(id, req.body);

    if (!producto) {
      return res.status(404).json({ error: 'Producto no encontrado' });
    }

    res.json({ mensaje: 'Producto actualizado', producto });
  } catch (err) {
    next(err);
  }
};

exports.eliminarProducto = async (req, res, next) => {
  try {
    const { id } = req.params;
    const eliminado = await productosModel.eliminar(id);

    if (!eliminado) {
      return res.status(404).json({ error: "Producto no encontrado" });
    }

    res.json({ mensaje: "Producto eliminado correctamente", producto: eliminado });
  } catch (err) {
    next(err);
  }
};



