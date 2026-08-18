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

exports.obtenerProductosProveedor = async (req, res, next) => {
  try {
    const { id } = req.params;

    const datos = await proveedoresModel.obtenerProductosProveedor(id);

    res.json({
      ok: true,
      total: datos.length,
      datos,
    });
  } catch (error) {
    next(error);
  }
};

exports.asociarProductoProveedor = async (req, res, next) => {
  try {
    const datos = await proveedoresModel.asociarProductoProveedor(req.body);

    res.status(201).json({
      ok: true,
      mensaje: "Producto asociado correctamente.",
      datos,
    });
  } catch (error) {
    // FIX (bug #3 del informe): errores de negocio esperables
    // (duplicado activo) deben volver como 409, no como 500.
    // Ver models/proveedoresModel.js, error `ProductoYaAsociadoError`.
    if (error.status) {
      return res.status(error.status).json({ ok: false, error: error.message });
    }
    next(error);
  }
};

exports.actualizarProductoProveedor = async (req, res, next) => {
  try {
    const datos = await proveedoresModel.actualizarProductoProveedor(req.body);

    res.json({
      ok: true,
      mensaje: "Configuración actualizada correctamente.",
      datos,
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ ok: false, error: error.message });
    }
    next(error);
  }
};

exports.cambiarEstadoProductoProveedor = async (req, res, next) => {
  try {
    const { idProveedor, idProducto, idVariante } = req.params;
    const { activo } = req.body;

    const datos = await proveedoresModel.cambiarEstadoProductoProveedor(
      idProveedor,
      idProducto,
      idVariante === "null" ? null : idVariante,
      activo
    );

    if (!datos) {
      return res.status(404).json({ ok: false, error: 'Relación producto-proveedor no encontrada' });
    }

    res.json({
      ok: true,
      mensaje: "Estado actualizado correctamente.",
      datos,
    });
  } catch (error) {
    next(error);
  }
};