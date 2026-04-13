const pool = require('../db');
exports.insertarPedido = async (idCliente, productos) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Crear la cabecera del pedido
        const pedidoRes = await client.query(
            'INSERT INTO pedido (id_cliente, estado, total) VALUES ($1, $2, $3) RETURNING *',
            [idCliente, 'pendiente', 0]
        );
        const idPedido = pedidoRes.rows[0].id_pedido;
        let totalAcumulado = 0;

        // 2. Procesar cada item
        for (const p of productos) {
            // VALIDACIÓN ANTI-ERROR 500: Verificamos que la variante exista
            const varRes = await client.query(
                'SELECT precio_venta FROM producto_variantes WHERE id_variante = $1',
                [p.id_variante]
            );
            
            if (varRes.rows.length === 0) {
                throw new Error(`La variante con ID ${p.id_variante} no existe en la base de datos.`);
            }

            const precioVenta = varRes.rows[0].precio_venta;
            const subtotal = precioVenta * p.cantidad;
            totalAcumulado += subtotal;

            // Insertar en detallepedido
            await client.query(
                'INSERT INTO detallepedido (id_pedido, id_producto, id_variante, cantidad, subtotal) VALUES ($1, $2, $3, $4, $5)',
                [idPedido, p.id_producto, p.id_variante, p.cantidad, subtotal]
            );

            // RESTAR STOCK (Con validación de stock suficiente si quisieras)
            await client.query(
                'UPDATE producto_variantes SET stock = stock - $1 WHERE id_variante = $2',
                [p.cantidad, p.id_variante]
            );
        }

        // 3. Actualizar el total final
        const finalRes = await client.query(
            'UPDATE pedido SET total = $1 WHERE id_pedido = $2 RETURNING *',
            [totalAcumulado, idPedido]
        );

        await client.query('COMMIT');
        return finalRes.rows[0];

    } catch (err) {
        await client.query('ROLLBACK');
        console.error("Error en insertarPedido:", err.message); // Para ver el error real en la consola
        throw err;
    } finally {
        client.release();
    }
};

exports.obtenerPorCliente = async (idCliente) => {
  const result = await pool.query('SELECT * FROM pedido WHERE id_cliente=$1', [idCliente]);
  return result.rows;
};
exports.obtenerTodos = async () => {
  const result = await pool.query(`
    SELECT 
      p.id_pedido,
      p.estado,
      p.total,
      p.fecha,
      u.id_usuario,
      u.nombre AS cliente_nombre,
      u.apellido AS cliente_apellido,
      u.email AS cliente_email
    FROM pedido p
    JOIN usuario u ON p.id_cliente = u.id_usuario
    ORDER BY p.fecha DESC
  `);
  return result.rows;
};
exports.obtenerDetalle = async (idPedido) => {
  const query = `
    SELECT 
      dp.id_producto,
      dp.id_variante,
      dp.cantidad,
      dp.subtotal,
      pr.nombre AS producto_nombre,
      v.nombre_variante, -- 👈 Ahora traemos el nombre del talle/variante
      v.precio_venta AS precio_unitario_variante
    FROM detallepedido dp
    JOIN producto pr ON dp.id_producto = pr.id_producto
    LEFT JOIN producto_variantes v ON dp.id_variante = v.id_variante -- 👈 Join para ver qué variante fue
    WHERE dp.id_pedido = $1
  `;
  
  const result = await pool.query(query, [idPedido]);
  return result.rows;
};
exports.actualizarEstado = async (idPedido, nuevoEstado) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Obtener el estado anterior y los items del pedido antes de cambiar nada
    const pedidoPrevio = await client.query('SELECT estado FROM pedido WHERE id_pedido = $1', [idPedido]);
    const estadoAnterior = pedidoPrevio.rows[0].estado;

    // 2. Si el pedido se CANCELA y antes NO estaba cancelado, devolvemos el stock
    if (nuevoEstado === 'cancelado' && estadoAnterior !== 'cancelado') {
      const items = await client.query('SELECT id_variante, cantidad FROM detallepedido WHERE id_pedido = $1', [idPedido]);
      
      for (const item of items.rows) {
        await client.query(
          'UPDATE producto_variantes SET stock = stock + $1 WHERE id_variante = $2',
          [item.cantidad, item.id_variante]
        );
      }
    }

    // 3. Actualizar el estado del pedido
    const result = await client.query(
      'UPDATE pedido SET estado=$1 WHERE id_pedido=$2 RETURNING *',
      [nuevoEstado, idPedido]
    );

    await client.query('COMMIT');
    return result.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};