const facturasModel = require('../models/facturasModel');

async function listar(req, res, next) {
  try {
    res.json(await facturasModel.obtenerTodas());
  } catch (err) {
    next(err);
  }
}

async function obtenerPorId(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'ID de factura inválido.' });
    }

    const factura = await facturasModel.obtenerPorId(id);
    if (!factura) {
      return res.status(404).json({ error: 'Factura no encontrada.' });
    }

    res.json(factura);
  } catch (err) {
    next(err);
  }
}

async function anularFactura(req, res, next) {
  try {
    const id = Number(req.params.id);
    const { motivo, tipo_reversion } = req.body || {};

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'ID de factura inválido.' });
    }

    if (!['dinero', 'nota_credito'].includes(tipo_reversion)) {
      return res.status(400).json({
        error: 'Debés indicar si la devolución es por dinero o nota de crédito.',
      });
    }

    const id_usuario =
      req.usuario?.id_usuario ??
      req.usuario?.id ??
      null;

    const resultado = await facturasModel.anularFactura(id, {
      motivo: motivo || null,
      tipo_reversion,
      id_usuario,
    });

    res.json({
      mensaje:
        tipo_reversion === 'dinero'
          ? 'Factura anulada y dinero devuelto correctamente.'
          : 'Factura anulada y nota de crédito generada correctamente.',
      ...resultado,
    });
  } catch (err) {
    console.error('ERROR AL ANULAR FACTURA:', err);

    if (err.status) {
      return res.status(err.status).json({ error: err.message });
    }

    return res.status(409).json({
      error: err.message || 'No se pudo anular la factura.',
    });
  }
}

module.exports = {
  listar,
  obtenerPorId,
  anularFactura,
};
