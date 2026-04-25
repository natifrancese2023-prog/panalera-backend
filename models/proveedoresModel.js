const pool = require('../db');

const obtenerTodos = async () => {
  const result = await pool.query(
    'SELECT id_proveedor, nombre, telefono, direccion FROM proveedor ORDER BY nombre ASC'
  );
  return result.rows;
};

const obtenerPorId = async (id) => {
  const result = await pool.query(
    'SELECT * FROM proveedor WHERE id_proveedor = $1', 
    [id]
  );
  return result.rows[0];
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

module.exports = {
  obtenerTodos,
  obtenerPorId,
  insertar,
  actualizar,
  eliminar
};