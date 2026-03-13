const pool = require('../db');

exports.insertarPedido = async (idCliente, productos) => {
  try {
    // 1. Crear pedido
    const pedido = await pool.query(
      'INSERT INTO pedido (id_cliente, estado, total) VALUES ($1, $2, $3) RETURNING *',
      [idCliente, 'pendiente', 0]
    );
    const idPedido = pedido.rows[0].id_pedido;

    let total = 0;

    // 2. Insertar detalles
    for (const p of productos) {
      const prod = await pool.query('SELECT precio_venta FROM producto WHERE id_producto=$1', [p.id_producto]);
      const precio = prod.rows[0].precio_venta;
      const subtotal = precio * p.cantidad;
      total += subtotal;

      await pool.query(
        'INSERT INTO detallepedido (id_pedido, id_producto, cantidad, subtotal) VALUES ($1,$2,$3,$4)',
        [idPedido, p.id_producto, p.cantidad, subtotal]
      );
    }

    // 3. Actualizar total del pedido
    const actualizado = await pool.query(
      'UPDATE pedido SET total=$1 WHERE id_pedido=$2 RETURNING *',
      [total, idPedido]
    );

    return actualizado.rows[0];
  } catch (err) {
    throw err;
  }
};

exports.obtenerPorCliente = async (idCliente) => {
  const result = await pool.query('SELECT * FROM pedido WHERE id_cliente=$1', [idCliente]);
  return result.rows;
};

exports.obtenerTodos = async () => {
  const result = await pool.query('SELECT * FROM pedido');
  return result.rows;
};

exports.actualizarEstado = async (idPedido, estado) => {
  const result = await pool.query(
    'UPDATE pedido SET estado=$1 WHERE id_pedido=$2 RETURNING *',
    [estado, idPedido]
  );
  return result.rows[0];
};
