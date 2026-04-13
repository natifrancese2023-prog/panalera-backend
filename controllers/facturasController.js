const facturasModel = require('../models/facturasModel');

async function listar(req, res, next) {
  try {
    const facturas = await facturasModel.obtenerTodas();
    res.json(facturas);
  } catch (err) {
    next(err);
  }
}

async function crear(req, res, next) {
  try {
    const { id_pedido, forma_pago, observaciones } = req.body;

    if (!id_pedido) {
      return res.status(400).json({ error: 'El pedido es obligatorio' });
    }
    if (!forma_pago) {
      return res.status(400).json({ error: 'La forma de pago es obligatoria' });
    }

    const factura = await facturasModel.crear({ id_pedido, forma_pago, observaciones });
    res.status(201).json({ mensaje: 'Factura creada', factura });
  } catch (err) {
    if (
      err.message.includes('ya fue facturado') ||
      err.message.includes('debe estar en estado') ||
      err.message.includes('no encontrado')
    ) {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
}

async function obtenerPorId(req, res, next) {
  try {
    const { id } = req.params;
    const factura = await facturasModel.obtenerPorId(id);
    if (!factura) {
      return res.status(404).json({ error: 'Factura no encontrada' });
    }
    res.json(factura);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listar,
  crear,
  obtenerPorId,
};