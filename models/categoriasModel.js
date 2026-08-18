const pool = require('../db');

const obtenerTodas = async () => {
  const result = await pool.query(
    'SELECT * FROM categoria ORDER BY nombre ASC'
  );
  return result.rows;
};

const obtenerPorId = async (id) => {
  const result = await pool.query(
    'SELECT * FROM categoria WHERE id_categoria = $1',
    [id]
  );
  return result.rows[0];
};

const obtenerPorNombre = async (nombre) => {
  const result = await pool.query(
    'SELECT * FROM categoria WHERE LOWER(nombre) = LOWER($1)',
    [nombre]
  );
  return result.rows[0];
};

const insertar = async (nombre) => {
  const result = await pool.query(
    'INSERT INTO categoria (nombre) VALUES ($1) RETURNING *',
    [nombre]
  );
  return result.rows[0];
};

const eliminar = async (id) => {
  const result = await pool.query(
    'DELETE FROM categoria WHERE id_categoria = $1 RETURNING *',
    [id]
  );
  return result.rows[0];
};

module.exports = {
  obtenerTodas,
  obtenerPorId,
  obtenerPorNombre,
  insertar,
  eliminar
};