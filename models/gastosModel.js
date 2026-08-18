const pool = require('../db');
const cajaModel = require('./cajaModel');

const obtenerTodos = async () => {
  const result = await pool.query(
    'SELECT * FROM gasto ORDER BY fecha DESC'
  );
  return result.rows;
};

// FIX/INTEGRACIÓN (Fase 3 -- Caja): antes era un pool.query suelto.
// Ahora corre dentro de una transacción para poder registrar, en el
// mismo commit, el egreso correspondiente en la caja abierta -- mismo
// patrón que ya usan ventaModel y cuentaCorrienteModel.
//
// Si no hay caja abierta, o el gasto no tiene forma_pago cargada (es
// un campo opcional en este módulo), simplemente no se genera
// movimiento de caja -- el gasto se guarda igual, no se bloquea nada.
// No se puede clasificar un egreso sin saber con qué se pagó, así que
// preferimos omitirlo antes que adivinar.
const insertar = async ({ descripcion, categoria, monto, forma_pago, fecha }, id_usuario = null) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query(
      `INSERT INTO gasto (descripcion, categoria, monto, forma_pago, fecha)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [descripcion, categoria || null, monto, forma_pago || null, fecha || new Date()]
    );
    const gasto = result.rows[0];

    if (forma_pago) {
      await cajaModel.registrarMovimiento(client, {
        tipo: 'egreso',
        origen: 'gasto',
        forma_pago,
        monto,
        id_referencia: gasto.id_gasto,
        observaciones: descripcion,
        id_usuario,
      });
    }

    await client.query('COMMIT');
    return gasto;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// Mantiene sincronizado el movimiento de caja del gasto (si existe):
// si cambia el monto o la forma de pago, se refleja también ahí. Si
// el gasto no tenía movimiento de caja (no tenía forma_pago, o no
// había caja abierta cuando se cargó) y ahora sí tiene forma_pago,
// NO se crea uno nuevo retroactivo -- solo se sincroniza el que ya
// existía, para no alterar el historial de una caja que quizás ya
// cerró. Si necesitás reflejar el cambio, hacelo desde Caja.
const actualizar = async (id, { descripcion, categoria, monto, forma_pago, fecha }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query(
      `UPDATE gasto SET descripcion=$1, categoria=$2, monto=$3, forma_pago=$4, fecha=$5
       WHERE id_gasto=$6 RETURNING *`,
      [descripcion, categoria || null, monto, forma_pago || null, fecha, id]
    );
    const gasto = result.rows[0];

    if (gasto) {
      await client.query(
        `
        UPDATE caja_movimiento
        SET monto = $2, forma_pago = $3, observaciones = $4
        WHERE origen = 'gasto' AND id_referencia = $1
        `,
        [id, monto, forma_pago || null, descripcion]
      );
    }

    await client.query('COMMIT');
    return gasto;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// Si el gasto tenía movimiento de caja asociado, se elimina junto con
// él -- no debería quedar un egreso "huérfano" en caja por un gasto
// que ya no existe.
const eliminar = async (id) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query(
      `DELETE FROM caja_movimiento WHERE origen = 'gasto' AND id_referencia = $1`,
      [id]
    );

    const result = await client.query(
      'DELETE FROM gasto WHERE id_gasto=$1 RETURNING *',
      [id]
    );

    await client.query('COMMIT');
    return result.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

module.exports = {
  obtenerTodos,
  insertar,
  actualizar,
  eliminar
};