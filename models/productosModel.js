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
  console.log("FILAS SQL TOTALES:", rows.length);
  console.log("FILAS:", JSON.stringify(rows.map(r => ({ id: r.id_producto, nombre: r.nombre, stock: r.stock_variante }))));
  return agruparProductosConVariantes(rows);
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
// 3. Insertar producto y sus variantes (transacción segura) — sin cambios
// ─────────────────────────────────────────────────────────────────────────────
const insertarConVariantes = async (producto, variantes) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const queryProducto = `
      INSERT INTO producto (nombre, descripcion, id_categoria, imagen_url)
      VALUES ($1, $2, $3, $4) RETURNING *
    `;
    const resProd = await client.query(queryProducto, [
      producto.nombre,
      producto.descripcion,
      producto.id_categoria,
      producto.imagen_url,
    ]);

    const nuevoProducto = resProd.rows[0];

    const queryVariante = `
      INSERT INTO producto_variantes (id_producto, nombre_variante, stock, precio_compra, precio_venta)
      VALUES ($1, $2, $3, $4, $5)
    `;

    if (variantes && variantes.length > 0) {
      for (const v of variantes) {
        await client.query(queryVariante, [
          nuevoProducto.id_producto,
          v.nombre_variante || 'Único',
          Number(v.stock)         || 0,
          Number(v.precio_compra) || 0,
          Number(v.precio_venta)  || 0,
        ]);
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
//    FIX: la firma anterior era (id, datos) pero el controller pasaba
//    (id, datosProducto, variantes) como tercer argumento separado.
//    Ahora la firma es explícita: (id_producto, datosProducto, variantes)
// ─────────────────────────────────────────────────────────────────────────────
const actualizarConVariantes = async (id_producto, datosProducto, variantes) => {
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

    if (variantes && variantes.length > 0) {
      for (const v of variantes) {
        if (v.id_variante) {
          await client.query(
            `UPDATE producto_variantes
             SET nombre_variante = $1, stock = $2, precio_compra = $3, precio_venta = $4
             WHERE id_variante = $5 AND id_producto = $6`,
            [
              v.nombre_variante,
              Number(v.stock)         || 0,
              Number(v.precio_compra) || 0,
              Number(v.precio_venta)  || 0,
              v.id_variante,
              id_producto,
            ],
          );
        } else {
          await client.query(
            `INSERT INTO producto_variantes (id_producto, nombre_variante, stock, precio_compra, precio_venta)
             VALUES ($1, $2, $3, $4, $5)`,
            [
              id_producto,
              v.nombre_variante,
              Number(v.stock)         || 0,
              Number(v.precio_compra) || 0,
              Number(v.precio_venta)  || 0,
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

module.exports = {
  obtenerTodosConVariantes,
  obtenerTodos,
  insertarConVariantes,
  actualizarConVariantes,
  actualizar,
  eliminar,
  obtenerPorId,
  obtenerPorNombreYCategoria,
};