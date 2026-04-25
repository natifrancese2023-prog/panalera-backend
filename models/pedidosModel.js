const pool = require("../db");

// ============================================================
// FUNCIONES DEL MODELO (Ajustadas a tabla 'pedido' en singular)
// ============================================================
const insertar = async ({ id_cliente, productos }) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Calcular el total del pedido para la tabla 'pedido'
    const totalPedido = productos.reduce(
      (acc, p) => acc + p.cantidad * p.precio_unitario,
      0,
    );

    // 2. Insertar en la cabecera: public.pedido
    const resPedido = await client.query(
      `INSERT INTO public.pedido (id_cliente, total, estado, fecha) 
       VALUES ($1, $2, 'pendiente', NOW()) 
       RETURNING id_pedido`,
      [id_cliente, totalPedido],
    );
    const id_pedido = resPedido.rows[0].id_pedido;

    // 3. Insertar cada renglón en: public.detallepedido
    for (const p of productos) {
      if (!p.id_variante) {
        throw new Error(
          `Error: El producto con ID ${p.id_producto} no tiene una variante válida.`,
        );
      }

      // IMPORTANTE: Según tu captura, la columna se llama 'subtotal'
      const subtotalLinea = p.cantidad * p.precio_unitario;
      await client.query(
        `INSERT INTO public.detallepedido (id_pedido, id_producto, id_variante, cantidad, precio_unitario, subtotal) 
   VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          id_pedido,
          p.id_producto,
          p.id_variante,
          p.cantidad,
          p.precio_unitario,
          subtotalLinea,
        ],
      );

      // 4. Descontar stock en public.producto_variantes
      const resStock = await client.query(
        `UPDATE public.producto_variantes 
         SET stock = stock - $1 
         WHERE id_variante = $2 AND stock >= $1
         RETURNING stock`,
        [p.cantidad, p.id_variante],
      );

      if (resStock.rowCount === 0) {
        throw new Error(
          `Stock insuficiente para la variante ID: ${p.id_variante}`,
        );
      }
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

const actualizarEstado = async (id_pedido, estado) => {
  const res = await pool.query(
    "UPDATE public.pedido SET estado = $1 WHERE id_pedido = $2 RETURNING *",
    [estado, id_pedido],
  );
  return res.rows[0];
};

const obtenerPorCliente = async (id_cliente) => {
  const res = await pool.query(
    "SELECT * FROM public.pedido WHERE id_cliente = $1 ORDER BY fecha DESC",
    [id_cliente],
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
