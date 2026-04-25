const comprasModel = require('../models/comprasModel');

exports.listar = async (req, res, next) => {
  try {
    const compras = await comprasModel.obtenerTodas();
    res.json(compras);
  } catch (err) {
    next(err);
  }
};

exports.crear = async (req, res, next) => {
  try {
    const { id_proveedor, forma_pago, estado_pago, observaciones, productos } = req.body;

    if (!id_proveedor) return res.status(400).json({ error: 'El proveedor es obligatorio' });
    if (!productos || productos.length === 0) return res.status(400).json({ error: 'Debe incluir al menos un producto' });

    for (const p of productos) {
      // ✅ ADAPTACIÓN: Quitamos la obligatoriedad de id_variante para productos simples
      if (!p.id_producto) {
        return res.status(400).json({ error: 'Falta id_producto en un ítem' });
      }
      if (!p.cantidad || p.cantidad <= 0) return res.status(400).json({ error: 'La cantidad debe ser mayor a 0' });
      if (!p.precio_unitario || p.precio_unitario <= 0) return res.status(400).json({ error: 'El precio debe ser mayor a 0' });
    }

    const compra = await comprasModel.insertar({
      id_proveedor,
      forma_pago,
      estado_pago,
      observaciones,
      productos,
    });
    res.status(201).json({ mensaje: 'Compra registrada correctamente', compra });
  } catch (err) {
    next(err);
  }
};

// ✅ AQUÍ ESTABA EL ERROR: Aseguramos la exportación correcta
exports.detalle = async (req, res, next) => {
  try {
    const { id } = req.params;
    const lineas = await comprasModel.obtenerDetalle(id);
    res.json(lineas);
  } catch (err) {
    next(err);
  }
};

exports.actualizarEstadoPago = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { estado_pago, forma_pago } = req.body;
    const compra = await comprasModel.actualizarEstadoPago(id, estado_pago, forma_pago);
    res.json(compra);
  } catch (err) {
    next(err);
  }
};