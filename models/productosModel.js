const pool = require('../db');

// ─────────────────────────────────────────────────────────────────────────────
// Helper: agrupa las filas planas del JOIN en objetos con variantes anidadas.
// La query devuelve 1 fila por variante; este helper las colapsa en
// { id_producto, nombre, ..., stock_total, precio_min, precio_compra_min, variantes[] }
// ─────────────────────────────────────────────────────────────────────────────
function agruparProductosConVariantes(rows) {
  const map = new Map();

  for (const row of rows) {
    const id = row.id_producto;

    if (!map.has(id)) {
      map.set(id, {
        id_producto:    row.id_producto,
        nombre:         row.nombre,
        descripcion:    row.descripcion,
        id_categoria:   row.id_categoria,
        nombre_categoria: row.categoria_nombre ?? null,
        imagen_url:     row.imagen_url,
        // Acumuladores — se recalculan al final
        stock_total:    0,
        precio_min:     null,   // precio_venta mínimo entre variantes
        precio_compra_min: null, // precio_compra mínimo entre variantes
        variantes:      [],
        proveedores:    [],
      });
    }

    const producto = map.get(id);

    // Solo agregamos variante si el LEFT JOIN trajo una
    if (row.id_variante != null) {
      const stock      = Number(row.stock_variante)      || 0;
      const pventa     = Number(row.precio_venta_variante) || 0;
      const pcompra    = Number(row.precio_compra_variante) || 0;

      producto.variantes.push({
        id_variante:     row.id_variante,
        nombre_variante: row.nombre_variante,
        codigo_barras:   row.codigo_barras,
        stock,
        precio_venta:    pventa,
        precio_compra:   pcompra,
      });

      // Actualizar acumuladores
      producto.stock_total += stock;

      if (pventa > 0) {
        producto.precio_min =
          producto.precio_min === null ? pventa : Math.min(producto.precio_min, pventa);
      }
      if (pcompra > 0) {
        producto.precio_compra_min =
          producto.precio_compra_min === null ? pcompra : Math.min(producto.precio_compra_min, pcompra);
      }
    }
  }

  // Convertimos los nulls residuales a 0 por consistencia
  for (const p of map.values()) {
    if (p.precio_min         === null) p.precio_min         = 0;
    if (p.precio_compra_min  === null) p.precio_compra_min  = 0;
  }

  return Array.from(map.values());
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Obtener todos los productos con sus variantes agrupadas
//    FIX: antes devolvía filas planas (1 por variante) sin agrupar.
//    Ahora cada producto tiene variantes[], stock_total, precio_min y
//    precio_compra_min calculados correctamente.
// ─────────────────────────────────────────────────────────────────────────────
const obtenerTodosConVariantes = async () => {
  const query = `
    SELECT
      p.id_producto,
      p.nombre,
      p.descripcion,
      p.id_categoria,
      p.imagen_url,
      v.id_variante,
      v.nombre_variante,
      v.codigo_barras,
      v.stock            AS stock_variante,
      v.precio_venta     AS precio_venta_variante,
      v.precio_compra    AS precio_compra_variante,
      c.nombre           AS categoria_nombre
    FROM producto p
    LEFT JOIN producto_variantes v ON p.id_producto = v.id_producto
    LEFT JOIN categoria c ON p.id_categoria = c.id_categoria
    ORDER BY p.id_producto, v.id_variante;
  `;
  const { rows } = await pool.query(query);
const productos = agruparProductosConVariantes(rows);

if (productos.length === 0) return productos;

const ids = productos.map((producto) => producto.id_producto);

const proveedores = await pool.query(
  `SELECT pp.id_producto, pr.id_proveedor, pr.nombre, pr.telefono, pr.direccion
   FROM producto_proveedor pp
   JOIN proveedor pr ON pr.id_proveedor = pp.id_proveedor
   WHERE pp.id_producto = ANY($1::int[])
   ORDER BY pr.nombre ASC`,
  [ids],
);

const porProducto = new Map(
  productos.map((producto) => [producto.id_producto, producto])
);

for (const proveedor of proveedores.rows) {
  porProducto.get(proveedor.id_producto)?.proveedores.push({
    id_proveedor: proveedor.id_proveedor,
    nombre: proveedor.nombre,
    telefono: proveedor.telefono,
    direccion: proveedor.direccion,
  });
}

return productos;
};

const sincronizarProveedores = async (client, id_producto, proveedores) => {
  if (proveedores === undefined) return;

  await client.query('DELETE FROM producto_proveedor WHERE id_producto = $1', [id_producto]);
  for (const id_proveedor of proveedores) {
    await client.query(
      `INSERT INTO producto_proveedor (id_producto, id_proveedor)
       VALUES ($1, $2)
       ON CONFLICT (id_producto, id_proveedor) DO NOTHING`,
      [id_producto, id_proveedor],
    );
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. Lista simplificada (tabla principal del Front) — sin cambios de interfaz
// ─────────────────────────────────────────────────────────────────────────────
const obtenerTodos = async () => {
  const res = await pool.query(`
    SELECT
      p.id_producto,
      p.nombre,
      p.descripcion,
      c.nombre                                  AS nombre_categoria,
      COALESCE(SUM(pv.stock), 0)                AS stock_total,
      COALESCE(MIN(pv.precio_venta),  0)        AS precio_min,
      COALESCE(MIN(pv.precio_compra), 0)        AS precio_compra_min
    FROM producto p
    LEFT JOIN categoria c  ON p.id_categoria = c.id_categoria
    LEFT JOIN producto_variantes pv ON p.id_producto = pv.id_producto
    GROUP BY p.id_producto, p.nombre, p.descripcion, c.nombre
  `);
  return res.rows;
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. Insertar producto y sus variantes
// ─────────────────────────────────────────────────────────────────────────────
const insertarConVariantes = async (producto, variantes, id_usuario = null, proveedores = undefined) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

const queryProducto = `
  INSERT INTO producto (nombre, descripcion, id_categoria, imagen_url)
  VALUES ($1, $2, $3, $4) RETURNING *
`;

// Corrección aquí: client.query(queryProducto, [ ... ])
const resProd = await client.query(queryProducto, [
  producto.nombre,
  producto.descripcion,
  producto.id_categoria,
  producto.imagen_url,
]);

const nuevoProducto = resProd.rows[0];

    await sincronizarProveedores(client, nuevoProducto.id_producto, proveedores);
const queryVariante = `
  INSERT INTO producto_variantes (id_producto, nombre_variante, stock, precio_compra, precio_venta, codigo_barras)
  VALUES ($1, $2, $3, $4, $5, $6)
  RETURNING id_variante, precio_venta, precio_compra, codigo_barras
`;

    if (variantes && variantes.length > 0) {
      for (const v of variantes) {
        const varianteCreada = await client.query(queryVariante, [
          nuevoProducto.id_producto,
          v.nombre_variante || 'Único',
          Number(v.stock)         || 0,
          Number(v.precio_compra) || 0,
          Number(v.precio_venta)  || 0,
          v.codigo_barras || null,
        ]);

        // Registrar precio inicial de venta
        await client.query(
          `INSERT INTO producto_historial_precio
             (id_variante, precio_anterior, precio_nuevo, id_usuario)
           VALUES ($1, $2, $3, $4)`,
          [
            varianteCreada.rows[0].id_variante,
            null,
            varianteCreada.rows[0].precio_venta,
            id_usuario,
          ],
        );

        // ✅ Registrar costo inicial en producto_historial_costo
        await client.query(
          `INSERT INTO producto_historial_costo
             (id_producto, id_variante, costo_anterior, costo_nuevo, id_usuario)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            nuevoProducto.id_producto,
            varianteCreada.rows[0].id_variante,
            null,
            varianteCreada.rows[0].precio_compra,
            id_usuario,
          ],
        );
      }
    }

    await client.query('COMMIT');
    return nuevoProducto;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 4. Actualizar producto y sincronizar sus variantes
// ─────────────────────────────────────────────────────────────────────────────
const actualizarConVariantes = async (
  id_producto,
  datosProducto,
  variantes,
  id_usuario = null,
  proveedores = undefined,
) => {
  const { nombre, descripcion, id_categoria, imagen_url } = datosProducto;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await client.query(
      `UPDATE producto
       SET nombre = $1, descripcion = $2, id_categoria = $3, imagen_url = $4
       WHERE id_producto = $5`,
      [nombre, descripcion, id_categoria, imagen_url, id_producto],
    );

    await sincronizarProveedores(client, id_producto, proveedores);

    if (variantes && variantes.length > 0) {
      for (const v of variantes) {
        if (v.id_variante) {
          // Consultar precio de venta y costo actual antes de modificar
          const valoresActuales = await client.query(
            `SELECT precio_venta, precio_compra
             FROM producto_variantes
             WHERE id_variante = $1 AND id_producto = $2
             FOR UPDATE`,
            [v.id_variante, id_producto],
          );

          const precioNuevo = Number(v.precio_venta) || 0;
          const costoNuevo = Number(v.precio_compra) || 0;
          const varianteActualizada = await client.query(
  `UPDATE producto_variantes
    SET nombre_variante = $1, precio_compra = $2, precio_venta = $3, codigo_barras = $4
    WHERE id_variante = $5 AND id_producto = $6
    RETURNING id_variante, precio_venta, precio_compra, codigo_barras`,
  [
    v.nombre_variante,
    costoNuevo,
    precioNuevo,
    v.codigo_barras || null,
    v.id_variante,
    id_producto,
  ],
);

          // Verificar si cambió el precio de venta
          if (
            valoresActuales.rowCount > 0 &&
            varianteActualizada.rowCount > 0 &&
            Number(valoresActuales.rows[0].precio_venta) !==
              Number(varianteActualizada.rows[0].precio_venta)
          ) {
            await client.query(
              `INSERT INTO producto_historial_precio
                 (id_variante, precio_anterior, precio_nuevo, id_usuario)
               VALUES ($1, $2, $3, $4)`,
              [
                v.id_variante,
                valoresActuales.rows[0].precio_venta,
                varianteActualizada.rows[0].precio_venta,
                id_usuario,
              ],
            );
          }

          // ✅ Verificar si cambió el precio de compra (costo)
          if (
            valoresActuales.rowCount > 0 &&
            varianteActualizada.rowCount > 0 &&
            Number(valoresActuales.rows[0].precio_compra) !==
              Number(varianteActualizada.rows[0].precio_compra)
          ) {
            await client.query(
              `INSERT INTO producto_historial_costo
                 (id_producto, id_variante, costo_anterior, costo_nuevo, id_usuario)
               VALUES ($1, $2, $3, $4, $5)`,
              [
                id_producto,
                v.id_variante,
                valoresActuales.rows[0].precio_compra,
                varianteActualizada.rows[0].precio_compra,
                id_usuario,
              ],
            );
          }
        } else {
          // Nueva variante agregada
          const varianteCreada = await client.query(
  `INSERT INTO producto_variantes (id_producto, nombre_variante, stock, precio_compra, precio_venta, codigo_barras)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id_variante, precio_venta, precio_compra, codigo_barras`,
  [
    id_producto,
    v.nombre_variante,
    Number(v.stock)         || 0,
    Number(v.precio_compra) || 0,
    Number(v.precio_venta)  || 0,
    v.codigo_barras || null,
  ],
);
          await client.query(
            `INSERT INTO producto_historial_precio
               (id_variante, precio_anterior, precio_nuevo, id_usuario)
             VALUES ($1, $2, $3, $4)`,
            [
              varianteCreada.rows[0].id_variante,
              null,
              varianteCreada.rows[0].precio_venta,
              id_usuario,
            ],
          );

          // ✅ Historial para el costo inicial de la variante creada
          await client.query(
            `INSERT INTO producto_historial_costo
               (id_producto, id_variante, costo_anterior, costo_nuevo, id_usuario)
             VALUES ($1, $2, $3, $4, $5)`,
            [
              id_producto,
              varianteCreada.rows[0].id_variante,
              null,
              varianteCreada.rows[0].precio_compra,
              id_usuario,
            ],
          );
        }
      }
    }

    await client.query('COMMIT');
    return { success: true };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// ✅ Helper opcional para consultar el historial de costos por variante o producto
const obtenerHistorialCosto = async (idProducto) => {
  const query = `
    SELECT
      hc.id_historial_costo,
      hc.id_producto,
      hc.id_variante,
      hc.costo_anterior,
      hc.costo_nuevo,
      hc.fecha,
      hc.id_usuario
    FROM producto_historial_costo hc
    WHERE hc.id_producto = $1
    ORDER BY hc.fecha DESC;
  `;

  const { rows } = await pool.query(query, [idProducto]);

  return rows;
};
const obtenerHistorialPrecio = async (idVariante) => {
  const query = `
    SELECT
    hp.*
FROM producto_historial_precio hp
INNER JOIN producto_variantes pv
    ON pv.id_variante = hp.id_variante
WHERE pv.id_producto = $1
ORDER BY hp.fecha DESC;
  `;

  const { rows } = await pool.query(query, [idVariante]);

  return rows;
};
const actualizar = async (id, producto) => {
  const { nombre, descripcion, id_categoria } = producto;
  const result = await pool.query(
    'UPDATE producto SET nombre=$1, descripcion=$2, id_categoria=$3 WHERE id_producto=$4 RETURNING *',
    [nombre, descripcion, id_categoria, id],
  );
  return result.rows[0];
};

const eliminar = async (id) => {
  const result = await pool.query(
    'DELETE FROM producto WHERE id_producto = $1 RETURNING *',
    [id],
  );
  return result.rows[0];
};

const obtenerPorId = async (id) => {
  const result = await pool.query(
    'SELECT * FROM producto WHERE id_producto=$1',
    [id],
  );
  return result.rows[0];
};

const obtenerPorNombreYCategoria = async (nombre, id_categoria) => {
  const result = await pool.query(
    'SELECT * FROM producto WHERE nombre=$1 AND id_categoria=$2',
    [nombre, id_categoria],
  );
  return result.rows[0];
};

const obtenerVariantePorCodigoBarras = async (codigo_barras) => {
  const result = await pool.query(
    'SELECT id_variante FROM producto_variantes WHERE codigo_barras = $1',
    [codigo_barras],
  );
  return result.rows[0];
};
const obtenerHistorialCompras = async (id_producto) => {
  const { rows } = await pool.query(
    `
    SELECT
      c.id_compra,
      c.fecha,
      p.nombre AS proveedor,
      pv.id_variante,
      pv.nombre_variante,
      dc.cantidad,
      dc.precio_unitario,
      dc.subtotal,
      c.estado_pago,
      c.forma_pago
    FROM detalle_compra dc
    INNER JOIN compra c
      ON c.id_compra = dc.id_compra
    LEFT JOIN proveedor p
      ON p.id_proveedor = c.id_proveedor
    LEFT JOIN producto_variantes pv
      ON pv.id_variante = dc.id_variante
    WHERE dc.id_producto = $1
    ORDER BY c.fecha DESC
    `,
    [id_producto]
  );

  return rows;
};
const obtenerHistorialVentas = async (id_producto) => {
  const { rows } = await pool.query(
    `
  SELECT
    pe.id_pedido,
    pe.fecha,
    pe.estado,
    pe.total,

    CONCAT(u.nombre,' ',u.apellido) AS cliente,

    pv.id_variante,
    pv.nombre_variante,

    dp.cantidad,
    dp.precio_unitario,
    dp.subtotal
    FROM detallepedido dp
    INNER JOIN pedido pe
      ON pe.id_pedido = dp.id_pedido
    LEFT JOIN usuario u
      ON u.id_usuario = pe.id_cliente
    LEFT JOIN producto_variantes pv
      ON pv.id_variante = dp.id_variante
    WHERE dp.id_producto = $1
    ORDER BY pe.fecha DESC
    `,
    [id_producto]
  );

  return rows;
};
const obtenerHistorialPrecioProducto = async (id_producto) => {
  const { rows } = await pool.query(
    `
    SELECT
      php.id_historial_precio,
      php.fecha,
      pv.id_variante,
      pv.nombre_variante,
      php.precio_anterior,
      php.precio_nuevo,
      u.id_usuario,
      CONCAT(u.nombre, ' ', u.apellido) AS usuario
    FROM producto_historial_precio php
    INNER JOIN producto_variantes pv
      ON pv.id_variante = php.id_variante
    LEFT JOIN usuario u
      ON u.id_usuario = php.id_usuario
    WHERE pv.id_producto = $1
    ORDER BY php.fecha DESC;
    `,
    [id_producto]
  );

  return rows;
};

module.exports = {
  obtenerTodosConVariantes,
  obtenerTodos,
  insertarConVariantes,
  actualizarConVariantes,
  actualizar,
  eliminar,
  obtenerPorId,
  obtenerPorNombreYCategoria,
  obtenerVariantePorCodigoBarras,
  obtenerHistorialCosto,
  obtenerHistorialPrecio,
  obtenerHistorialCompras,
  obtenerHistorialVentas,
  obtenerHistorialPrecioProducto,

};
