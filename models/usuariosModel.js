const pool = require('../db');

const obtenerPorEmail = async (email) => {
  // Al usar *, ya trae 'contrasena' si existe en la tabla
  const result = await pool.query(
    'SELECT * FROM usuario WHERE email = $1',
    [email]
  );
  return result.rows[0];
};

const obtenerPorDni = async (dni) => {
  const res = await pool.query(
    'SELECT * FROM usuario WHERE dni = $1', 
    [dni]
  );
  return res.rows[0];
};

const insertar = async (datos) => {
  const { nombre, apellido, dni, telefono, email, contrasena, rol, id_direccion } = datos;
  const result = await pool.query(
    `INSERT INTO usuario (nombre, apellido, dni, telefono, email, contrasena, rol, id_direccion) 
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
    [nombre, apellido, dni, telefono, email, contrasena, rol || 'cliente', id_direccion || null]
  );
  return result.rows[0];
};
const obtenerTodos = async () => {
  const result = await pool.query(
    'SELECT id_usuario, nombre, apellido, dni, email, rol FROM usuario ORDER BY apellido ASC'
  );
  return result.rows;
};
const actualizar = async (id, datos) => {
  const { nombre, apellido, dni, telefono, email, rol } = datos;
  const result = await pool.query(
    `UPDATE usuario 
     SET nombre = $1, apellido = $2, dni = $3, telefono = $4, email = $5, rol = $6
     WHERE id_usuario = $7 RETURNING *`,
    [nombre, apellido, dni, telefono, email, rol, id]
  );
  return result.rows[0];
};

const eliminar = async (id) => {
  await pool.query('DELETE FROM usuario WHERE id_usuario = $1', [id]);
  return true;
};

const obtenerPedidosPorUsuario = async (id) => {
  // Asegúrate de que la columna sea 'id_cliente' y la tabla 'pedido'
  const result = await pool.query(
    `SELECT * FROM pedido WHERE id_cliente = $1 ORDER BY fecha DESC`,
    [id]
  );
  return result.rows;
};

module.exports = {
  obtenerPorEmail,
  obtenerPorDni,
  insertar,
  obtenerTodos,
  actualizar,      // Nueva
  eliminar,        // Nueva
  obtenerPedidosPorUsuario // Nueva
};