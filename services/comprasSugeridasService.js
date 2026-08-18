// services/comprasSugeridasService.js
//
// Motor de cálculo de Compras Sugeridas.
//
// Reglas de negocio (definidas y confirmadas en la conversación de diseño):
// - Unidad de análisis: producto_variantes (todo producto tiene al menos
//   una variante; el análisis y el stock viven siempre ahí, nunca en
//   "producto" a secas).
// - Demanda: solo pedidos con estado = 'facturado'. pendiente/confirmado/
//   entregado/cancelado quedan afuera.
// - Fórmula: demanda_proyectada = (unidades_vendidas_en_periodo / dias_analisis) * dias_cobertura
//            cantidad_necesaria  = max(0, demanda_proyectada - stock_actual)
//   (stock_minimo fue sacado de alcance a pedido explícito).
// - Se incluyen variantes CON y SIN proveedor asociado: sin proveedor,
//   la sugerencia queda "sin_proveedor: true", con la cantidad sin
//   redondear (no hay compra_minima/presentación de dónde tomarla) y
//   sirve como alerta de hueco de abastecimiento.
// - Jerarquía de configuración comercial: variante específica > producto
//   general (mismo criterio que AbastecimientoService.obtenerConfiguracionProveedor).
// - Selección de proveedor entre los activos: menor costo efectivo
//   (ultimo_precio_compra ?? costo_referencial) primero; empate se
//   resuelve con es_principal, después prioridad, después tiempo de
//   entrega. El principal NO gana por ser principal, solo desempata.
// - Redondeo: a múltiplos de (compra_minima * cantidad_por_presentacion),
//   siempre hacia arriba, expresado tanto en unidades como en la
//   presentación comercial del proveedor.
//
// Esta función no conoce Express ni React: recibe parámetros, devuelve
// un objeto plano. Pensada para reutilizarse desde Compras Sugeridas,
// pero también desde un futuro Dashboard/Reportes/Proyecciones.

const pool = require("../db");

/**
 * @param {Object} params
 * @param {number} params.periodoAnalisisDias   Ventana de ventas a analizar (ej. 30)
 * @param {number} params.periodoCoberturaDias  Días que se quiere cubrir con la compra (ej. 15)
 * @param {import('pg').PoolClient|import('pg').Pool} [client] Cliente/pool opcional (para reuso en transacciones)
 * @returns {Promise<{ parametros: object, generado_en: Date, sugerencias: Array }>}
 */
async function calcularSugerencias(
  { periodoAnalisisDias, periodoCoberturaDias },
  client = pool
) {
  if (!Number.isInteger(periodoAnalisisDias) || periodoAnalisisDias <= 0) {
    throw new Error("periodoAnalisisDias debe ser un entero mayor a 0.");
  }
  if (!Number.isInteger(periodoCoberturaDias) || periodoCoberturaDias <= 0) {
    throw new Error("periodoCoberturaDias debe ser un entero mayor a 0.");
  }

  // ==========================================
  // 1. Demanda por variante en el período de análisis
  //    Solo ventas confirmadas (pedido.estado = 'facturado').
  // ==========================================
  const demandaRes = await client.query(
    `
    SELECT
      dp.id_variante,
      dp.id_producto,
      SUM(dp.cantidad) AS unidades_vendidas
    FROM detallepedido dp
    INNER JOIN pedido p ON p.id_pedido = dp.id_pedido
    WHERE p.estado = 'facturado'
      AND p.fecha >= NOW() - ($1 || ' days')::interval
      AND dp.id_variante IS NOT NULL
    GROUP BY dp.id_variante, dp.id_producto
    HAVING SUM(dp.cantidad) > 0
    `,
    [periodoAnalisisDias]
  );

  if (demandaRes.rows.length === 0) {
    return {
      parametros: { periodoAnalisisDias, periodoCoberturaDias },
      generado_en: new Date(),
      sugerencias: [],
    };
  }

  const idsVariante = demandaRes.rows.map((r) => r.id_variante);
  const idsProducto = [...new Set(demandaRes.rows.map((r) => r.id_producto))];

  // ==========================================
  // 2. Stock actual + nombres, para las variantes con demanda
  // ==========================================
  const stockRes = await client.query(
    `
    SELECT
      pv.id_variante,
      pv.id_producto,
      pv.nombre_variante,
      pv.stock,
      p.nombre AS producto
    FROM producto_variantes pv
    INNER JOIN producto p ON p.id_producto = pv.id_producto
    WHERE pv.id_variante = ANY($1::int[])
    `,
    [idsVariante]
  );
  const stockPorVariante = new Map(stockRes.rows.map((r) => [r.id_variante, r]));

  // ==========================================
  // 3. Condiciones comerciales activas para esos productos
  //    (todas las filas, luego se resuelve jerarquía en memoria)
  // ==========================================
  const ppRes = await client.query(
    `
    SELECT
      pp.*,
      prov.nombre AS proveedor_nombre
    FROM producto_proveedor pp
    INNER JOIN proveedor prov ON prov.id_proveedor = pp.id_proveedor
    WHERE pp.id_producto = ANY($1::int[])
      AND pp.activo = TRUE
    `,
    [idsProducto]
  );
  const condicionesPorProducto = new Map();
  for (const row of ppRes.rows) {
    if (!condicionesPorProducto.has(row.id_producto)) {
      condicionesPorProducto.set(row.id_producto, []);
    }
    condicionesPorProducto.get(row.id_producto).push(row);
  }

  // ==========================================
  // 4. Armar una sugerencia por variante
  // ==========================================
  const sugerencias = [];

  for (const fila of demandaRes.rows) {
    const info = stockPorVariante.get(fila.id_variante);
    if (!info) continue; // variante inexistente/borrada, no debería pasar

    const unidadesVendidas = Number(fila.unidades_vendidas);
    const promedioDiario = unidadesVendidas / periodoAnalisisDias;
    const demandaProyectada = promedioDiario * periodoCoberturaDias;
    const stockActual = Number(info.stock);

    const cantidadNecesaria = Math.max(0, demandaProyectada - stockActual);

    // Si con el stock actual ya cubre el período pedido, no hay nada
    // que sugerir para esta variante.
    if (cantidadNecesaria <= 0) continue;

    const proveedorElegido = elegirProveedor(
      condicionesPorProducto.get(fila.id_producto) || [],
      fila.id_variante
    );

    if (!proveedorElegido) {
      // Sin proveedor asociado: se muestra igual, como alerta de hueco
      // de abastecimiento. No hay compra_minima/presentación de la cual
      // tomar el redondeo, así que se sugiere la cantidad cruda.
      sugerencias.push({
        id_producto: fila.id_producto,
        id_variante: fila.id_variante,
        producto: info.producto,
        variante: info.nombre_variante,
        stock_actual: stockActual,
        promedio_diario: round2(promedioDiario),
        demanda_proyectada: round2(demandaProyectada),
        cantidad_sugerida_unidades: Math.ceil(cantidadNecesaria),
        cantidad_sugerida_presentacion: null,
        presentacion_compra: null,
        proveedor: null,
        sin_proveedor: true,
        costo_unitario_estimado: null,
        costo_total_estimado: null,
        tiempo_entrega_dias: null,
      });
      continue;
    }

    const baseUnidades =
      proveedorElegido.compra_minima * proveedorElegido.cantidad_por_presentacion;
    const cantidadUnidadesRedondeada = redondearAMultiplo(cantidadNecesaria, baseUnidades);
    const cantidadEnPresentaciones =
      cantidadUnidadesRedondeada / proveedorElegido.cantidad_por_presentacion;

    const costoEfectivo = Number(
      proveedorElegido.ultimo_precio_compra ?? proveedorElegido.costo_referencial
    );

    sugerencias.push({
      id_producto: fila.id_producto,
      id_variante: fila.id_variante,
      producto: info.producto,
      variante: info.nombre_variante,
      stock_actual: stockActual,
      promedio_diario: round2(promedioDiario),
      demanda_proyectada: round2(demandaProyectada),
      cantidad_sugerida_unidades: cantidadUnidadesRedondeada,
      cantidad_sugerida_presentacion: cantidadEnPresentaciones,
      presentacion_compra: proveedorElegido.presentacion_compra,
      proveedor: {
        id_proveedor: proveedorElegido.id_proveedor,
        nombre: proveedorElegido.proveedor_nombre,
        es_principal: proveedorElegido.es_principal,
      },
      sin_proveedor: false,
      costo_unitario_estimado: costoEfectivo,
      costo_total_estimado: round2(costoEfectivo * cantidadUnidadesRedondeada),
      tiempo_entrega_dias: proveedorElegido.tiempo_entrega_dias,
    });
  }

  return {
    parametros: { periodoAnalisisDias, periodoCoberturaDias },
    generado_en: new Date(),
    sugerencias,
  };
}

/**
 * Resuelve qué condición comercial aplica para una variante puntual,
 * respetando la jerarquía "variante específica > producto general"
 * (mismo criterio que AbastecimientoService.obtenerConfiguracionProveedor),
 * y dentro de los candidatos resultantes elige el mejor proveedor:
 * menor costo efectivo primero; empate se resuelve con
 * es_principal > prioridad > tiempo_entrega_dias.
 */
function elegirProveedor(condicionesDelProducto, idVariante) {
  if (condicionesDelProducto.length === 0) return null;

  const especificas = condicionesDelProducto.filter(
    (c) => c.id_variante === idVariante
  );
  const candidatos = especificas.length > 0
    ? especificas
    : condicionesDelProducto.filter((c) => c.id_variante === null);

  if (candidatos.length === 0) return null;

  const costoEfectivo = (c) => Number(c.ultimo_precio_compra ?? c.costo_referencial);

  return [...candidatos].sort((a, b) => {
    const costoA = costoEfectivo(a);
    const costoB = costoEfectivo(b);
    if (costoA !== costoB) return costoA - costoB;

    if (a.es_principal !== b.es_principal) return a.es_principal ? -1 : 1;
    if (a.prioridad !== b.prioridad) return a.prioridad - b.prioridad;
    return a.tiempo_entrega_dias - b.tiempo_entrega_dias;
  })[0];
}

function redondearAMultiplo(cantidad, base) {
  if (base <= 0) return Math.ceil(cantidad);
  return Math.ceil(cantidad / base) * base;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}


module.exports = { calcularSugerencias };