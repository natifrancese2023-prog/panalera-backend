const pool = require('../db');
const stockService = require('../services/stockService');

/**
 * Registra y procesa un Ajuste de Inventario completo en una única transacción.
 * 
 * @param {Object} datos
 * @param {string} datos.id_motivo - ID válido del catálogo de motivos
 * @param {string} [datos.observacion] - Texto opcional
 * @param {number} datos.id_usuario - Usuario que registra
 * @param {string} [datos.estado='CONFIRMADO'] - 'BORRADOR' o 'CONFIRMADO'
 * @param {Array} datos.items - Lista de productos a ajustar
 */
const crearAjuste = async ({ id_motivo, observacion, id_usuario, estado = 'CONFIRMADO', items = [] }) => {
  if (!items || items.length === 0) {
    throw new Error('El ajuste debe contener al menos un producto.');
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Validar existencia del motivo
    const resMotivo = await client.query('SELECT id_motivo FROM public.ajuste_motivo WHERE id_motivo = $1', [id_motivo]);
    if (resMotivo.rowCount === 0) {
      throw new Error(`El motivo de ajuste '${id_motivo}' no es válido.`);
    }

    // 2. Crear cabecera del ajuste
    const resCabecera = await client.query(
      `INSERT INTO public.ajuste_inventario (id_motivo, observacion, id_usuario, estado)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [id_motivo, observacion || null, id_usuario, estado]
    );

    const ajuste = resCabecera.rows[0];
    const detallesProcesados = [];

    // 3. Procesar cada ítem del ajuste
    for (const item of items) {
      const { id_producto, id_variante = null, stock_contado } = item;

      if (stock_contado === undefined || stock_contado < 0) {
        throw new Error(`El stock contado para el producto ID ${id_producto} debe ser mayor o igual a 0.`);
      }

      // 3.1 Obtener stock actual del sistema con bloqueo FOR UPDATE
      let stockSistema = 0;
      if (id_variante) {
        const resStock = await client.query(
          'SELECT stock FROM public.producto_variantes WHERE id_variante = $1 FOR UPDATE',
          [id_variante]
        );
        if (resStock.rowCount === 0) throw new Error(`Variante ID ${id_variante} no encontrada.`);
        stockSistema = resStock.rows[0].stock;
      } else {
        const resStock = await client.query(
          'SELECT stock FROM public.producto WHERE id_producto = $1 FOR UPDATE',
          [id_producto]
        );
        if (resStock.rowCount === 0) throw new Error(`Producto ID ${id_producto} no encontrado.`);
        stockSistema = resStock.rows[0].stock;
      }

      const diferencia = stock_contado - stockSistema;

      // Si no hay diferencia en el conteo y ya estamos en CONFIRMADO, se omite o registra sin Kardex
      if (diferencia === 0) {
        const resDetalle = await client.query(
          `INSERT INTO public.detalle_ajuste_inventario 
           (id_ajuste, id_producto, id_variante, stock_sistema, stock_contado, cantidad_ajuste, tipo_ajuste, id_kardex)
           VALUES ($1, $2, $3, $4, $5, 0, 'SIN_CAMBIO', NULL)
           RETURNING *`,
          [ajuste.id_ajuste, id_producto, id_variante, stockSistema, stock_contado]
        );
        detallesProcesados.push(resDetalle.rows[0]);
        continue;
      }

      const tipoAjuste = diferencia > 0 ? 'POSITIVO' : 'NEGATIVO';
      const cantidadAbsoluta = Math.abs(diferencia);
      let idKardex = null;

      // 3.2 Si el estado es CONFIRMADO, impactamos stock y Kardex
      if (estado === 'CONFIRMADO') {
        const operacion = tipoAjuste === 'POSITIVO' ? 'INCREMENTO_AJUSTE' : 'DECREMENTO_AJUSTE';
        const tipoMovimiento = tipoAjuste === 'POSITIVO' 
          ? stockService.TIPOS_MOVIMIENTO.AJUSTE_POSITIVO 
          : stockService.TIPOS_MOVIMIENTO.AJUSTE_NEGATIVO;
const resultadoStock = await stockService.aplicarMovimientoStock({
          client,
          id_producto,
          id_variante,
          cantidad: cantidadAbsoluta,
          operacion,
          tipoMovimiento,
          origen: { tipo: 'AJUSTE', id: ajuste.id_ajuste },
          metadata: { id_usuario, motivo: `Ajuste (${id_motivo}): ${observacion || 'Sin observación'}` },
        });

        idKardex = resultadoStock.kardex.id_kardex;
      }

      // 3.3 Insertar renglón del detalle referenciando id_kardex
      const resDetalle = await client.query(
        `INSERT INTO public.detalle_ajuste_inventario 
         (id_ajuste, id_producto, id_variante, stock_sistema, stock_contado, cantidad_ajuste, tipo_ajuste, id_kardex)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [ajuste.id_ajuste, id_producto, id_variante, stockSistema, stock_contado, cantidadAbsoluta, tipoAjuste, idKardex]
      );

      detallesProcesados.push(resDetalle.rows[0]);
    }

    await client.query('COMMIT');

    return {
      ...ajuste,
      detalles: detallesProcesados,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

/**
 * Confirma un ajuste que previamente estaba en estado 'BORRADOR'.
 */
const confirmarBorrador = async (id_ajuste, id_usuario) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const resCab = await client.query(
      'SELECT * FROM public.ajuste_inventario WHERE id_ajuste = $1 FOR UPDATE',
      [id_ajuste]
    );

    if (resCab.rowCount === 0) throw new Error('Ajuste de inventario no encontrado.');
    const ajuste = resCab.rows[0];

    if (ajuste.estado !== 'BORRADOR') {
      throw new Error(`Solo se pueden confirmar ajustes en estado 'BORRADOR'. Estado actual: '${ajuste.estado}'`);
    }

    const resDetalles = await client.query(
      'SELECT * FROM public.detalle_ajuste_inventario WHERE id_ajuste = $1',
      [id_ajuste]
    );

    for (const det of resDetalles.rows) {
      if (det.cantidad_ajuste === 0 || det.tipo_ajuste === 'SIN_CAMBIO') continue;

      const operacion = det.tipo_ajuste === 'POSITIVO' ? 'INCREMENTO_AJUSTE' : 'DECREMENTO_AJUSTE';
      const tipoMovimiento = det.tipo_ajuste === 'POSITIVO' 
        ? stockService.TIPOS_MOVIMIENTO.AJUSTE_POSITIVO 
        : stockService.TIPOS_MOVIMIENTO.AJUSTE_NEGATIVO;
        const resultadoStock = await stockService.aplicarMovimientoStock({
  client,
  id_producto: det.id_producto,
  id_variante: det.id_variante,
  cantidad: det.cantidad_ajuste,
  operacion,
  tipoMovimiento,
  origen: {
    tipo: 'AJUSTE',
    id: ajuste.id_ajuste,
  },
  metadata: {
    id_usuario,
    motivo: `Ajuste (${ajuste.id_motivo}): ${ajuste.observacion || 'Sin observación'}`,
  },
});}

    await client.query(
      `UPDATE public.ajuste_inventario SET estado = 'CONFIRMADO' WHERE id_ajuste = $1`,
      [id_ajuste]
    );

    await client.query('COMMIT');
    return { mensaje: 'Ajuste confirmado e impactado en stock y Kardex correctamente.' };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

const obtenerTodos = async () => {
  const res = await pool.query(`
    SELECT a.*, m.descripcion AS motivo_descripcion, u.nombre AS usuario_nombre
    FROM public.ajuste_inventario a
    JOIN public.ajuste_motivo m ON a.id_motivo = m.id_motivo
    LEFT JOIN public.usuario u ON a.id_usuario = u.id_usuario
    ORDER BY a.fecha_registro DESC
  `);
  return res.rows;
};

const obtenerDetalle = async (id_ajuste) => {
  const resCab = await pool.query(`
    SELECT a.*, m.descripcion AS motivo_descripcion, u.nombre AS usuario_nombre
    FROM public.ajuste_inventario a
    JOIN public.ajuste_motivo m ON a.id_motivo = m.id_motivo
    LEFT JOIN public.usuario u ON a.id_usuario = u.id_usuario
    WHERE a.id_ajuste = $1
  `, [id_ajuste]);

  if (resCab.rowCount === 0) return null;

  const resDet = await pool.query(`
    SELECT 
      d.*, 
      p.nombre AS producto_nombre, 
      pv.nombre_variante,
      k.stock_anterior AS kardex_stock_anterior,
      k.stock_nuevo AS kardex_stock_nuevo
    FROM public.detalle_ajuste_inventario d
    JOIN public.producto p ON d.id_producto = p.id_producto
    LEFT JOIN public.producto_variantes pv ON d.id_variante = pv.id_variante
    LEFT JOIN public.kardex k ON d.id_kardex = k.id_kardex
    WHERE d.id_ajuste = $1
  `, [id_ajuste]);

  return {
    ...resCab.rows[0],
    items: resDet.rows,
  };
};

module.exports = {
  crearAjuste,
  confirmarBorrador,
  obtenerTodos,
  obtenerDetalle,
};