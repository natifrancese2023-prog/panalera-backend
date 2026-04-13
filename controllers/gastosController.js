const gastosModel = require('../models/gastosModel');

async function listar(req, res, next) {
  try {
    const gastos = await gastosModel.obtenerTodos();
    res.json(gastos);
  } catch (err) {
    next(err);
  }
}

async function crear(req, res, next) {
  try {
    const { descripcion, categoria, monto, forma_pago, fecha } = req.body;

    if (!descripcion?.trim()) {
      return res.status(400).json({ error: 'La descripción es obligatoria' });
    }
    if (!monto || monto <= 0) {
      return res.status(400).json({ error: 'El monto debe ser mayor a 0' });
    }

    const gasto = await gastosModel.insertar({
      descripcion: descripcion.trim(),
      categoria,
      monto,
      forma_pago,
      fecha,
    });

    res.status(201).json({ mensaje: 'Gasto registrado', gasto });
  } catch (err) {
    next(err);
  }
}

async function actualizar(req, res, next) {
  try {
    const { id } = req.params;
    const { descripcion, categoria, monto, forma_pago, fecha } = req.body;

    if (!descripcion?.trim()) {
      return res.status(400).json({ error: 'La descripción es obligatoria' });
    }
    if (!monto || monto <= 0) {
      return res.status(400).json({ error: 'El monto debe ser mayor a 0' });
    }

    const gasto = await gastosModel.actualizar(id, {
      descripcion: descripcion.trim(),
      categoria,
      monto,
      forma_pago,
      fecha,
    });

    if (!gasto) {
      return res.status(404).json({ error: 'Gasto no encontrado' });
    }

    res.json({ mensaje: 'Gasto actualizado', gasto });
  } catch (err) {
    next(err);
  }
}

async function eliminar(req, res, next) {
  try {
    const { id } = req.params;
    const eliminado = await gastosModel.eliminar(id);

    if (!eliminado) {
      return res.status(404).json({ error: 'Gasto no encontrado' });
    }

    res.json({ mensaje: 'Gasto eliminado' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listar,
  crear,
  actualizar,
  eliminar,
};