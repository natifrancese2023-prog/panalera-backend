const ventaModel = require('../models/ventaModel');

const FORMAS_PAGO_VALIDAS = ["efectivo", "debito", "credito", "transferencia", "mercadopago"];

exports.crearVentaDirecta = async (req, res, next) => {
  try {
    const {
      forma_pago,
      observaciones,
      productos,
      id_cliente,
      monto_pagado,
      id_pedido,
    } = req.body;

    if (!forma_pago || !FORMAS_PAGO_VALIDAS.includes(forma_pago)) {
      return res.status(400).json({ error: "Forma de pago inválida." });
    }

    if (monto_pagado !== undefined && monto_pagado !== null) {
      if (!Number.isFinite(Number(monto_pagado)) || Number(monto_pagado) < 0) {
        return res.status(400).json({ error: "El monto pagado no es válido." });
      }
    }

    // null y ausencia significan Venta Directa nueva.
    const tienePedido = id_pedido !== undefined && id_pedido !== null;

    if (tienePedido) {
      if (!Number.isInteger(Number(id_pedido)) || Number(id_pedido) <= 0) {
        return res.status(400).json({ error: "El id_pedido no es válido." });
      }
    } else {
      // En Venta Directa nueva se conserva la validación actual.
      if (!productos || productos.length === 0) {
        return res.status(400).json({ error: "Debe incluir al menos un producto." });
      }

      for (const p of productos) {
        if (!p.id_producto) {
          return res.status(400).json({ error: "Falta id_producto en un ítem." });
        }
        if (!Number.isInteger(p.cantidad) || p.cantidad <= 0) {
          return res.status(400).json({ error: "La cantidad debe ser un número entero mayor que cero." });
        }
        if (!Number.isFinite(Number(p.precio_unitario)) || Number(p.precio_unitario) <= 0) {
          return res.status(400).json({ error: "Precio inválido." });
        }
      }

      const productosRepetidos = new Set();
      for (const p of productos) {
        const clave = `${p.id_producto}-${p.id_variante || 0}`;
        if (productosRepetidos.has(clave)) {
          return res.status(400).json({ error: "Hay productos repetidos en la venta." });
        }
        productosRepetidos.add(clave);
      }
    }

    const resultado = await ventaModel.insertarVentaDirecta({
      forma_pago,
      observaciones,
      // Para Pedido existente el model ignora estos datos y lee PostgreSQL.
      productos: tienePedido ? undefined : productos,
      id_cliente: tienePedido ? undefined : id_cliente,
      monto_pagado,
      id_pedido: tienePedido ? Number(id_pedido) : null,
      id_usuario: req.usuario?.id ?? null,
    });

    res.status(201).json({ mensaje: "Venta registrada correctamente", ...resultado });
  } catch (err) {
    console.error("ERROR EN VENTA DIRECTA:", err.message);

    if (err.status) {
      return res.status(err.status).json({ error: err.message });
    }
    if (err.message.startsWith("Stock insuficiente")) {
      return res.status(409).json({ error: err.message });
    }
    if (
      err.message === "El cliente no existe." ||
      err.message === "Producto o variante inexistente"
    ) {
      return res.status(400).json({ error: err.message });
    }

    next(err);
  }
};
