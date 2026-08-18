const pool = require('../db');
const stockService = require('../services/stockService');
const AbastecimientoService = require('../services/AbastecimientoService');
const insertar = async ({ id_proveedor, forma_pago, estado_pago, observaciones, productos, id_usuario = null }) => {
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

    // 2. Procesar cada producto, delegar stock/kardex, actualizar costos y registrar catálogo de abastecimiento
    for (const p of productos) {
      const subtotal = p.cantidad * p.precio_unitario;
      totalAcumulado += subtotal;

      // Registrar renglón en el detalle de la compra
      await client.query(
        `INSERT INTO detalle_compra (id_compra, id_producto, id_variante, cantidad, precio_unitario, subtotal)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [compra.id_compra, p.id_producto, p.id_variante || null, p.cantidad, p.precio_unitario, subtotal]
      );

      await stockService.aplicarMovimientoStock({
        client,
        id_producto: p.id_producto,
        id_variante: p.id_variante || null,
        cantidad: p.cantidad,
        operacion: stockService.OPERACIONES_STOCK.COMPRA,
        tipoMovimiento: stockService.TIPOS_MOVIMIENTO.COMPRA,
        origen: { tipo: 'COMPRA', id: compra.id_compra },
        metadata: { id_usuario, motivo: 'Ingreso por compra a proveedor' },
      });
      // --- REGISTRO RÁPIDO EN CATÁLOGO COMERCIAL (ABASTECIMIENTO) ---
      // Se delega al AbastecimientoService para actualizar fecha_ultima_compra y ultimo_precio_compra
      await AbastecimientoService.registrarUltimaCompra(
        id_proveedor,
        p.id_producto,
        p.id_variante || null,
        p.precio_unitario,
        compra.fecha || new Date(),
        client
      );

      // --- ACTUALIZACIÓN DE PRECIO DE COSTO E HISTORIAL DE COSTOS ---
      if (p.id_variante) {
        const costoActual = await client.query(
          `SELECT precio_compra FROM producto_variantes WHERE id_variante = $1 FOR UPDATE`,
          [p.id_variante]
        );

        const varianteActualizada = await client.query(
          `UPDATE producto_variantes
           SET precio_compra = $1
           WHERE id_variante = $2
           RETURNING precio_compra`,
          [p.precio_unitario, p.id_variante]
        );

        if (
          costoActual.rowCount > 0 &&
          varianteActualizada.rowCount > 0 &&
          Number(costoActual.rows[0].precio_compra) !== Number(varianteActualizada.rows[0].precio_compra)
        ) {
          await client.query(
            `INSERT INTO producto_historial_costo
               (id_producto, id_variante, costo_anterior, costo_nuevo, id_usuario)
             VALUES ($1, $2, $3, $4, $5)`,
            [p.id_producto, p.id_variante, costoActual.rows[0].precio_compra, varianteActualizada.rows[0].precio_compra, id_usuario]
          );
        }
      } else {
        const costoActual = await client.query(
          `SELECT precio_compra FROM producto WHERE id_producto = $1 FOR UPDATE`,
          [p.id_producto]
        );

        const productoActualizado = await client.query(
          `UPDATE producto
           SET precio_compra = $1
           WHERE id_producto = $2
           RETURNING precio_compra`,
          [p.precio_unitario, p.id_producto]
        );

        if (
          costoActual.rowCount > 0 &&
          productoActualizado.rowCount > 0 &&
          Number(costoActual.rows[0].precio_compra) !== Number(productoActualizado.rows[0].precio_compra)
        ) {
          await client.query(
            `INSERT INTO producto_historial_costo
               (id_producto, id_variante, costo_anterior, costo_nuevo, id_usuario)
             VALUES ($1, $2, $3, $4, $5)`,
            [p.id_producto, null, costoActual.rows[0].precio_compra, productoActualizado.rows[0].precio_compra, id_usuario]
          );
        }
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