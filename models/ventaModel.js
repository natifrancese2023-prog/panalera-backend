// models/ventaModel.js
const pool = require('../db');
const stockService = require('../services/stockService');
const cuentaCorrienteModel = require('./cuentaCorrienteModel');
const cajaModel = require('./cajaModel');
const { AppError } = require('./errors');

// FIX: esta constante se usaba en el código pero había dejado de estar
// declarada -- cualquier venta sin id_cliente explícito rompía con
// ReferenceError antes de llegar a hacer nada.
const CONSUMIDOR_FINAL_ID = 2;

const insertarVentaDirecta = async ({ forma_pago, observaciones, productos, id_cliente, monto_pagado, id_usuario = null }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const idClienteFinal = id_cliente || CONSUMIDOR_FINAL_ID;

    const clienteExiste = await client.query(
      `SELECT id_usuario FROM usuario WHERE id_usuario = $1`,
      [idClienteFinal]
    );
    if (clienteExiste.rowCount === 0) {
      throw new Error("El cliente no existe.");
    }

    // FASE 2 -- Cuenta corriente: Consumidor Final es anónimo por
    // definición, no puede quedar debiendo. Si se intenta una venta a
    // Consumidor Final con pago parcial/nulo, se rechaza acá mismo,
    // antes de tocar nada más.
    const esConsumidorFinal = idClienteFinal === CONSUMIDOR_FINAL_ID;

    const pedidoRes = await client.query(
      `INSERT INTO public.pedido (id_cliente, estado, total)
       VALUES ($1, 'facturado', 0) RETURNING *`,
      [idClienteFinal]
    );
    const pedido = pedidoRes.rows[0];

    let totalAcumulado = 0;

    for (const p of productos) {
      // FIX: la consulta anterior no tenía FROM para el caso "producto
      // sin variante" (referenciaba "precio_venta" sin ninguna tabla),
      // lo que rompía con un error de SQL en cualquier venta de un
      // producto simple. Se usa esta consulta ÚNICAMENTE para confirmar
      // que el producto/variante existe -- el precio que se cobra es
      // el que mandó el frontend (p.precio_unitario), ya validado como
      // número positivo por el controller. El precio de catálogo queda
      // como referencia de existencia, no pisa el precio editado.
const catalogoRes = await client.query(
  `
  SELECT
    pr.id_producto,
    pv.id_variante,
    pv.precio_venta AS precio_catalogo
  FROM producto pr
  INNER JOIN producto_variantes pv
    ON pv.id_producto = pr.id_producto
  WHERE pr.id_producto = $1
    AND pv.id_variante = $2
  `,
  [
    p.id_producto,
    p.id_variante
  ]
);
      if (catalogoRes.rowCount === 0) {
        throw new Error("Producto o variante inexistente");
      }

      const precioUnitario = Number(p.precio_unitario);
      const subtotal = precioUnitario * p.cantidad;
      totalAcumulado += subtotal;

      await client.query(
        `
        INSERT INTO public.detallepedido
          (id_pedido, id_producto, id_variante, cantidad, precio_unitario, subtotal)
        VALUES ($1,$2,$3,$4,$5,$6)
        `,
        [
          pedido.id_pedido,
          p.id_producto,
          p.id_variante ,
          p.cantidad,
          precioUnitario,
          subtotal,
        ]
      );

      // Descuento reutilizando el servicio de stock (único método
      // habilitado para tocar stock/kardex -- sin cambios acá).
      await stockService.aplicarMovimientoStock({
        client,
        id_producto: p.id_producto,
        id_variante: p.id_variante ,
        cantidad: p.cantidad,
        operacion: stockService.OPERACIONES_STOCK.DESCUENTO,
        tipoMovimiento: stockService.TIPOS_MOVIMIENTO.VENTA,
        origen: { tipo: 'VENTA_DIRECTA', id: pedido.id_pedido },
        metadata: {},
      });
    }

    await client.query(
      'UPDATE public.pedido SET total = $1 WHERE id_pedido = $2',
      [totalAcumulado, pedido.id_pedido]
    );

    // FASE 2 -- Cuenta corriente
    // monto_pagado no viene -> se asume contado (compatibilidad con
    // las ventas existentes, que siempre cobraban el total).
    // monto_pagado === total -> contado, sin movimiento de cuenta corriente.
    // monto_pagado === 0 -> cuenta corriente completa.
    // 0 < monto_pagado < total -> entrega parcial: se registran AMBOS
    // movimientos (la deuda total y el pago de la entrega), dejando el
    // saldo neto correcto sin que Cuenta Corriente dependa de Caja
    // (que todavía no existe -- Fase 3).
    const montoPagadoFinal =
      monto_pagado === undefined || monto_pagado === null
        ? totalAcumulado
        : Number(monto_pagado);

    if (montoPagadoFinal < 0 || montoPagadoFinal > totalAcumulado) {
      throw new AppError(
        "El monto pagado no puede ser negativo ni mayor al total de la venta.",
        400
      );
    }

    if (montoPagadoFinal < totalAcumulado && esConsumidorFinal) {
      throw new AppError(
        "Consumidor Final no puede quedar con saldo pendiente. Seleccioná un cliente registrado para vender a cuenta corriente.",
        400
      );
    }

    if (montoPagadoFinal < totalAcumulado) {
      await cuentaCorrienteModel.registrarMovimiento(client, {
        id_cliente: idClienteFinal,
        tipo: "venta",
        monto: totalAcumulado,
        id_pedido: pedido.id_pedido,
        forma_pago,
        id_usuario,
      });

      if (montoPagadoFinal > 0) {
        await cuentaCorrienteModel.registrarMovimiento(client, {
          id_cliente: idClienteFinal,
          tipo: "pago",
          monto: montoPagadoFinal,
          id_pedido: pedido.id_pedido,
          forma_pago,
          observaciones: "Entrega al momento de la venta",
          id_usuario,
        });
      }
    }

    // FASE 3 -- Caja: se registra lo que efectivamente se cobró en el
    // momento (montoPagadoFinal), no el total de la venta -- si una
    // parte quedó a cuenta corriente, esa parte todavía no es plata
    // que entró a la caja. Si no hay caja abierta, no bloquea la venta
    // (ver comentario en cajaModel.registrarMovimiento).
    if (montoPagadoFinal > 0) {
      await cajaModel.registrarMovimiento(client, {
        tipo: "ingreso",
        origen: "venta",
        forma_pago,
        monto: montoPagadoFinal,
        id_referencia: pedido.id_pedido,
        id_usuario,
      });
    }

    const facturaExistente = await client.query(
      `SELECT id_factura FROM factura WHERE id_pedido = $1`,
      [pedido.id_pedido]
    );
    if (facturaExistente.rowCount > 0) {
      throw new Error("El pedido ya posee una factura.");
    }

    const facturaRes = await client.query(
      `INSERT INTO public.factura (id_pedido, forma_pago, total, observaciones)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [pedido.id_pedido, forma_pago, totalAcumulado, observaciones || null]
    );

    await client.query('COMMIT');
    return { pedido: { ...pedido, total: totalAcumulado }, factura: facturaRes.rows[0] };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

module.exports = { insertarVentaDirecta, CONSUMIDOR_FINAL_ID };