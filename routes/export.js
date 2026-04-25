const express = require('express');
const router = express.Router();
const ExcelJS = require('exceljs');
const pool = require('../db');

router.get('/export', async (req, res) => {
  const { inicio, fin, tipo } = req.query;
  const workbook = new ExcelJS.Workbook();

  try {

    // ─────────────────────────────────────────────────────────────────────────
    // 1. PRODUCTOS
    // Columnas reales: producto(id_producto, nombre, descripcion, id_categoria,
    //                           id_proveedor, imagen_url)
    //                  producto_variantes(id_variante, id_producto, nombre_variante,
    //                                     sku, stock, precio_venta, precio_compra)
    // ─────────────────────────────────────────────────────────────────────────
    if (tipo === 'todo' || tipo === 'productos') {
      const productos = await pool.query(`
        SELECT
          pr.id_producto,
          pr.nombre,
          c.nombre                      AS categoria_nombre,
          pv.sku,
          pv.nombre_variante,
          COALESCE(pv.stock, 0)         AS stock,
          COALESCE(pv.precio_venta, 0)  AS precio_venta,
          COALESCE(pv.precio_compra, 0) AS precio_compra
        FROM public.producto pr
        LEFT JOIN public.categoria c ON c.id_categoria = pr.id_categoria
        LEFT JOIN public.producto_variantes pv ON pv.id_producto = pr.id_producto
        ORDER BY pr.nombre ASC, pv.nombre_variante ASC
      `);

      const sheet = workbook.addWorksheet('Productos');
      sheet.columns = [
        { header: 'ID',            key: 'id_producto',     width: 10 },
        { header: 'Nombre',        key: 'nombre',          width: 30 },
        { header: 'Categoría',     key: 'categoria_nombre',width: 20 },
        { header: 'SKU',           key: 'sku',             width: 15 },
        { header: 'Variante',      key: 'nombre_variante', width: 15 },
        { header: 'Stock',         key: 'stock',           width: 10 },
        { header: 'Precio Venta',  key: 'precio_venta',    width: 15 },
        { header: 'Precio Compra', key: 'precio_compra',   width: 15 },
      ];
      productos.rows.forEach(r => sheet.addRow(r));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 2. COMPRAS
    // Columnas reales: compra(id_compra, id_proveedor, fecha, total,
    //                         forma_pago, estado_pago, observaciones)
    //                  proveedor(id_proveedor, nombre, telefono, direccion)
    //                  detalle_compra(id_detalle, id_compra, id_producto,
    //                                 id_variante, cantidad, precio_unitario, subtotal)
    // ─────────────────────────────────────────────────────────────────────────
    if (tipo === 'todo' || tipo === 'compras') {
      const compras = await pool.query(`
        SELECT
          c.id_compra,
          c.fecha,
          p.nombre  AS proveedor_nombre,
          c.total,
          c.forma_pago,
          c.estado_pago,
          c.observaciones
        FROM public.compra c
        JOIN public.proveedor p ON p.id_proveedor = c.id_proveedor
        WHERE DATE(c.fecha) BETWEEN $1 AND $2
        ORDER BY c.fecha DESC
      `, [inicio, fin]);

      const sheetC = workbook.addWorksheet('Compras');
      sheetC.columns = [
        { header: 'ID Compra',    key: 'id_compra',       width: 12 },
        { header: 'Fecha',        key: 'fecha',           width: 20 },
        { header: 'Proveedor',    key: 'proveedor_nombre',width: 25 },
        { header: 'Total',        key: 'total',           width: 15 },
        { header: 'Forma Pago',   key: 'forma_pago',      width: 15 },
        { header: 'Estado Pago',  key: 'estado_pago',     width: 15 },
        { header: 'Observaciones',key: 'observaciones',   width: 30 },
      ];
      compras.rows.forEach(r => sheetC.addRow(r));

      const detCompras = await pool.query(`
        SELECT
          dc.id_compra,
          pr.nombre || CASE WHEN pv.nombre_variante IS NOT NULL
                            THEN ' - ' || pv.nombre_variante
                            ELSE '' END AS producto,
          dc.cantidad,
          dc.precio_unitario,
          dc.subtotal
        FROM public.detalle_compra dc
        JOIN public.producto pr ON pr.id_producto = dc.id_producto
        LEFT JOIN public.producto_variantes pv ON pv.id_variante = dc.id_variante
        WHERE dc.id_compra IN (
          SELECT id_compra FROM public.compra WHERE DATE(fecha) BETWEEN $1 AND $2
        )
        ORDER BY dc.id_compra, dc.id_detalle
      `, [inicio, fin]);

      const sheetDC = workbook.addWorksheet('Detalle Compras');
      sheetDC.columns = [
        { header: 'Ref Compra',  key: 'id_compra',      width: 12 },
        { header: 'Producto',    key: 'producto',       width: 35 },
        { header: 'Cant.',       key: 'cantidad',       width: 10 },
        { header: 'P. Unitario', key: 'precio_unitario',width: 15 },
        { header: 'Subtotal',    key: 'subtotal',       width: 15 },
      ];
      detCompras.rows.forEach(r => sheetDC.addRow(r));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 3. PEDIDOS
    // Columnas reales: pedido(id_pedido, id_cliente, fecha, total, estado[ENUM])
    //                  detallepedido(id_detalle, id_pedido, id_producto,
    //                                id_variante, cantidad, subtotal)
    //                  usuario(id_usuario, nombre, apellido, email, telefono, rol)
    // Nota: estado es USER-DEFINED (ENUM), se castea a text para exportar
    // ─────────────────────────────────────────────────────────────────────────
    if (tipo === 'todo' || tipo === 'pedidos') {
      const pedidos = await pool.query(`
        SELECT
          p.id_pedido,
          p.fecha,
          p.estado::text,
          p.total,
          u.apellido || ', ' || u.nombre AS cliente,
          u.email,
          u.telefono
        FROM public.pedido p
        JOIN public.usuario u ON u.id_usuario = p.id_cliente
        WHERE DATE(p.fecha) BETWEEN $1 AND $2
        ORDER BY p.fecha DESC
      `, [inicio, fin]);

      const sheetP = workbook.addWorksheet('Pedidos');
      sheetP.columns = [
        { header: 'ID Pedido', key: 'id_pedido', width: 12 },
        { header: 'Fecha',     key: 'fecha',     width: 20 },
        { header: 'Estado',    key: 'estado',    width: 15 },
        { header: 'Cliente',   key: 'cliente',   width: 35 },
        { header: 'Email',     key: 'email',     width: 30 },
        { header: 'Teléfono',  key: 'telefono',  width: 15 },
        { header: 'Total',     key: 'total',     width: 15 },
      ];
      pedidos.rows.forEach(r => sheetP.addRow(r));

      const detalleP = await pool.query(`
        SELECT
          dp.id_pedido,
          pr.nombre || CASE WHEN pv.nombre_variante IS NOT NULL
                            THEN ' - ' || pv.nombre_variante
                            ELSE '' END AS producto,
          dp.cantidad,
          dp.subtotal
        FROM public.detallepedido dp
        JOIN public.producto pr ON pr.id_producto = dp.id_producto
        LEFT JOIN public.producto_variantes pv ON pv.id_variante = dp.id_variante
        WHERE dp.id_pedido IN (
          SELECT id_pedido FROM public.pedido WHERE DATE(fecha) BETWEEN $1 AND $2
        )
        ORDER BY dp.id_pedido, dp.id_detalle
      `, [inicio, fin]);

      const sheetDP = workbook.addWorksheet('Detalle Pedidos');
      sheetDP.columns = [
        { header: 'Ref Pedido', key: 'id_pedido', width: 12 },
        { header: 'Producto',   key: 'producto',  width: 35 },
        { header: 'Cant.',      key: 'cantidad',  width: 10 },
        { header: 'Subtotal',   key: 'subtotal',  width: 15 },
      ];
      detalleP.rows.forEach(r => sheetDP.addRow(r));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 4. FACTURAS
    // Columnas reales: factura(id_factura, id_pedido, fecha, total,
    //                          forma_pago, observaciones)
    // No tiene id_cliente directo → se obtiene via pedido → usuario
    // ─────────────────────────────────────────────────────────────────────────
    if (tipo === 'todo' || tipo === 'resumen') {
      const facturas = await pool.query(`
        SELECT
          f.id_factura,
          f.fecha,
          f.total,
          f.forma_pago,
          f.observaciones,
          u.apellido || ', ' || u.nombre AS cliente,
          u.email
        FROM public.factura f
        JOIN public.pedido p  ON p.id_pedido   = f.id_pedido
        JOIN public.usuario u ON u.id_usuario  = p.id_cliente
        WHERE DATE(f.fecha) BETWEEN $1 AND $2
        ORDER BY f.fecha DESC
      `, [inicio, fin]);

      const sheetF = workbook.addWorksheet('Facturas');
      sheetF.columns = [
        { header: 'ID Factura',   key: 'id_factura',   width: 12 },
        { header: 'Fecha',        key: 'fecha',        width: 20 },
        { header: 'Cliente',      key: 'cliente',      width: 35 },
        { header: 'Email',        key: 'email',        width: 30 },
        { header: 'Total',        key: 'total',        width: 15 },
        { header: 'Forma Pago',   key: 'forma_pago',   width: 15 },
        { header: 'Observaciones',key: 'observaciones',width: 30 },
      ];
      facturas.rows.forEach(r => sheetF.addRow(r));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 5. GASTOS
    // Columnas reales: gasto(id_gasto, descripcion, categoria, monto,
    //                        fecha, forma_pago)
    // ─────────────────────────────────────────────────────────────────────────
    if (tipo === 'todo' || tipo === 'resumen') {
      const gastos = await pool.query(`
        SELECT
          g.id_gasto,
          g.fecha,
          g.categoria,
          g.descripcion,
          g.monto,
          g.forma_pago
        FROM public.gasto g
        WHERE DATE(g.fecha) BETWEEN $1 AND $2
        ORDER BY g.fecha DESC
      `, [inicio, fin]);

      const sheetG = workbook.addWorksheet('Gastos');
      sheetG.columns = [
        { header: 'ID Gasto',    key: 'id_gasto',    width: 12 },
        { header: 'Fecha',       key: 'fecha',       width: 20 },
        { header: 'Categoría',   key: 'categoria',   width: 20 },
        { header: 'Descripción', key: 'descripcion', width: 35 },
        { header: 'Monto',       key: 'monto',       width: 15 },
        { header: 'Forma Pago',  key: 'forma_pago',  width: 15 },
      ];
      gastos.rows.forEach(r => sheetG.addRow(r));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 6. LIBRO CONTABLE — movimientos del período ordenados por fecha
    // Une facturas (ingresos) + gastos (egresos) + compras (egresos)
    // ─────────────────────────────────────────────────────────────────────────
    if (tipo === 'todo' || tipo === 'resumen') {
      const libro = await pool.query(`
        SELECT fecha::date AS dia, 'Ingreso' AS tipo, 'Venta' AS concepto, total AS monto
        FROM public.factura
        WHERE DATE(fecha) BETWEEN $1 AND $2

        UNION ALL

        SELECT fecha::date, 'Egreso', 'Gasto: ' || COALESCE(categoria, 'Sin categoría'), monto
        FROM public.gasto
        WHERE DATE(fecha) BETWEEN $1 AND $2

        UNION ALL

        SELECT c.fecha::date, 'Egreso', 'Compra a: ' || p.nombre, c.total
        FROM public.compra c
        JOIN public.proveedor p ON p.id_proveedor = c.id_proveedor
        WHERE DATE(c.fecha) BETWEEN $1 AND $2

        ORDER BY dia DESC
      `, [inicio, fin]);

      const sheetL = workbook.addWorksheet('Libro Contable');
      sheetL.columns = [
        { header: 'Fecha',    key: 'dia',      width: 15 },
        { header: 'Tipo',     key: 'tipo',     width: 12 },
        { header: 'Concepto', key: 'concepto', width: 35 },
        { header: 'Monto',    key: 'monto',    width: 15 },
      ];
      libro.rows.forEach(r => sheetL.addRow(r));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ENVÍO
    // ─────────────────────────────────────────────────────────────────────────
    const filename = `Reporte_Mimitos_${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${filename}`);

    await workbook.xlsx.write(res);
    res.status(200).end();

  } catch (error) {
    console.error('Error en Exportador Mimitos:', error);
    res.status(500).send('Error al generar Excel');
  }
});

module.exports = router;