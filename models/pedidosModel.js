// models/pedidosModel.js
const pool = require("../db");
const stockService = require("../services/stockService");

const insertar = async ({ id_cliente, productos }) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const totalPedido = productos.reduce(
      (acc, p) => acc + p.cantidad * p.precio_unitario,
      0
    );

    const resPedido = await client.query(
      `INSERT INTO public.pedido (id_cliente, total, estado, fecha) 
       VALUES ($1, $2, 'pendiente', NOW()) 
       RETURNING id_pedido`,
      [id_cliente, totalPedido]
    );
    const id_pedido = resPedido.rows[0].id_pedido;

    for (const p of productos) {
      const subtotalLinea = p.cantidad * p.precio_unitario;
      
      await client.query(
        `INSERT INTO public.detallepedido (id_pedido, id_producto, id_variante, cantidad, precio_unitario, subtotal) 
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          id_pedido,
          p.id_producto,
          p.id_variante || null,
          p.cantidad,
          p.precio_unitario,
          subtotalLinea,
        ]
      );

      // Descuento centralizado
      await stockService.aplicarMovimientoStock({
        client,
        id_producto: p.id_producto,
        id_variante: p.id_variante || null,
        cantidad: p.cantidad,
        operacion: stockService.OPERACIONES_STOCK.DESCUENTO,
        tipoMovimiento: stockService.TIPOS_MOVIMIENTO.PEDIDO_RESERVA,
        origen: { tipo: 'PEDIDO', id: id_pedido },
      });
    }
    await client.query("COMMIT");
    return { id_pedido, total: totalPedido };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const actualizarEstado = async (id_pedido, nuevoEstado) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Bloquear cabecera de pedido para evitar lecturas/escrituras concurrentes
    const resPedido = await client.query(
      `SELECT id_pedido, estado FROM public.pedido WHERE id_pedido = $1 FOR UPDATE`,
      [id_pedido]
    );

    if (resPedido.rowCount === 0) {
      throw new Error("Pedido no encontrado");
    }

    const estadoActual = resPedido.rows[0].estado;
    if (estadoActual === nuevoEstado) {
      return resPedido.rows[0];
    }

    // Un Pedido solamente puede llegar a facturado mediante la
    // concreción económica de Venta Directa. No permitir esta transición
    // por el endpoint genérico de estados.
    if (nuevoEstado === "facturado") {
      throw new Error("El Pedido debe ser cobrado mediante Venta Directa para pasar a facturado");
    }

    // 2. Validar regla de transición de estado
    stockService.validarTransicionEstado(estadoActual, nuevoEstado);

    // 3. Evaluar devolución si pasa a 'cancelado' y antes no lo estaba
    if (nuevoEstado === "cancelado" && estadoActual !== "cancelado") {
      // Bloqueo explícito en detallepedido durante la lectura para reversión
      const detalles = await client.query(
        `SELECT id_producto, id_variante, cantidad 
         FROM public.detallepedido 
         WHERE id_pedido = $1 
         FOR UPDATE`,
        [id_pedido]
      );

      for (const item of detalles.rows) {
        await stockService.aplicarMovimientoStock({
          client,
          id_producto: item.id_producto,
          id_variante: item.id_variante || null,
          cantidad: item.cantidad,
          operacion: stockService.OPERACIONES_STOCK.DEVOLUCION,
          tipoMovimiento: stockService.TIPOS_MOVIMIENTO.PEDIDO_CANCELACION,
          origen: { tipo: 'PEDIDO', id: id_pedido },
        });
      }
    }
    // 4. Actualización del estado
    const resActualizar = await client.query(
      `UPDATE public.pedido SET estado = $1 WHERE id_pedido = $2 RETURNING *`,
      [nuevoEstado, id_pedido]
    );

    await client.query("COMMIT");
    return resActualizar.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const obtenerTodos = async () => {
  const query = `
    SELECT p.*, u.nombre AS cliente_nombre, u.apellido AS cliente_apellido, u.email AS cliente_email
    FROM public.pedido p
    JOIN public.usuario u ON p.id_cliente = u.id_usuario
    ORDER BY p.fecha DESC
  `;
  const res = await pool.query(query);
  return res.rows;
};

const obtenerDetalle = async (id_pedido) => {
  const query = `
    SELECT dp.*, prod.nombre as nombre_producto, v.nombre_variante
    FROM public.detallepedido dp
    JOIN public.producto prod ON dp.id_producto = prod.id_producto
    LEFT JOIN public.producto_variantes v ON dp.id_variante = v.id_variante
    WHERE dp.id_pedido = $1
  `;
  const res = await pool.query(query, [id_pedido]);
  return res.rows;
};

const obtenerPorCliente = async (id_cliente) => {
  const res = await pool.query(
    "SELECT * FROM public.pedido WHERE id_cliente = $1 ORDER BY fecha DESC",
    [id_cliente]
  );
  return res.rows;
};

module.exports = {
  insertar,
  obtenerTodos,
  obtenerDetalle,
  actualizarEstado,
  obtenerPorCliente,
};