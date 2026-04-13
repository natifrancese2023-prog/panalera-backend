const pool = require('../db');
exports.insertar = async ({ id_proveedor, forma_pago, estado_pago, observaciones, productos }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Crear la cabecera de la compra
    const compraRes = await client.query(
      `INSERT INTO compra (id_proveedor, forma_pago, estado_pago, observaciones, total)
       VALUES ($1, $2, $3, $4, 0) RETURNING *`,
      [id_proveedor, forma_pago || null, estado_pago || 'pendiente', observaciones || null]
    );
    const compra = compraRes.rows[0];
    let total = 0;

    // 2. Insertar detalles y actualizar stock en la tabla de VARIANTES
    for (const p of productos) {
      const subtotal = p.cantidad * p.precio_unitario;
      total += subtotal;

      // Insertamos el id_variante en el detalle de compra
      await client.query(
        `INSERT INTO detalle_compra (id_compra, id_producto, id_variante, cantidad, precio_unitario, subtotal)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [compra.id_compra, p.id_producto, p.id_variante, p.cantidad, p.precio_unitario, subtotal]
      );

      // 🚀 INCREMENTAR STOCK EN LA VARIANTE ESPECÍFICA
      // También actualizamos el precio_compra de esa variante para tener el costo actualizado
      await client.query(
        `UPDATE producto_variantes SET stock = stock + $1, precio_compra = $2 WHERE id_variante = $3`,
        [p.cantidad, p.precio_unitario, p.id_variante]
      );
    }

    // 3. Actualizar total de la compra
    await client.query(
      'UPDATE compra SET total=$1 WHERE id_compra=$2',
      [total, compra.id_compra]
    );

    await client.query('COMMIT');
    return { ...compra, total };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};
exports.obtenerDetalle = async (id) => {
  const result = await pool.query(`
    SELECT 
        dc.*, 
        pr.nombre AS producto_nombre, 
        v.nombre_variante -- 👈 Importante para saber qué talle se compró
    FROM detalle_compra dc
    JOIN producto pr ON pr.id_producto = dc.id_producto
    JOIN producto_variantes v ON v.id_variante = dc.id_variante
    WHERE dc.id_compra = $1
  `, [id]);
  return result.rows;
};
exports.obtenerTodas = async () => {
  const result = await pool.query(`
    SELECT c.*, p.nombre AS proveedor_nombre
    FROM compra c
    JOIN proveedor p ON p.id_proveedor = c.id_proveedor
    ORDER BY c.fecha DESC
  `);
  return result.rows;
};

// obtenerDetalle definido arriba con JOIN a producto_variantes — no duplicar

exports.actualizarEstadoPago = async (id, { estado_pago, forma_pago }) => {
  const result = await pool.query(
    `UPDATE compra SET estado_pago=$1, forma_pago=$2 WHERE id_compra=$3 RETURNING *`,
    [estado_pago, forma_pago, id]
  );
  return result.rows[0];
};