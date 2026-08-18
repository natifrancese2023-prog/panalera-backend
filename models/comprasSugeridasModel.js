const pool = require("../db");
const { AppError } = require("./errors");

/**
 * Crea una o más Compras Sugeridas (una por proveedor) a partir de los
 * ítems que el usuario confirmó en la grilla.
 *
 * @param {Array} items  [{ id_producto, id_variante, id_proveedor,
 *                          cantidad_confirmada_unidades,
 *                          cantidad_sugerida_unidades,
 *                          presentacion_compra, cantidad_por_presentacion,
 *                          costo_unitario_estimado }]
 * @param {Object} opciones { periodoAnalisisDias, periodoCoberturaDias, observaciones, id_usuario }
 * @returns {Promise<Array>} las cabeceras de compra_sugerida creadas
 */
const crearDesdeGrilla = async (items, opciones) => {
  const { periodoAnalisisDias, periodoCoberturaDias, observaciones = null, id_usuario = null } = opciones;

  if (!Array.isArray(items) || items.length === 0) {
    throw new AppError("No hay ítems para confirmar.", 400);
  }

  const sinProveedor = items.filter((i) => !i.id_proveedor);
  if (sinProveedor.length > 0) {
    throw new AppError(
      `Hay ${sinProveedor.length} ítem(s) sin proveedor asignado. Asigná un proveedor antes de confirmar.`,
      400
    );
  }

  // Agrupar por proveedor -- una compra_sugerida por proveedor,
  // porque una compra real siempre pertenece a un solo proveedor.
  const grupos = new Map();
  for (const item of items) {
    if (!grupos.has(item.id_proveedor)) grupos.set(item.id_proveedor, []);
    grupos.get(item.id_proveedor).push(item);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const cabeceras = [];

    for (const [id_proveedor, itemsDelProveedor] of grupos) {
      const { rows } = await client.query(
        `
        INSERT INTO compra_sugerida (
          id_proveedor, periodo_analisis_dias, periodo_cobertura_dias,
          observaciones, id_usuario
        )
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *;
        `,
        [id_proveedor, periodoAnalisisDias, periodoCoberturaDias, observaciones, id_usuario]
      );
      const cabecera = rows[0];

      for (const item of itemsDelProveedor) {
        if (!item.cantidad_confirmada_unidades || item.cantidad_confirmada_unidades <= 0) {
          throw new AppError(
            `Cantidad inválida para el producto ${item.id_producto}.`,
            400
          );
        }

        await client.query(
          `
          INSERT INTO detalle_compra_sugerida (
            id_compra_sugerida, id_producto, id_variante,
            cantidad_sugerida_unidades, cantidad_confirmada_unidades,
            presentacion_compra, cantidad_por_presentacion,
            costo_unitario_estimado
          )
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8);
          `,
          [
            cabecera.id_compra_sugerida,
            item.id_producto,
            item.id_variante || null,
            item.cantidad_sugerida_unidades ?? item.cantidad_confirmada_unidades,
            item.cantidad_confirmada_unidades,
            item.presentacion_compra || null,
            item.cantidad_por_presentacion || 1,
            item.costo_unitario_estimado ?? null,
          ]
        );
      }

      cabeceras.push(cabecera);
    }

    await client.query("COMMIT");
    return cabeceras;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const listarPendientes = async () => {
  const { rows } = await pool.query(
    `
    SELECT
      cs.*,
      prov.nombre AS proveedor_nombre,
      COUNT(dcs.id_detalle_sugerido) AS cantidad_items
    FROM compra_sugerida cs
    INNER JOIN proveedor prov ON prov.id_proveedor = cs.id_proveedor
    LEFT JOIN detalle_compra_sugerida dcs ON dcs.id_compra_sugerida = cs.id_compra_sugerida
    WHERE cs.estado = 'pendiente'
    GROUP BY cs.id_compra_sugerida, prov.nombre
    ORDER BY cs.generado_en DESC;
    `
  );
  return rows;
};

const obtenerPorId = async (id) => {
  const cabeceraRes = await pool.query(
    `
    SELECT cs.*, prov.nombre AS proveedor_nombre, prov.telefono AS proveedor_telefono
    FROM compra_sugerida cs
    INNER JOIN proveedor prov ON prov.id_proveedor = cs.id_proveedor
    WHERE cs.id_compra_sugerida = $1;
    `,
    [id]
  );
  const cabecera = cabeceraRes.rows[0];
  if (!cabecera) return null;

  const detalleRes = await pool.query(
    `
    SELECT
      dcs.*,
      p.nombre AS producto,
      pv.nombre_variante
    FROM detalle_compra_sugerida dcs
    INNER JOIN producto p ON p.id_producto = dcs.id_producto
    LEFT JOIN producto_variantes pv ON pv.id_variante = dcs.id_variante
    WHERE dcs.id_compra_sugerida = $1
    ORDER BY p.nombre ASC;
    `,
    [id]
  );

  return { ...cabecera, items: detalleRes.rows };
};

/**
 * Da forma a una Compra Sugerida pendiente para precargar el modal de
 * "Nueva compra" del módulo Compras ya existente (no crea la compra en
 * sí -- eso lo sigue haciendo comprasModel.insertar cuando el usuario
 * confirme desde ahí, sin duplicar esa lógica).
 */
const prepararParaCompra = async (id) => {
  const sugerida = await obtenerPorId(id);
  if (!sugerida) throw new AppError("Compra sugerida no encontrada.", 404);
  if (sugerida.estado !== "pendiente") {
    throw new AppError("Esta compra sugerida ya fue registrada.", 409);
  }

  return {
    id_proveedor: sugerida.id_proveedor,
    proveedor_nombre: sugerida.proveedor_nombre,
    productos: sugerida.items.map((item) => ({
      id_producto: item.id_producto,
      id_variante: item.id_variante,
      cantidad: item.cantidad_confirmada_unidades,
      // Precio precargado a modo de punto de partida -- el usuario lo
      // puede modificar en el módulo Compras, como cualquier otra línea.
      precio_unitario: item.costo_unitario_estimado,
    })),
  };
};

const marcarRegistrada = async (id, id_compra) => {
  const { rows } = await pool.query(
    `
    UPDATE compra_sugerida
    SET estado = 'registrada', id_compra = $2, registrado_en = NOW()
    WHERE id_compra_sugerida = $1 AND estado = 'pendiente'
    RETURNING *;
    `,
    [id, id_compra]
  );
  if (rows.length === 0) {
    throw new AppError(
      "No se encontró la compra sugerida pendiente, o ya fue registrada.",
      409
    );
  }
  return rows[0];
};

/**
 * Lista TODOS los proveedores activos disponibles para un producto/variante
 * (respetando la jerarquía variante específica > producto general),
 * ordenados con el mismo criterio que usa el motor para elegir el mejor.
 * Sirve para que el usuario pueda cambiar manualmente el proveedor
 * sugerido en la grilla, viendo las alternativas reales.
 */
const obtenerProveedoresDisponibles = async (idProducto, idVariante) => {
  const { rows } = await pool.query(
    `
    SELECT pp.*, prov.nombre AS proveedor_nombre
    FROM producto_proveedor pp
    INNER JOIN proveedor prov ON prov.id_proveedor = pp.id_proveedor
    WHERE pp.id_producto = $1
      AND pp.activo = TRUE
      AND (pp.id_variante = $2 OR pp.id_variante IS NULL)
    `,
    [idProducto, idVariante || null]
  );

  const especificas = rows.filter((r) => r.id_variante === idVariante);
  const candidatos = especificas.length > 0
    ? especificas
    : rows.filter((r) => r.id_variante === null);

  const costoEfectivo = (c) => Number(c.ultimo_precio_compra ?? c.costo_referencial);

  return [...candidatos].sort((a, b) => {
    const costoA = costoEfectivo(a);
    const costoB = costoEfectivo(b);
    if (costoA !== costoB) return costoA - costoB;
    if (a.es_principal !== b.es_principal) return a.es_principal ? -1 : 1;
    if (a.prioridad !== b.prioridad) return a.prioridad - b.prioridad;
    return a.tiempo_entrega_dias - b.tiempo_entrega_dias;
  }).map((c) => ({
    id_proveedor: c.id_proveedor,
    proveedor_nombre: c.proveedor_nombre,
    es_principal: c.es_principal,
    costo_efectivo: costoEfectivo(c),
    compra_minima: c.compra_minima,
    presentacion_compra: c.presentacion_compra,
    cantidad_por_presentacion: c.cantidad_por_presentacion,
    tiempo_entrega_dias: c.tiempo_entrega_dias,
  }));
};

module.exports = {
  crearDesdeGrilla,
  listarPendientes,
  obtenerPorId,
  prepararParaCompra,
  marcarRegistrada,
  obtenerProveedoresDisponibles,
};