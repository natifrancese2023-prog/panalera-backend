// models/ventaModel.js
const pool = require('../db');
const stockService = require('../services/stockService');
const cuentaCorrienteModel = require('./cuentaCorrienteModel');
const cajaModel = require('./cajaModel');
const { AppError } = require('./errors');

const CONSUMIDOR_FINAL_ID = 2;

const insertarVentaDirecta = async ({
  forma_pago,
  observaciones,
  productos,
  id_cliente,
  monto_pagado,
  id_pedido = null,
  id_usuario = null,
}) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // ============================================================
    // DOS ORÍGENES DE LA MISMA CONCRECIÓN ECONÓMICA
    //
    // id_pedido ausente/null -> Venta Directa nueva.
    // id_pedido presente      -> cobrar Pedido existente.
    // ============================================================
    const tienePedidoExistente = id_pedido !== undefined && id_pedido !== null;

    let pedido;
    let idClienteFinal;
    let totalAcumulado;
    let esConsumidorFinal;

    if (tienePedidoExistente) {
      // ----------------------------------------------------------
      // PEDIDO EXISTENTE: bloquear primero para evitar doble cobro.
      // ----------------------------------------------------------
      const pedidoRes = await client.query(
        `SELECT *
         FROM public.pedido
         WHERE id_pedido = $1
         FOR UPDATE`,
        [id_pedido]
      );

      if (pedidoRes.rowCount === 0) {
        throw new AppError('Pedido no encontrado.', 404);
      }

      pedido = pedidoRes.rows[0];

      if (pedido.estado !== 'entregado') {
        throw new AppError(
          'El pedido debe estar en estado entregado para poder cobrarlo.',
          409
        );
      }

      // No confiar en ningún cliente enviado por frontend.
      idClienteFinal = pedido.id_cliente;

      const clienteExiste = await client.query(
        `SELECT id_usuario
         FROM public.usuario
         WHERE id_usuario = $1
           AND rol = 'cliente'`,
        [idClienteFinal]
      );

      if (clienteExiste.rowCount === 0) {
        throw new AppError('El cliente del pedido no existe.', 409);
      }

      // La factura es una segunda barrera contra doble concreción.
      const facturaExistente = await client.query(
        `SELECT id_factura
         FROM public.factura
         WHERE id_pedido = $1`,
        [pedido.id_pedido]
      );

      if (facturaExistente.rowCount > 0) {
        throw new AppError('El pedido ya posee una factura.', 409);
      }

      // Los detalles reales salen de PostgreSQL. Nunca del frontend.
      const detallesRes = await client.query(
        `SELECT
           dp.id_pedido,
           dp.id_producto,
           dp.id_variante,
           dp.cantidad,
           dp.precio_unitario,
           dp.subtotal,
           prod.id_producto AS producto_existente,
           v.id_variante AS variante_existente
         FROM public.detallepedido dp
         LEFT JOIN public.producto prod
           ON prod.id_producto = dp.id_producto
         LEFT JOIN public.producto_variantes v
           ON v.id_variante = dp.id_variante
          AND v.id_producto = dp.id_producto
         WHERE dp.id_pedido = $1`,
        [pedido.id_pedido]
      );

      if (detallesRes.rowCount === 0) {
        throw new AppError('El pedido no tiene DetallePedido.', 409);
      }

      totalAcumulado = Number(pedido.total);

      if (!Number.isFinite(totalAcumulado) || totalAcumulado < 0) {
        throw new AppError('El total del pedido no es válido.', 409);
      }

      let totalDetalles = 0;

      for (const detalle of detallesRes.rows) {
        if (!detalle.producto_existente) {
          throw new AppError('Un producto del pedido ya no existe.', 409);
        }

        if (detalle.id_variante !== null && !detalle.variante_existente) {
          throw new AppError('Una variante del pedido ya no existe o no corresponde al producto.', 409);
        }

        const cantidad = Number(detalle.cantidad);
        const precio = Number(detalle.precio_unitario);
        const subtotal = Number(detalle.subtotal);

        if (!Number.isFinite(cantidad) || cantidad <= 0) {
          throw new AppError('El pedido contiene una cantidad inválida.', 409);
        }

        if (!Number.isFinite(precio) || precio <= 0) {
          throw new AppError('El pedido contiene un precio histórico inválido.', 409);
        }

        if (!Number.isFinite(subtotal) || subtotal < 0) {
          throw new AppError('El pedido contiene un subtotal inválido.', 409);
        }

        totalDetalles += subtotal;
      }

      // El total de la cabecera es el total económico persistido.
      // La suma de detalles se valida como integridad del pedido, pero
      // no se reconstruye la venta desde precios actuales del catálogo.
      if (Math.abs(totalDetalles - totalAcumulado) > 0.01) {
        throw new AppError('El total del pedido no coincide con sus detalles.', 409);
      }

      // IMPORTANTE: el Pedido ya descontó/reservó Stock al crearse.
      // En esta rama NO se llama stockService.
      esConsumidorFinal = idClienteFinal === CONSUMIDOR_FINAL_ID;
    } else {
      // ----------------------------------------------------------
      // VENTA DIRECTA NUEVA: conservar el comportamiento existente.
      // ----------------------------------------------------------
      idClienteFinal = id_cliente || CONSUMIDOR_FINAL_ID;

      const clienteExiste = await client.query(
        `SELECT id_usuario FROM usuario WHERE id_usuario = $1`,
        [idClienteFinal]
      );

      if (clienteExiste.rowCount === 0) {
        throw new Error('El cliente no existe.');
      }

      esConsumidorFinal = idClienteFinal === CONSUMIDOR_FINAL_ID;

      const pedidoRes = await client.query(
        `INSERT INTO public.pedido (id_cliente, estado, total)
         VALUES ($1, 'facturado', 0) RETURNING *`,
        [idClienteFinal]
      );
      pedido = pedidoRes.rows[0];

      totalAcumulado = 0;

      for (const p of productos) {
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
          [p.id_producto, p.id_variante]
        );

        if (catalogoRes.rowCount === 0) {
          throw new Error('Producto o variante inexistente');
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
            p.id_variante,
            p.cantidad,
            precioUnitario,
            subtotal,
          ]
        );

        // Venta Directa nueva mantiene exactamente su descuento actual.
        await stockService.aplicarMovimientoStock({
          client,
          id_producto: p.id_producto,
          id_variante: p.id_variante,
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
    }

    // ============================================================
    // LÓGICA ECONÓMICA COMÚN A AMBOS ORÍGENES
    // ============================================================

    const montoPagadoFinal =
      monto_pagado === undefined || monto_pagado === null
        ? totalAcumulado
        : Number(monto_pagado);

    if (!Number.isFinite(montoPagadoFinal) || montoPagadoFinal < 0 || montoPagadoFinal > totalAcumulado) {
      throw new AppError(
        'El monto pagado no puede ser negativo ni mayor al total de la venta.',
        400
      );
    }

    if (montoPagadoFinal < totalAcumulado && esConsumidorFinal) {
      throw new AppError(
        'Consumidor Final no puede quedar con saldo pendiente. Seleccioná un cliente registrado para vender a cuenta corriente.',
        400
      );
    }

    if (montoPagadoFinal < totalAcumulado) {
      await cuentaCorrienteModel.registrarMovimiento(client, {
        id_cliente: idClienteFinal,
        tipo: 'venta',
        monto: totalAcumulado,
        id_pedido: pedido.id_pedido,
        forma_pago,
        id_usuario,
      });

      if (montoPagadoFinal > 0) {
        await cuentaCorrienteModel.registrarMovimiento(client, {
          id_cliente: idClienteFinal,
          tipo: 'pago',
          monto: montoPagadoFinal,
          id_pedido: pedido.id_pedido,
          forma_pago,
          observaciones: 'Entrega al momento de la venta',
          id_usuario,
        });
      }
    }

    if (montoPagadoFinal > 0) {
      await cajaModel.registrarMovimiento(client, {
        tipo: 'ingreso',
        origen: 'venta',
        forma_pago,
        monto: montoPagadoFinal,
        id_referencia: pedido.id_pedido,
        id_usuario,
      });
    }

    // Segunda barrera justo antes de crear la factura.
    const facturaExistenteFinal = await client.query(
      `SELECT id_factura
       FROM public.factura
       WHERE id_pedido = $1`,
      [pedido.id_pedido]
    );

    if (facturaExistenteFinal.rowCount > 0) {
      throw new AppError('El pedido ya posee una factura.', 409);
    }

    const facturaRes = await client.query(
      `INSERT INTO public.factura (id_pedido, forma_pago, total, observaciones)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [pedido.id_pedido, forma_pago, totalAcumulado, observaciones || null]
    );

    // Una Venta Directa nueva ya nace facturada. Un Pedido existente
    // solamente pasa a facturado después de completar los efectos económicos.
    if (tienePedidoExistente) {
      const actualizado = await client.query(
        `UPDATE public.pedido
         SET estado = 'facturado'
         WHERE id_pedido = $1
         RETURNING *`,
        [pedido.id_pedido]
      );
      pedido = actualizado.rows[0];
    }

    await client.query('COMMIT');

    return {
      pedido: { ...pedido, total: totalAcumulado },
      factura: facturaRes.rows[0],
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

module.exports = { insertarVentaDirecta, CONSUMIDOR_FINAL_ID };
