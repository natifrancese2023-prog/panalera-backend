const express = require('express');
const router = express.Router();
const ExcelJS = require('exceljs');
const pool = require('../db');


router.get('/export', async (req, res) => {
  const { inicio, fin, tipo } = req.query;
  const workbook = new ExcelJS.Workbook();

  try {
    // --- 1. PRODUCTOS (Con Variantes y Categoría) ---
    if (tipo === 'todo' || tipo === 'productos') {
      const productos = await pool.query(`
        SELECT 
          pr.id_producto, 
          pr.nombre, 
          c.nombre AS categoria_nombre,
          pv.nombre_variante,
          COALESCE(pv.stock, pr.stock) as stock_real,
          COALESCE(pv.precio, pr.precio_venta) as precio_final,
          pr.precio_compra
        FROM public.producto pr
        LEFT JOIN public.categoria c ON c.id_categoria = pr.id_categoria
        LEFT JOIN public.producto_variantes pv ON pv.id_producto = pr.id_producto
        ORDER BY pr.nombre ASC, pv.nombre_variante ASC
      `);
      
      const sheet = workbook.addWorksheet('Productos');
      sheet.columns = [
        { header: 'ID', key: 'id_producto', width: 10 },
        { header: 'Nombre', key: 'nombre', width: 30 },
        { header: 'Categoría', key: 'categoria_nombre', width: 20 },
        { header: 'Variante/Talle', key: 'nombre_variante', width: 15 },
        { header: 'Stock', key: 'stock_real', width: 10 },
        { header: 'Precio Venta', key: 'precio_final', width: 15 },
        { header: 'Precio Compra', key: 'precio_compra', width: 15 }
      ];
      productos.rows.forEach(r => sheet.addRow(r));
    }

    // --- 2. COMPRAS (Ajustado para detectar variantes en el detalle) ---
    if (tipo === 'todo' || tipo === 'compras') {
      const compras = await pool.query(`
        SELECT c.id_compra, c.fecha, c.total, p.nombre AS proveedor_nombre, c.forma_pago, c.estado_pago
        FROM public.compra c
        JOIN public.proveedor p ON p.id_proveedor = c.id_proveedor
        WHERE DATE(c.fecha) BETWEEN $1 AND $2 ORDER BY c.fecha DESC
      `, [inicio, fin]);
      
      const sheetC = workbook.addWorksheet('Compras');
      sheetC.columns = [
        { header: 'ID Compra', key: 'id_compra', width: 10 },
        { header: 'Fecha', key: 'fecha', width: 20 },
        { header: 'Proveedor', key: 'proveedor_nombre', width: 25 },
        { header: 'Total', key: 'total', width: 15 },
        { header: 'Forma Pago', key: 'forma_pago', width: 15 }
      ];
      compras.rows.forEach(r => sheetC.addRow(r));

      const detCompras = await pool.query(`
        SELECT 
          dc.id_compra, 
          pr.nombre || ' ' || COALESCE(pv.nombre_variante, '') AS producto, 
          dc.cantidad, dc.precio_unitario, dc.subtotal
        FROM public.detalle_compra dc
        JOIN public.producto pr ON pr.id_producto = dc.id_producto
        LEFT JOIN public.producto_variantes pv ON pv.id_variante = dc.id_variante
        WHERE dc.id_compra IN (SELECT id_compra FROM public.compra WHERE DATE(fecha) BETWEEN $1 AND $2)
      `, [inicio, fin]);

      const sheetDC = workbook.addWorksheet('Detalle Compras');
      sheetDC.columns = [
        { header: 'Ref Compra', key: 'id_compra', width: 12 },
        { header: 'Producto Full', key: 'producto', width: 35 },
        { header: 'Cant.', key: 'cantidad', width: 10 },
        { header: 'Subtotal', key: 'subtotal', width: 15 }
      ];
      detCompras.rows.forEach(r => sheetDC.addRow(r));
    }

    // --- 3. PEDIDOS (Crucial: Muestra qué variante compró el cliente) ---
    if (tipo === 'todo' || tipo === 'pedidos') {
      const pedidos = await pool.query(`
        SELECT p.id_pedido, p.fecha, p.estado, p.total, u.nombre, u.apellido
        FROM public.pedido p
        JOIN public.usuario u ON u.id_usuario = p.id_cliente
        WHERE DATE(p.fecha) BETWEEN $1 AND $2 ORDER BY p.fecha DESC
      `, [inicio, fin]);
      
      const sheetP = workbook.addWorksheet('Pedidos');
      sheetP.columns = [
        { header: 'ID Pedido', key: 'id_pedido', width: 12 },
        { header: 'Fecha', key: 'fecha', width: 20 },
        { header: 'Estado', key: 'estado', width: 15 },
        { header: 'Cliente', key: 'cliente', width: 35 },
        { header: 'Total', key: 'total', width: 15 }
      ];
      pedidos.rows.forEach(r => sheetP.addRow({ ...r, cliente: `${r.apellido}, ${r.nombre}` }));

      const detalleP = await pool.query(`
        SELECT 
          dp.id_pedido, 
          pr.nombre || ' ' || COALESCE(pv.nombre_variante, '') AS producto, 
          dp.cantidad, dp.subtotal
        FROM public.detallepedido dp
        JOIN public.producto pr ON pr.id_producto = dp.id_producto
        LEFT JOIN public.producto_variantes pv ON pv.id_variante = dp.id_variante
        WHERE dp.id_pedido IN (SELECT id_pedido FROM public.pedido WHERE DATE(fecha) BETWEEN $1 AND $2)
      `, [inicio, fin]);

      const sheetDP = workbook.addWorksheet('Detalle Pedidos');
      sheetDP.columns = [
        { header: 'Ref Pedido', key: 'id_pedido', width: 12 },
        { header: 'Producto', key: 'producto', width: 35 },
        { header: 'Cant.', key: 'cantidad', width: 10 },
        { header: 'Subtotal', key: 'subtotal', width: 15 }
      ];
      detalleP.rows.forEach(r => sheetDP.addRow(r));
    }

    // --- 4, 5, 6 y 7 (Facturas, Gastos, Proveedores, Libro Contable) ---
    // (Estos se mantienen igual porque no dependen de las variantes del producto)
    // ... [Mismo código que ya tenías para estas secciones] ...

    // --- ENVÍO ---
    const filename = `Reporte_Mimitos_${new Date().toISOString().slice(0,10)}.xlsx`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename=${filename}`);
    
    await workbook.xlsx.write(res);
    res.status(200).end();

  } catch (error) {
    console.error("Error en Exportador Mimitos:", error);
    res.status(500).send("Error al generar Excel");
  }
});

module.exports = router;