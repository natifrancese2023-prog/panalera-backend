const pool = require('../db'); // ajustá el path si es distinto

exports.obtenerMetricas = async (req, res, next) => {
  const { inicio, fin } = req.query;

  // Fallback al mes actual si no vienen fechas
  const fInicio = inicio ? `${inicio} 00:00:00` : '2026-01-01 00:00:00';
  const fFin    = fin    ? `${fin} 23:59:59`    : '2026-12-31 23:59:59';

  try {
    // 1. Ingresos (tabla pedido, igual que en la ruta original)
    const ventasRes = await pool.query(
      `SELECT COALESCE(SUM(total), 0) AS total, COUNT(*) AS cantidad
       FROM pedido
       WHERE fecha BETWEEN $1 AND $2 AND estado != 'cancelado'`,
      [fInicio, fFin]
    );

    // 2. Egresos: gastos + compras
    const gastosRes = await pool.query(
      `SELECT COALESCE(SUM(monto), 0) AS total FROM gasto WHERE fecha BETWEEN $1 AND $2`,
      [fInicio, fFin]
    );
    const comprasRes = await pool.query(
      `SELECT COALESCE(SUM(total), 0) AS total FROM compra WHERE fecha BETWEEN $1 AND $2`,
      [fInicio, fFin]
    );

    // 3. Stock Crítico
    const stockCriticoRes = await pool.query(
      `SELECT p.nombre, pv.nombre_variante, pv.stock
       FROM producto_variantes pv
       JOIN producto p ON p.id_producto = pv.id_producto
       WHERE pv.stock < 5
       ORDER BY pv.stock ASC
       LIMIT 10`
    );

    // 4. Productos más vendidos
    const masVendidosRes = await pool.query(
      `SELECT p.nombre, pv.nombre_variante, SUM(dp.cantidad) AS total_vendido
       FROM detallepedido dp
       JOIN producto p ON p.id_producto = dp.id_producto
       LEFT JOIN producto_variantes pv ON pv.id_variante = dp.id_variante
       JOIN pedido pe ON pe.id_pedido = dp.id_pedido
       WHERE pe.fecha BETWEEN $1 AND $2 AND pe.estado != 'cancelado'
       GROUP BY p.nombre, pv.nombre_variante
       ORDER BY total_vendido DESC
       LIMIT 5`,
      [fInicio, fFin]
    );

    // 5. Evolución de caja por día (para el gráfico)
    const graficoRes = await pool.query(
      `SELECT TO_CHAR(fecha, 'DD/MM') AS dia,
              SUM(CASE WHEN origen = 'pedido'  THEN total ELSE 0 END) AS ventas,
              SUM(CASE WHEN origen IN ('gasto','compra') THEN total ELSE 0 END) AS egresos
       FROM (
         SELECT fecha, total, 'pedido' AS origen
           FROM pedido WHERE fecha BETWEEN $1 AND $2 AND estado != 'cancelado'
         UNION ALL
         SELECT fecha, monto AS total, 'gasto' AS origen
           FROM gasto WHERE fecha BETWEEN $1 AND $2
         UNION ALL
         SELECT fecha, total, 'compra' AS origen
           FROM compra WHERE fecha BETWEEN $1 AND $2
       ) sub
       GROUP BY dia
       ORDER BY dia`,
      [fInicio, fFin]
    );

    // Calcular totales
    const totalVentas  = parseFloat(ventasRes.rows[0].total);
    const totalEgresos = parseFloat(gastosRes.rows[0].total) + parseFloat(comprasRes.rows[0].total);
    const cantidad     = parseInt(ventasRes.rows[0].cantidad);

    // Formato exacto que el front consume
    res.json({
      totales: {
        ingresos:         totalVentas,
        egresos:          totalEgresos,
        gananciaNeta:     totalVentas - totalEgresos,
        cantidadFacturas: cantidad,
        ticketPromedio:   cantidad > 0 ? (totalVentas / cantidad).toFixed(2) : 0,
      },
      alertas: {
        stockCritico: stockCriticoRes.rows,
      },
      topProductos: masVendidosRes.rows,
      grafico:      graficoRes.rows,
      mediosPago:   [],
    });

  } catch (err) {
    console.error('Error en obtenerMetricas:', err);
    res.status(500).json({
      totales: { ingresos: 0, egresos: 0, gananciaNeta: 0, cantidadFacturas: 0, ticketPromedio: 0 },
      alertas: { stockCritico: [] },
      grafico: [],
      topProductos: [],
      mediosPago: [],
    });
  }
};