const pool = require('../db');

// 1. Crear factura y actualizar el estado del pedido a 'facturado'
const crear = async ({ id_pedido, forma_pago, observaciones }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Verificar que el pedido existe
    const pedidoRes = await client.query(
      'SELECT * FROM pedido WHERE id_pedido=$1', [id_pedido]
    );
    const pedido = pedidoRes.rows[0];
    if (!pedido) throw new Error('Pedido no encontrado');
    
    // Validación de estado (Coherente con pedidosModel)
    if (pedido.estado !== 'entregado') {
        throw new Error('El pedido debe estar en estado entregado para facturar');
    }

    // 2. Verificar que no tenga factura previa
    const facturaExistente = await client.query(
      'SELECT * FROM factura WHERE id_pedido=$1', [id_pedido]
    );
    if (facturaExistente.rows[0]) throw new Error('Este pedido ya fue facturado');

    // 3. Crear la factura usando el total del pedido
    const facturaRes = await client.query(
      `INSERT INTO factura (id_pedido, forma_pago, total, observaciones)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [id_pedido, forma_pago, pedido.total, observaciones || null]
    );

    // Actualizamos el estado del pedido
    await client.query(
      'UPDATE pedido SET estado=$1 WHERE id_pedido=$2',
      ['facturado', id_pedido]
    );

    await client.query('COMMIT');
    return facturaRes.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// 2. Obtener todas las facturas con datos del cliente (para listados)
const obtenerTodas = async () => {
  const result = await pool.query(`
    SELECT f.*,
      u.nombre AS cliente_nombre,
      u.apellido AS cliente_apellido,
      u.email AS cliente_email
    FROM factura f
    JOIN pedido p ON p.id_pedido = f.id_pedido
    JOIN usuario u ON u.id_usuario = p.id_cliente
    ORDER BY f.fecha DESC
  `);
  return result.rows;
};

// 3. Obtener una factura específica por ID
const obtenerPorId = async (id) => {
  const result = await pool.query(`
    SELECT f.*,
      u.nombre AS cliente_nombre,
      u.apellido AS cliente_apellido,
      u.email AS cliente_email
    FROM factura f
    JOIN pedido p ON p.id_pedido = f.id_pedido
    JOIN usuario u ON u.id_usuario = p.id_cliente
    WHERE f.id_factura = $1
  `, [id]);
  return result.rows[0];
};

module.exports = {
  crear,
  obtenerTodas,
  obtenerPorId
};