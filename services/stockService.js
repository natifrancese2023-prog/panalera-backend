// backend/services/stockService.js
const pool = require('../db');
const {
  TRANSICIONES_PERMITIDAS,
  TIPOS_MOVIMIENTO,
  OPERACIONES_STOCK,
  FACTOR_OPERACION,
} = require('../constants/stockEnums');

function validarTransicionEstado(estadoActual, nuevoEstado) {
  if (estadoActual === nuevoEstado) return true;
  const permitidos = TRANSICIONES_PERMITIDAS[estadoActual];
  if (!permitidos || !permitidos.includes(nuevoEstado)) {
    throw new Error(`Transición no permitida de '${estadoActual}' a '${nuevoEstado}'.`);
  }
  return true;
}

/**
 * Método único e inviolable para mutar inventario y registrar en Kardex.
 * Firma mediante objeto nombrado para prevenir errores de parámetros posicionales.
 */
async function aplicarMovimientoStock({
  client,
  id_producto,
  id_variante = null,
  cantidad,
  operacion,       // Valor de OPERACIONES_STOCK
  tipoMovimiento,  // Valor de TIPOS_MOVIMIENTO
  origen = {},     // { tipo: 'PEDIDO'|'COMPRA'|'VENTA_DIRECTA'|'AJUSTE', id: 123 }
  metadata = {},   // { id_usuario, motivo, id_movimiento_relacionado }
}) {
  if (!cantidad || cantidad <= 0) {
    throw new Error('La cantidad debe ser mayor a 0.');
  }

  if (!Object.values(TIPOS_MOVIMIENTO).includes(tipoMovimiento)) {
    throw new Error(`Tipo de movimiento no válido: '${tipoMovimiento}'.`);
  }

  if (!FACTOR_OPERACION.hasOwnProperty(operacion)) {
    throw new Error(`Operación de stock no soportada: '${operacion}'.`);
  }

  if (!origen.tipo || !origen.id) {
    throw new Error('El origen (tipo e id) es obligatorio para registrar en Kardex.');
  }

  const factor = FACTOR_OPERACION[operacion];
  let stockAnterior = 0;
  let stockNuevo = 0;

  // 1. Lectura explícita de stock anterior (Lock FOR UPDATE)
  if (id_variante) {
    const resPrev = await client.query(
      `SELECT stock FROM public.producto_variantes WHERE id_variante = $1 FOR UPDATE`,
      [id_variante]
    );
    if (resPrev.rowCount === 0) throw new Error(`Variante ID ${id_variante} no encontrada.`);
    stockAnterior = Number(resPrev.rows[0].stock);
  } else {
    const resPrev = await client.query(
      `SELECT stock FROM public.producto WHERE id_producto = $1 FOR UPDATE`,
      [id_producto]
    );
    if (resPrev.rowCount === 0) throw new Error(`Producto ID ${id_producto} no encontrado.`);
    stockAnterior = Number(resPrev.rows[0].stock);
  }

  // Validar si la operación de egreso supera el stock disponible
  if (factor < 0 && stockAnterior < cantidad) {
    throw new Error(`Stock insuficiente. Disponible: ${stockAnterior}, Solicitado: ${cantidad}`);
  }

  // 2. Aplicar actualización según factor numérico (+1 o -1)
  const ajusteStock = cantidad * factor;

  if (id_variante) {
    const resUpd = await client.query(
      `UPDATE public.producto_variantes SET stock = stock + $1 WHERE id_variante = $2 RETURNING stock`,
      [ajusteStock, id_variante]
    );
    stockNuevo = Number(resUpd.rows[0].stock);
  } else {
    const resUpd = await client.query(
      `UPDATE public.producto SET stock = stock + $1 WHERE id_producto = $2 RETURNING stock`,
      [ajusteStock, id_producto]
    );
    stockNuevo = Number(resUpd.rows[0].stock);
  }

  // 3. Registro inmutable en Kardex
  const resKardex = await client.query(
    `INSERT INTO public.kardex (
      id_producto, id_variante, tipo_movimiento, cantidad,
      stock_anterior, stock_nuevo, origen_tipo, origen_id,
      id_movimiento_relacionado, id_usuario, motivo_observacion
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING *`,
    [
      id_producto,
      id_variante || null,
      tipoMovimiento,
      cantidad,
      stockAnterior,
      stockNuevo,
      origen.tipo,
      origen.id,
      metadata.id_movimiento_relacionado || null,
      metadata.id_usuario || null,
      metadata.motivo || null,
    ]
  );

  return {
    stock_nuevo: stockNuevo,
    kardex: resKardex.rows[0],
  };
}

module.exports = {
  TIPOS_MOVIMIENTO,
  OPERACIONES_STOCK,
  validarTransicionEstado,
  aplicarMovimientoStock,
};