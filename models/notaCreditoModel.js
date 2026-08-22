const pool = require('../db');

const crear = async (client, {
  id_cliente,
  id_factura,
  monto,
  motivo = null,
  id_usuario = null,
  detalles = [],
}) => {
  const montoNumerico = Number(monto);

  if (!Number.isFinite(montoNumerico) || montoNumerico < 0) {
    throw new Error('El monto de la nota de crédito no es válido.');
  }

  if (!id_cliente || !id_factura) {
    throw new Error('La nota de crédito requiere cliente y factura.');
  }

  if (montoNumerico === 0) {
    return null;
  }

  const existente = await client.query(
    `SELECT id_nota_credito
       FROM public.nota_credito
      WHERE id_factura = $1
        AND estado <> 'anulada'
      FOR UPDATE`,
    [id_factura],
  );

  if (existente.rowCount > 0) {
    throw new Error('La factura ya posee una nota de crédito activa.');
  }

  const ncRes = await client.query(
    `INSERT INTO public.nota_credito
      (id_cliente, id_factura, monto_original, saldo_disponible, motivo, id_usuario)
     VALUES ($1, $2, $3, $3, $4, $5)
     RETURNING *`,
    [id_cliente, id_factura, montoNumerico, motivo, id_usuario],
  );

  const nota = ncRes.rows[0];

  for (const d of detalles) {
    await client.query(
      `INSERT INTO public.nota_credito_detalle
        (id_nota_credito, id_producto, id_variante, cantidad, precio_unitario, subtotal)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        nota.id_nota_credito,
        d.id_producto,
        d.id_variante || null,
        d.cantidad,
        d.precio_unitario,
        d.subtotal,
      ],
    );
  }

  return nota;
};

const obtenerTodas = async () => {
  const result = await pool.query(`
    SELECT
      nc.*,
      u.nombre AS cliente_nombre,
      u.apellido AS cliente_apellido,
      u.email AS cliente_email,
      f.id_factura
    FROM public.nota_credito nc
    JOIN public.usuario u ON u.id_usuario = nc.id_cliente
    JOIN public.factura f ON f.id_factura = nc.id_factura
    ORDER BY nc.fecha DESC
  `);

  return result.rows;
};

const obtenerPorCliente = async (id_cliente) => {
  const result = await pool.query(`
    SELECT *
    FROM public.nota_credito
    WHERE id_cliente = $1
      AND estado = 'disponible'
      AND saldo_disponible > 0
    ORDER BY fecha ASC
  `, [id_cliente]);

  return result.rows;
};

module.exports = {
  crear,
  obtenerTodas,
  obtenerPorCliente,
};
