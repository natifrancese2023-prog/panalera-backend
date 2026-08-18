const cajaModel = require("../models/cajaModel");

exports.obtenerAbierta = async (req, res, next) => {
  try {
    const caja = await cajaModel.obtenerCajaAbierta();
    if (!caja) {
      return res.status(404).json({ error: "No hay ninguna caja abierta." });
    }
    const estado = await cajaModel.obtenerEstadoCaja(caja.id_caja);
    res.json(estado);
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    next(error);
  }
};
exports.abrir = async (req, res, next) => {
  try {
    const {
      saldo_inicial,
      saldo_contado,
    } = req.body;

    const caja = await cajaModel.abrirCaja({
      saldo_inicial,
      saldo_contado,
      id_usuario: req.usuario?.id ?? null,
    });

    res.status(201).json({
      mensaje: "Caja abierta.",
      caja,
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({
        error: error.message,
      });
    }

    next(error);
  }
};
exports.obtenerUltimaCerrada = async (req, res, next) => {
  try {
    const caja = await cajaModel.obtenerUltimaCajaCerrada();

    if (!caja) {
      return res.status(404).json({
        error: "No existe un cierre anterior.",
      });
    }

    res.json(caja);
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({
        error: error.message,
      });
    }

    next(error);
  }
};
exports.obtenerEstado = async (req, res, next) => {
  try {
    const { id } = req.params;
    const estado = await cajaModel.obtenerEstadoCaja(id);
    res.json(estado);
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    next(error);
  }
};

exports.registrarRetiro = async (req, res, next) => {
  try {
    const { monto, observaciones } = req.body;
    const movimiento = await cajaModel.registrarRetiro({
      monto: Number(monto),
      observaciones,
      id_usuario: req.usuario?.id ?? null,
    });
    res.status(201).json({ mensaje: "Retiro registrado.", movimiento });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    next(error);
  }
};

exports.cerrar = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { saldo_contado } = req.body;
    const resultado = await cajaModel.cerrarCaja(id, {
      saldo_contado: Number(saldo_contado),
      id_usuario: req.usuario?.id ?? null,
    });
    res.json({ mensaje: "Caja cerrada.", ...resultado });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ error: error.message });
    next(error);
  }
};
exports.listarHistorial = async (req, res, next) => {
  try {
    const cajas = await cajaModel.listarHistorialCajas();

    return res.status(200).json(cajas);
  } catch (error) {
    console.error("ERROR EN /caja/historial:", error);

    if (error.status) {
      return res.status(error.status).json({
        error: error.message,
      });
    }

    return next(error);
  }
};