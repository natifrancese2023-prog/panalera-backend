const proveedoresModel = require('../models/proveedoresModel');

exports.listar = async (req, res, next) => {
  try {
    const proveedores = await proveedoresModel.obtenerTodos();
    res.json(proveedores);
  } catch (err) {
    next(err);
  }
};

exports.obtenerPorId = async (req, res, next) => {
  try {
    const { id } = req.params;
    const proveedor = await proveedoresModel.obtenerPorId(id);

    if (!proveedor) {
      return res.status(404).json({ error: 'Proveedor no encontrado' });
    }

    res.json(proveedor);
  } catch (err) {
    next(err);
  }
};

exports.crear = async (req, res, next) => {
  try {
    const { nombre, telefono, email, direccion, cuit } = req.body;

    if (!nombre?.trim()) {
      return res.status(400).json({ error: 'El nombre del proveedor es obligatorio' });
    }

    const proveedor = await proveedoresModel.insertar({
      nombre: nombre.trim(),
      telefono,
      email,
      direccion,
      cuit
    });

    res.status(201).json({ mensaje: 'Proveedor creado', proveedor });
  } catch (err) {
    next(err);
  }
};

exports.actualizar = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { nombre, telefono, email, direccion, cuit } = req.body;

    if (!nombre?.trim()) {
      return res.status(400).json({ error: 'El nombre del proveedor es obligatorio' });
    }

    const proveedor = await proveedoresModel.actualizar(id, {
      nombre: nombre.trim(),
      telefono,
      email,
      direccion,
      cuit
    });

    if (!proveedor) {
      return res.status(404).json({ error: 'Proveedor no encontrado' });
    }

    res.json({ mensaje: 'Proveedor actualizado', proveedor });
  } catch (err) {
    next(err);
  }
};

exports.eliminar = async (req, res, next) => {
  try {
    const { id } = req.params;
    const eliminado = await proveedoresModel.eliminar(id);

    if (!eliminado) {
      return res.status(404).json({ error: 'Proveedor no encontrado' });
    }

    res.json({ mensaje: 'Proveedor eliminado' });
  } catch (err) {
    // Si tiene compras asociadas Postgres lanza error de FK
    if (err.code === '23503') {
      return res.status(400).json({
        error: 'No se puede eliminar: hay compras asociadas a este proveedor'
      });
    }
    next(err);
  }
};