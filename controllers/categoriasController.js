const categoriasModel = require('../models/categoriasModel');

exports.listar = async (req, res, next) => {
  try {
    const categorias = await categoriasModel.obtenerTodas();
    res.json(categorias);
  } catch (err) {
    next(err);
  }
};

exports.crear = async (req, res, next) => {
  try {
    const { nombre } = req.body;

    if (!nombre?.trim()) {
      return res.status(400).json({ error: 'El nombre es obligatorio' });
    }

    // Evitar duplicados
    const existente = await categoriasModel.obtenerPorNombre(nombre.trim());
    if (existente) {
      return res.status(409).json({ error: 'Ya existe una categoría con ese nombre' });
    }

    const categoria = await categoriasModel.insertar(nombre.trim());
    res.status(201).json({ mensaje: 'Categoría creada', categoria });
  } catch (err) {
    next(err);
  }
};

exports.eliminar = async (req, res, next) => {
  try {
    const { id } = req.params;
    const eliminada = await categoriasModel.eliminar(id);

    if (!eliminada) {
      return res.status(404).json({ error: 'Categoría no encontrada' });
    }

    res.json({ mensaje: 'Categoría eliminada' });
  } catch (err) {
    // Si tiene productos asociados Postgres lanza error de FK
    if (err.code === '23503') {
      return res.status(400).json({
        error: 'No se puede eliminar: hay productos asociados a esta categoría'
      });
    }
    next(err);
  }
};