const notaCreditoModel = require('../models/notaCreditoModel');

async function listar(req, res, next) {
  try {
    res.json(await notaCreditoModel.obtenerTodas());
  } catch (err) {
    next(err);
  }
}

async function listarPorCliente(req, res, next) {
  try {
    const id = Number(req.params.id_cliente);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Cliente inválido.' });
    }

    res.json(await notaCreditoModel.obtenerPorCliente(id));
  } catch (err) {
    next(err);
  }
}

module.exports = { listar, listarPorCliente };