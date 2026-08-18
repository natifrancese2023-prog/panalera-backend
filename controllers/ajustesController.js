const ajustesModel = require('../models/ajustesModel');

const crearAjuste = async (req, res) => {
  try {
    const { id_motivo, observacion, estado, items } = req.body;
    const id_usuario = req.usuario ? req.usuario.id_usuario : req.body.id_usuario;

    if (!id_motivo) {
      return res.status(400).json({ error: 'El campo id_motivo es obligatorio.' });
    }

    if (!id_usuario) {
      return res.status(400).json({ error: 'El id_usuario es obligatorio.' });
    }

    const resultado = await ajustesModel.crearAjuste({
      id_motivo,
      observacion,
      id_usuario,
      estado,
      items,
    });

    return res.status(201).json({
      mensaje: 'Ajuste de inventario registrado exitosamente.',
      data: resultado,
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

const confirmarBorrador = async (req, res) => {
  try {
    const { id } = req.params;
    const id_usuario = req.usuario ? req.usuario.id_usuario : req.body.id_usuario;

    const resultado = await ajustesModel.confirmarBorrador(id, id_usuario);
    return res.status(200).json(resultado);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

const obtenerTodos = async (req, res) => {
  try {
    const data = await ajustesModel.obtenerTodos();
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

const obtenerDetalle = async (req, res) => {
  try {
    const { id } = req.params;
    const data = await ajustesModel.obtenerDetalle(id);
    if (!data) return res.status(404).json({ error: 'Ajuste no encontrado.' });
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

module.exports = {
  crearAjuste,
  confirmarBorrador,
  obtenerTodos,
  obtenerDetalle,
};