const express = require('express');
const router = express.Router();
const pool = require('../db');
const verificarToken = require('../middlewares/auth');
const verificarRol = require('../middlewares/roles');

// GET /api/stats/dashboard
// Devuelve todas las métricas clave del negocio para el Dashboard
router.get('/dashboard', verificarToken, verificarRol(['dueno']), async (req, res, next) => {
  try {
    // 1. Ventas del mes actual
    const ventasMes = await pool.query(`
      SELECT COALESCE(SUM(total), 0) AS total_ventas, COUNT(*) AS cantidad_pedidos
      FROM pedido
      WHERE DATE_TRUNC('month', fecha) = DATE_TRUNC('month', CURRENT_DATE)
        AND estado NOT IN ('cancelado')
    `);

    // 2. Gastos del mes actual
    const gastosMes = await pool.query(`
      SELECT COALESCE(SUM(monto), 0) AS total_gastos
      FROM gasto
      WHERE DATE_TRUNC('month', fecha) = DATE_TRUNC('month', CURRENT_DATE)
    `);

    // 3. Compras del mes actual
    const comprasMes = await pool.query(`
      SELECT COALESCE(SUM(total), 0) AS total_compras
      FROM compra
      WHERE DATE_TRUNC('month', fecha) = DATE_TRUNC('month', CURRENT_DATE)
    `);

    // 4. Stock crítico — variantes con stock menor a 5 unidades
    const stockCritico = await pool.query(`
      SELECT
        p.nombre AS producto,
        pv.nombre_variante,
        pv.stock
      FROM producto_variantes pv
      JOIN producto p ON p.id_producto = pv.id_producto
      WHERE pv.stock < 5
      ORDER BY pv.stock ASC
      LIMIT 10
    `);

    // 5. Productos más vendidos del mes
    const masVendidos = await pool.query(`
      SELECT
        p.nombre AS producto,
        pv.nombre_variante,
        SUM(dp.cantidad) AS total_vendido
      FROM detallepedido dp
      JOIN producto p ON p.id_producto = dp.id_producto
      LEFT JOIN producto_variantes pv ON pv.id_variante = dp.id_variante
      JOIN pedido pe ON pe.id_pedido = dp.id_pedido
      WHERE DATE_TRUNC('month', pe.fecha) = DATE_TRUNC('month', CURRENT_DATE)
        AND pe.estado NOT IN ('cancelado')
      GROUP BY p.nombre, pv.nombre_variante
      ORDER BY total_vendido DESC
      LIMIT 5
    `);

    // 6. Pedidos por estado
    const pedidosPorEstado = await pool.query(`
      SELECT estado, COUNT(*) AS cantidad
      FROM pedido
      WHERE DATE_TRUNC('month', fecha) = DATE_TRUNC('month', CURRENT_DATE)
      GROUP BY estado
    `);

    // 7. Rentabilidad del mes (ventas - gastos - compras)
    const totalVentas  = parseFloat(ventasMes.rows[0].total_ventas);
    const totalGastos  = parseFloat(gastosMes.rows[0].total_gastos);
    const totalCompras = parseFloat(comprasMes.rows[0].total_compras);
    const rentabilidad = totalVentas - totalGastos - totalCompras;

    res.json({
      ventas: {
        total: totalVentas,
        cantidad_pedidos: parseInt(ventasMes.rows[0].cantidad_pedidos)
      },
      gastos: {
        total: totalGastos
      },
      compras: {
        total: totalCompras
      },
      rentabilidad,
      stock_critico: stockCritico.rows,
      mas_vendidos: masVendidos.rows,
      pedidos_por_estado: pedidosPorEstado.rows
    });

  } catch (err) {
    next(err);
  }
});

module.exports = router;