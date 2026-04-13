const pool = require('../db');

exports.obtenerTodos = async () => {
  const result = await pool.query(
    'SELECT * FROM gasto ORDER BY fecha DESC'
  );
  return result.rows;
};

exports.insertar = async ({ descripcion, categoria, monto, forma_pago, fecha }) => {
  const result = await pool.query(
    `INSERT INTO gasto (descripcion, categoria, monto, forma_pago, fecha)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [descripcion, categoria || null, monto, forma_pago || null, fecha || new Date()]
  );
  return result.rows[0];
};

exports.actualizar = async (id, { descripcion, categoria, monto, forma_pago, fecha }) => {
  const result = await pool.query(
    `UPDATE gasto SET descripcion=$1, categoria=$2, monto=$3, forma_pago=$4, fecha=$5
     WHERE id_gasto=$6 RETURNING *`,
    [descripcion, categoria || null, monto, forma_pago || null, fecha, id]
  );
  return result.rows[0];
};

exports.eliminar = async (id) => {
  const result = await pool.query(
    'DELETE FROM gasto WHERE id_gasto=$1 RETURNING *', [id]
  );
  return result.rows[0];
};