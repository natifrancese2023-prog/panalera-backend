const facturasModel = require('../models/facturasModel');

async function listar(req, res, next) {
  try {
    const facturas = await facturasModel.obtenerTodas();
    res.json(facturas);
  } catch (err) {
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
const anularFactura = async (req, res) => {
  try {
    const { id } = req.params;
    const { motivo } = req.body;
    // Si tu middleware de auth adjunta el usuario al request:
    const id_usuario = req.usuario ? req.usuario.id_usuario : null;

    const facturaAnulada = await facturasModel.anularFactura(id, { motivo, id_usuario });

    return res.status(200).json({
      mensaje: 'Factura anulada correctamente',
      factura: facturaAnulada,
    });
  } catch (error) {
    return res.status(400).json({
      error: error.message || 'Error al anular la factura',
    });
  }
};
module.exports = {
  listar,
  obtenerPorId,
  anularFactura
};