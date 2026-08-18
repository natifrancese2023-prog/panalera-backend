const pool = require('../db');
const { AppError } = require('./errors');

const obtenerTodos = async () => {
  const result = await pool.query(
    'SELECT id_proveedor, nombre, telefono, direccion FROM proveedor ORDER BY nombre ASC'
  );
  return result.rows;
};

const obtenerPorId = async (id) => {
  const { rows } = await pool.query(
    `
    SELECT

        p.id_proveedor,
        p.nombre,
        p.telefono,
        p.direccion,
        p.created_at,

        COALESCE(prod.cantidad_productos,0) AS cantidad_productos,

        COALESCE(comp.cantidad_compras,0) AS cantidad_compras,

        COALESCE(comp.total_comprado,0) AS total_comprado,

        comp.ultima_compra

    FROM proveedor p

    /*-----------------------------------------
      Resumen de productos asociados.
      Se cuentan solo los ACTIVOS a propósito:
      esta tarjeta responde "a cuántos productos
      le abastezco hoy", no "cuántas filas hay
      históricamente". Las inactivas se ven igual
      en la pestaña Productos Asociados.
    -----------------------------------------*/
    LEFT JOIN (

        SELECT
            id_proveedor,
            COUNT(DISTINCT id_producto) AS cantidad_productos
        FROM producto_proveedor
        WHERE activo = TRUE
        GROUP BY id_proveedor

    ) prod
        ON prod.id_proveedor = p.id_proveedor

    /*-----------------------------------------
      Resumen de compras
    -----------------------------------------*/
    LEFT JOIN (

        SELECT
            id_proveedor,
            COUNT(*) AS cantidad_compras,
            SUM(total) AS total_comprado,
            MAX(fecha) AS ultima_compra
        FROM compra
        GROUP BY id_proveedor

    ) comp
        ON comp.id_proveedor = p.id_proveedor

    WHERE p.id_proveedor = $1;
    `,
    [id]
  );

  return rows[0];
};

const insertar = async (datos) => {
  const { nombre, telefono, direccion } = datos;
  const result = await pool.query(
    `INSERT INTO proveedor (nombre, telefono, direccion) 
     VALUES ($1, $2, $3) RETURNING *`,
    [nombre, telefono, direccion]
  );
  return result.rows[0];
};

const actualizar = async (id, datos) => {
  const { nombre, telefono, direccion } = datos;
  const result = await pool.query(
    `UPDATE proveedor 
     SET nombre = $1, telefono = $2, direccion = $3 
     WHERE id_proveedor = $4 RETURNING *`,
    [nombre, telefono, direccion, id]
  );
  return result.rows[0];
};

const eliminar = async (id) => {
  const result = await pool.query(
    'DELETE FROM proveedor WHERE id_proveedor = $1 RETURNING *', 
    [id]
  );
  return result.rows[0];
};

// ==========================================
// PRODUCTO_PROVEEDOR — fuente única de verdad
// ==========================================
// Toda alta/edición/consulta de la relación comercial
// producto-proveedor vive acá. AbastecimientoService puede
// LEER de esta tabla para sus propios fines (resolver condiciones
// en el momento de una compra), pero no debe reimplementar
// alta/edición: para eso llama a estas funciones.

const asociarProductoProveedor = async (datos) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const {
      id_proveedor,
      id_producto,
      id_variante = null,
      codigo_producto_proveedor = null,
      costo_referencial = 0,
      compra_minima = 1,
      tiempo_entrega_dias = 1,
      es_principal = false,
      prioridad = 1,
      activo = true,
    } = datos;

    // Solo puede existir un proveedor principal por producto/variante
    if (es_principal) {
      await client.query(
        `
        UPDATE producto_proveedor
        SET es_principal = FALSE
        WHERE id_producto = $1
          AND id_variante IS NOT DISTINCT FROM $2
        `,
        [id_producto, id_variante]
      );
    }

    // Alta o reactivación atómica (ON CONFLICT sobre ux_producto_proveedor)
    const { rows } = await client.query(
      `
      INSERT INTO producto_proveedor (
        id_proveedor, id_producto, id_variante,
        codigo_producto_proveedor, costo_referencial, compra_minima,
        tiempo_entrega_dias, es_principal, prioridad, activo
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      ON CONFLICT (id_proveedor, id_producto, (COALESCE(id_variante,0)))
      DO UPDATE SET
        codigo_producto_proveedor = EXCLUDED.codigo_producto_proveedor,
        costo_referencial        = EXCLUDED.costo_referencial,
        compra_minima            = EXCLUDED.compra_minima,
        tiempo_entrega_dias      = EXCLUDED.tiempo_entrega_dias,
        es_principal             = EXCLUDED.es_principal,
        prioridad                = EXCLUDED.prioridad,
        activo                   = TRUE
      WHERE producto_proveedor.activo = FALSE
      RETURNING *;
      `,
      [
        id_proveedor, id_producto, id_variante,
        codigo_producto_proveedor, costo_referencial, compra_minima,
        tiempo_entrega_dias, es_principal, prioridad, activo,
      ]
    );

    if (rows.length === 0) {
      throw new AppError(
        "El producto ya está asociado a este proveedor.",
        409
      );
    }

    await client.query("COMMIT");
    return rows[0];

  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const actualizarProductoProveedor = async (datos) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const {
      id_proveedor,
      id_producto,
      id_variante = null,
      codigo_producto_proveedor = null,
      costo_referencial = 0,
      compra_minima = 1,
      tiempo_entrega_dias = 1,
      es_principal = false,
      prioridad = 1,
      activo = true,
    } = datos;

    if (es_principal) {
      await client.query(
        `
        UPDATE producto_proveedor
        SET es_principal = FALSE
        WHERE id_producto = $1
          AND id_variante IS NOT DISTINCT FROM $2
        `,
        [id_producto, id_variante]
      );
    }

    const { rows } = await client.query(
      `
      UPDATE producto_proveedor
      SET
        codigo_producto_proveedor = $4,
        costo_referencial = $5,
        compra_minima = $6,
        tiempo_entrega_dias = $7,
        es_principal = $8,
        prioridad = $9,
        activo = $10
      WHERE id_proveedor = $1
        AND id_producto = $2
        AND id_variante IS NOT DISTINCT FROM $3
      RETURNING *;
      `,
      [
        id_proveedor, id_producto, id_variante,
        codigo_producto_proveedor, costo_referencial, compra_minima,
        tiempo_entrega_dias, es_principal, prioridad, activo,
      ]
    );

    if (rows.length === 0) {
      throw new AppError("No se encontró la relación.", 404);
    }

    await client.query("COMMIT");
    return rows[0];

  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const cambiarEstadoProductoProveedor = async (
  id_proveedor,
  id_producto,
  id_variante,
  activo
) => {
  const { rows } = await pool.query(
    `
    UPDATE producto_proveedor
    SET activo = $4
    WHERE id_proveedor = $1
      AND id_producto = $2
      AND id_variante IS NOT DISTINCT FROM $3
    RETURNING *;
    `,
    [id_proveedor, id_producto, id_variante, activo]
  );

  return rows[0];
};

// FIX (cierre de auditoría): ya no filtra por activo=TRUE.
// La pestaña "Productos Asociados" muestra activos e inactivos
// (decisión de producto ya acordada); el frontend distingue con
// badge de estado y decide qué acciones ofrecer en cada caso.
const obtenerProductosProveedor = async (idProveedor) => {
  const query = `
    SELECT
      pp.id_proveedor,
      pp.id_producto,
      pp.id_variante,
      p.nombre AS producto,
      pv.nombre_variante,
      pp.codigo_producto_proveedor,
      pp.costo_referencial,
      pp.compra_minima,
      pp.tiempo_entrega_dias,
      pp.es_principal,
      pp.prioridad,
      pp.activo,
      pp.ultimo_precio_compra,
      pp.fecha_ultima_compra
    FROM producto_proveedor pp
    INNER JOIN producto p
      ON p.id_producto = pp.id_producto
    LEFT JOIN producto_variantes pv
      ON pv.id_variante = pp.id_variante
    WHERE pp.id_proveedor = $1
    ORDER BY
      pp.activo DESC,
      pp.es_principal DESC,
      pp.prioridad ASC,
      p.nombre ASC;
  `;

  const { rows } = await pool.query(query, [idProveedor]);

  return rows;
};

module.exports = {
  obtenerTodos,
  obtenerPorId,
  insertar,
  actualizar,
  eliminar,
  obtenerProductosProveedor,
  asociarProductoProveedor,
  actualizarProductoProveedor,
  cambiarEstadoProductoProveedor,
};