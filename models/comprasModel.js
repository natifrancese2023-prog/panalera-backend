const pool = require('../db');

const insertar = async ({ id_proveedor, forma_pago, estado_pago, observaciones, productos }) => {
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
    let totalAcumulado = 0;

    // 2. Procesar cada producto, actualizar stock y calcular totales
    for (const p of productos) {
      const subtotal = p.cantidad * p.precio_unitario;
      totalAcumulado += subtotal;

      await client.query(
        `INSERT INTO detalle_compra (id_compra, id_producto, id_variante, cantidad, precio_unitario, subtotal)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [compra.id_compra, p.id_producto, p.id_variante || null, p.cantidad, p.precio_unitario, subtotal]
      );

      // Actualizar stock y precio de costo: Si tiene variante a la variante, si no al producto base
      if (p.id_variante) {
        await client.query(
          `UPDATE producto_variantes SET stock = stock + $1, precio_compra = $2 WHERE id_variante = $3`,
          [p.cantidad, p.precio_unitario, p.id_variante]
        );
      } else {
        await client.query(
          `UPDATE producto SET stock = stock + $1, precio_compra = $2 WHERE id_producto = $3`,
          [p.cantidad, p.precio_unitario, p.id_producto]
        );
      }
    }

    // 3. Actualizar el total final en la compra
    await client.query('UPDATE compra SET total = $1 WHERE id_compra = $2', [totalAcumulado, compra.id_compra]);
    
    await client.query('COMMIT');
    return { ...compra, total: totalAcumulado };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const obtenerDetalle = async (id_compra) => {
  const result = await pool.query(`
    SELECT 
      dc.*, 
      p.nombre AS producto_nombre, 
      pv.nombre_variante AS variante_nombre
    FROM detalle_compra dc
    JOIN producto p ON dc.id_producto = p.id_producto
    LEFT JOIN producto_variantes pv ON dc.id_variante = pv.id_variante
    WHERE dc.id_compra = $1
  `, [id_compra]);
  return result.rows;
};

const obtenerTodas = async () => {
  const result = await pool.query(`
    SELECT c.*, prov.nombre AS proveedor_nombre
    FROM compra c
    JOIN proveedor prov ON c.id_proveedor = prov.id_proveedor
    ORDER BY c.fecha DESC
  `);
  return result.rows;
};

const actualizarEstadoPago = async (id, estado_pago, forma_pago) => {
  const result = await pool.query(
    `UPDATE compra SET estado_pago = $1, forma_pago = $2 WHERE id_compra = $3 RETURNING *`,
    [estado_pago, forma_pago, id]
  );
  return result.rows[0];
};

module.exports = {
  insertar,
  obtenerDetalle,
  obtenerTodas,
  actualizarEstadoPago
};