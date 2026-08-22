const pool = require('../db');
const stockService = require('../services/stockService');
const cuentaCorrienteModel = require('./cuentaCorrienteModel');
const cajaModel = require('./cajaModel');
const notaCreditoModel = require('./notaCreditoModel');
const { AppError } = require('./errors');

const crear = async ({ id_pedido, forma_pago, observaciones }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const pedidoRes = await client.query(
      'SELECT * FROM public.pedido WHERE id_pedido = $1 FOR UPDATE',
      [id_pedido],
    );
    const pedido = pedidoRes.rows[0];
    if (!pedido) throw new AppError('Pedido no encontrado.', 404);

    if (pedido.estado !== 'entregado') {
      throw new AppError('El pedido debe estar en estado entregado para facturar.', 409);
    }

    const facturaExistente = await client.query(
      'SELECT id_factura FROM public.factura WHERE id_pedido = $1',
      [id_pedido],
    );
    if (facturaExistente.rowCount > 0) {
      throw new AppError('Este pedido ya fue facturado.', 409);
    }

    throw new AppError(
      'La creación de facturas de ventas debe realizarse mediante Cobrar/Venta Directa.',
      409,
    );
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const obtenerTodas = async () => {
  const result = await pool.query(`
    SELECT
      f.*,
      p.id_pedido,
      p.id_cliente,
      p.estado AS pedido_estado,
      u.nombre AS cliente_nombre,
      u.apellido AS cliente_apellido,
      u.email AS cliente_email
    FROM public.factura f
    JOIN public.pedido p ON p.id_pedido = f.id_pedido
    JOIN public.usuario u ON u.id_usuario = p.id_cliente
    ORDER BY f.fecha DESC
  `);
  return result.rows;
};
const obtenerPorId = async (id) => {
  const facturaResult = await pool.query(`
    SELECT
      f.*,
      u.nombre AS cliente_nombre,
      u.apellido AS cliente_apellido,
      u.email AS cliente_email
    FROM factura f
    JOIN pedido p ON p.id_pedido = f.id_pedido
    JOIN usuario u ON u.id_usuario = p.id_cliente
    WHERE f.id_factura = $1
  `, [id]);

  const factura = facturaResult.rows[0];

  if (!factura) {
    return null;
  }

  const detalleResult = await pool.query(`
    SELECT
      dp.id_detalle,
      dp.id_producto,
      dp.id_variante,
      pr.nombre AS nombre_producto,
      pv.nombre_variante,
      dp.cantidad,
      dp.precio_unitario,
      dp.subtotal
    FROM detallepedido dp
    JOIN producto pr
      ON pr.id_producto = dp.id_producto
    LEFT JOIN producto_variantes pv
      ON pv.id_variante = dp.id_variante
    WHERE dp.id_pedido = $1
    ORDER BY dp.id_detalle
  `, [factura.id_pedido]);

  return {
    ...factura,
    detalle: detalleResult.rows
  };
};
const anularFactura = async (
  id_factura,
  {
    motivo = null,
    tipo_reversion = 'dinero',
    id_usuario = null,
  } = {},
) => {
  if (!['dinero', 'nota_credito'].includes(tipo_reversion)) {
    throw new AppError('Tipo de reversión inválido.', 400);
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const facturaRes = await client.query(
      `SELECT *
         FROM public.factura
        WHERE id_factura = $1
        FOR UPDATE`,
      [id_factura],
    );

    if (facturaRes.rowCount === 0) {
      throw new AppError('La factura no existe.', 404);
    }

    const factura = facturaRes.rows[0];

    if (factura.estado === 'anulada') {
      throw new AppError('La factura ya se encuentra anulada.', 409);
    }

    // Bloquear el Pedido para impedir una operación concurrente sobre la misma venta.
    const pedidoRes = await client.query(
      `SELECT *
         FROM public.pedido
        WHERE id_pedido = $1
        FOR UPDATE`,
      [factura.id_pedido],
    );

    if (pedidoRes.rowCount === 0) {
      throw new AppError('El pedido asociado a la factura no existe.', 409);
    }

    const pedido = pedidoRes.rows[0];

    const detallesRes = await client.query(`
      SELECT
        dp.id_producto,
        dp.id_variante,
        dp.cantidad,
        dp.precio_unitario,
        dp.subtotal
      FROM public.detallepedido dp
      WHERE dp.id_pedido = $1
      ORDER BY dp.id_detalle ASC
    `, [pedido.id_pedido]);

    if (detallesRes.rowCount === 0) {
      throw new AppError('La factura no tiene productos asociados para devolver.', 409);
    }

    // Los pagos posteriores de Cuenta Corriente no tienen id_pedido.
    // Si existen después de esta factura, no podemos atribuirlos inequívocamente
    // a esta venta. Se bloquea la anulación para evitar una devolución incorrecta.
    const pagosPosterioresRes = await client.query(`
      SELECT id_movimiento, monto, fecha
      FROM public.cuenta_corriente_movimiento
      WHERE id_cliente = $1
        AND id_pedido IS NULL
        AND tipo = 'pago'
        AND fecha > $2
      LIMIT 1
    `, [pedido.id_cliente, factura.fecha]);

    if (pagosPosterioresRes.rowCount > 0) {
      throw new AppError(
        'No se puede anular esta factura porque el cliente tiene pagos posteriores de Cuenta Corriente que no están asociados a una factura específica.',
        409,
      );
    }

    // Movimientos de Cuenta Corriente generados originalmente por esta venta.
    const ccRes = await client.query(`
      SELECT *
      FROM public.cuenta_corriente_movimiento
      WHERE id_pedido = $1
      ORDER BY fecha ASC, id_movimiento ASC
      FOR UPDATE
    `, [pedido.id_pedido]);

    const movimientosCC = ccRes.rows;
    const movimientoVenta = movimientosCC.filter((m) => m.tipo === 'venta');
    const movimientosPago = movimientosCC.filter((m) => m.tipo === 'pago');

    // En Venta Directa, si existe movimiento "venta" en CC significa que hubo
    // saldo pendiente. Si no existe, la venta se consideró totalmente pagada.
    const deudaOriginal = movimientoVenta.reduce(
      (sum, m) => sum + Number(m.monto),
      0,
    );

    const pagadoInicial = movimientoPago.reduce(
      (sum, m) => sum + Number(m.monto),
      0,
    );

    const totalFactura = Number(factura.total);
    const montoPagado = deudaOriginal > 0
      ? pagadoInicial
      : totalFactura;

    if (!Number.isFinite(totalFactura) || totalFactura < 0) {
      throw new AppError('El total de la factura no es válido.', 409);
    }

    // Si se generó Caja en la venta original, la consultamos para conservar
    // la forma de pago real registrada en Caja.
    const cajaOriginalRes = await client.query(`
      SELECT forma_pago, COALESCE(SUM(monto), 0) AS monto
      FROM public.caja_movimiento
      WHERE origen = 'venta'
        AND id_referencia = $1
        AND tipo = 'ingreso'
      GROUP BY forma_pago
      ORDER BY SUM(monto) DESC
    `, [pedido.id_pedido]);

    const montoCajaOriginal = cajaOriginalRes.rows.reduce(
      (sum, m) => sum + Number(m.monto),
      0,
    );

    const formaPagoDevolucion =
      cajaOriginalRes.rows[0]?.forma_pago || factura.forma_pago;

    // 1) DEVOLVER STOCK.
    // La operación es inversa y queda registrada como un nuevo Kardex.
    // No se borra ni modifica el movimiento original.
    const tipoMovimientoAnulacion =
      stockService.TIPOS_MOVIMIENTO.ANULACION ??
      stockService.TIPOS_MOVIMIENTO.DEVOLUCION ??
      stockService.TIPOS_MOVIMIENTO.PEDIDO_CANCELACION;

    if (!tipoMovimientoAnulacion) {
      throw new AppError(
        'El sistema de Stock no tiene definido un tipo de movimiento para anulaciones/devoluciones.',
        500,
      );
    }

    const kardexOriginales = await client.query(`
      SELECT id_kardex, id_producto, id_variante, cantidad
      FROM public.kardex
      WHERE origen_id = $1
        AND origen_tipo IN ('PEDIDO', 'VENTA_DIRECTA')
      ORDER BY id_kardex ASC
    `, [pedido.id_pedido]);

    for (const detalle of detallesRes.rows) {
      const original = kardexOriginales.rows.find(
        (k) =>
          Number(k.id_producto) === Number(detalle.id_producto) &&
          Number(k.id_variante || 0) === Number(detalle.id_variante || 0) &&
          Number(k.cantidad) === Number(detalle.cantidad),
      );

      await stockService.aplicarMovimientoStock({
        client,
        id_producto: detalle.id_producto,
        id_variante: detalle.id_variante || null,
        cantidad: Number(detalle.cantidad),
        operacion: stockService.OPERACIONES_STOCK.DEVOLUCION,
        tipoMovimiento: tipoMovimientoAnulacion,
        origen: { tipo: 'ANULACION_FACTURA', id: Number(id_factura) },
        metadata: {
          id_usuario,
          id_movimiento_relacionado: original?.id_kardex || null,
          motivo: motivo || `Devolución por anulación de factura #${id_factura}`,
        },
      });
    }

    // 2) REVERTIR CUENTA CORRIENTE.
    // venta (+ deuda) -> pago compensatorio
    // pago (- deuda)  -> venta compensatoria
    for (const movimiento of movimientoVenta) {
      await cuentaCorrienteModel.registrarMovimiento(client, {
        id_cliente: pedido.id_cliente,
        tipo: 'pago',
        monto: Number(movimiento.monto),
        id_pedido: pedido.id_pedido,
        forma_pago: movimiento.forma_pago,
        observaciones: `Reversión por anulación de factura #${id_factura}`,
        id_usuario,
      });
    }

    for (const movimiento of movimientosPago) {
      await cuentaCorrienteModel.registrarMovimiento(client, {
        id_cliente: pedido.id_cliente,
        tipo: 'venta',
        monto: Number(movimiento.monto),
        id_pedido: pedido.id_pedido,
        forma_pago: movimiento.forma_pago,
        observaciones: `Reversión del pago inicial por anulación de factura #${id_factura}`,
        id_usuario,
      });
    }

    let movimientoCaja = null;
    let notaCredito = null;

    // 3) DINERO: sacar de Caja exactamente lo que se había cobrado.
    if (tipo_reversion === 'dinero' && montoPagado > 0) {
      const cajaAbierta = await cajaModel.obtenerCajaAbierta(client);
      if (!cajaAbierta) {
        throw new AppError(
          'No hay una caja abierta para registrar la devolución de dinero.',
          409,
        );
      }

      movimientoCaja = await cajaModel.registrarMovimiento(client, {
        tipo: 'egreso',
        origen: 'devolucion_factura',
        forma_pago: formaPagoDevolucion,
        monto: montoPagado,
        id_referencia: Number(id_factura),
        observaciones: motivo || `Devolución por anulación de factura #${id_factura}`,
        id_usuario,
      });

      if (!movimientoCaja) {
        throw new AppError('No se pudo registrar la devolución en Caja.', 409);
      }
    }

    // 4) NOTA DE CRÉDITO: el dinero no sale de Caja.
    // El crédito representa solamente el importe efectivamente pagado.
    if (tipo_reversion === 'nota_credito' && montoPagado > 0) {
      notaCredito = await notaCreditoModel.crear(client, {
        id_cliente: pedido.id_cliente,
        id_factura: Number(id_factura),
        monto: montoPagado,
        motivo: motivo || `Nota de crédito por anulación de factura #${id_factura}`,
        id_usuario,
        detalles: detallesRes.rows,
      });
    }

    // 5) Marcar factura como anulada.
    const resAnulada = await client.query(
      `UPDATE public.factura
          SET estado = 'anulada',
              motivo_anulacion = $1,
              fecha_anulacion = NOW(),
              id_usuario_anulacion = $2
        WHERE id_factura = $3
        RETURNING *`,
      [motivo, id_usuario, id_factura],
    );

    await client.query('COMMIT');

    return {
      factura: resAnulada.rows[0],
      stock_devuelto: detallesRes.rows.reduce((sum, d) => sum + Number(d.cantidad), 0),
      monto_pagado_devuelto_o_acreditado: montoPagado,
      movimiento_caja: movimientoCaja,
      nota_credito: notaCredito,
      forma_pago_original: formaPagoDevolucion,
      monto_caja_original: montoCajaOriginal,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  crear,
  obtenerTodas,
  obtenerPorId,
  anularFactura,
};
