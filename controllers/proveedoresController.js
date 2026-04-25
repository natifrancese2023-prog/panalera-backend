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
    // Quitamos 'email' y 'cuit' de la desestructuración porque no están en tu tabla
    const { nombre, telefono, direccion } = req.body;

    if (!nombre?.trim()) {
      return res.status(400).json({ error: 'El nombre del proveedor es obligatorio' });
    }

    const proveedor = await proveedoresModel.insertar({
      nombre: nombre.trim(),
      telefono,
      direccion
    });

    res.status(201).json({ mensaje: 'Proveedor creado', proveedor });
  } catch (err) {
    next(err);
  }
};

exports.actualizar = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { nombre, telefono, direccion } = req.body;

    if (!nombre?.trim()) {
      return res.status(400).json({ error: 'El nombre del proveedor es obligatorio' });
    }

    const proveedor = await proveedoresModel.actualizar(id, {
      nombre: nombre.trim(),
      telefono,
      direccion
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
    next(err);
  }
};