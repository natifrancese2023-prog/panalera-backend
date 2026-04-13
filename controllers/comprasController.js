const comprasModel = require('../models/comprasModel');

async function listar(req, res, next) {
  try {
    const compras = await comprasModel.obtenerTodas();
    res.json(compras);
  } catch (err) {
    next(err);
  }
}
async function crear(req, res, next) {
  try {
    const { id_proveedor, forma_pago, estado_pago, observaciones, productos } = req.body;

    if (!id_proveedor) return res.status(400).json({ error: 'El proveedor es obligatorio' });
    if (!productos || productos.length === 0) return res.status(400).json({ error: 'Debe incluir al menos un producto' });

    for (const p of productos) {
      // 🚨 VALIDACIÓN CLAVE: Ahora exigimos id_variante
      if (!p.id_producto || !p.id_variante) {
        return res.status(400).json({ error: 'Falta id_producto o id_variante en un ítem' });
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
    res.status(201).json({ mensaje: 'Compra registrada y stock actualizado', compra });
  } catch (err) {
    next(err);
  }
}
async function detalle(req, res, next) {
  try {
    const { id } = req.params;
    const detalle = await comprasModel.obtenerDetalle(id);
    res.json(detalle);
  } catch (err) {
    next(err);
  }
}

async function actualizarEstadoPago(req, res, next) {
  try {
    const { id } = req.params;
    const { estado_pago, forma_pago } = req.body;
    const estadosValidos = ['pendiente', 'pagado'];

    if (!estadosValidos.includes(estado_pago)) {
      return res.status(400).json({ error: 'Estado de pago inválido' });
    }

    const compra = await comprasModel.actualizarEstadoPago(id, { estado_pago, forma_pago });
    if (!compra) {
      return res.status(404).json({ error: 'Compra no encontrada' });
    }

    res.json({ mensaje: 'Estado de pago actualizado', compra });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listar,
  crear,
  detalle,
  actualizarEstadoPago,
};