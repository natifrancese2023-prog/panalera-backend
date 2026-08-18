const cuentaCorrienteModel = require("../models/cuentaCorrienteModel");

exports.obtenerCuentaCliente = async (req, res, next) => {
  try {
    const { idCliente } = req.params;
    const cuenta = await cuentaCorrienteModel.obtenerCuentaCliente(idCliente);
    res.json(cuenta);
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    next(error);
  }
};

exports.listarClientesConSaldo = async (req, res, next) => {
  try {
    const clientes = await cuentaCorrienteModel.listarClientesConSaldo();
    res.json(clientes);
  } catch (error) {
    next(error);
  }
};

exports.registrarPago = async (req, res, next) => {
  try {
    const { idCliente } = req.params;
    const { monto, forma_pago, observaciones } = req.body;

    if (!monto || Number(monto) <= 0) {
      return res.status(400).json({ error: "El monto debe ser mayor a 0." });
    }
    if (!forma_pago) {
      return res.status(400).json({ error: "La forma de pago es obligatoria." });
    }

    const movimiento = await cuentaCorrienteModel.registrarPago(idCliente, {
      monto: Number(monto),
      forma_pago,
      observaciones: observaciones || null,
      id_usuario: req.usuario?.id ?? null,
    });

    res.status(201).json({ mensaje: "Pago registrado correctamente.", movimiento });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    next(error);
  }
};