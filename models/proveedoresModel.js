const pool = require('../db');

exports.obtenerTodos = async () => {
  const result = await pool.query(
    'SELECT * FROM proveedor ORDER BY nombre ASC'
  );
  return result.rows;
};

exports.obtenerPorId = async (id) => {
  const result = await pool.query(
    'SELECT * FROM proveedor WHERE id_proveedor = $1',
    [id]
  );
  return result.rows[0];
};

exports.insertar = async ({ nombre, telefono, email, direccion, cuit }) => {
  const result = await pool.query(
    `INSERT INTO proveedor (nombre, telefono, email, direccion, cuit)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [nombre, telefono || null, email || null, direccion || null, cuit || null]
  );
  return result.rows[0];
};

exports.actualizar = async (id, { nombre, telefono, email, direccion, cuit }) => {
  const result = await pool.query(
    `UPDATE proveedor
     SET nombre=$1, telefono=$2, email=$3, direccion=$4, cuit=$5
     WHERE id_proveedor=$6 RETURNING *`,
    [nombre, telefono || null, email || null, direccion || null, cuit || null, id]
  );
  return result.rows[0];
};

exports.eliminar = async (id) => {
  const result = await pool.query(
    'DELETE FROM proveedor WHERE id_proveedor = $1 RETURNING *',
    [id]
  );
  return result.rows[0];
};