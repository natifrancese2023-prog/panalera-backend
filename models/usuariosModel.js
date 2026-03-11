const pool = require('../db');

exports.insertar = async (usuario) => {
  const { nombre, apellido, dni, telefono, email, contraseña, rol, id_direccion } = usuario;
  const result = await pool.query(
    `INSERT INTO usuario (nombre, apellido, dni, telefono, email, contraseña, rol, id_direccion)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [nombre, apellido, dni, telefono, email, contraseña, rol, id_direccion]
  );
  return result.rows[0];
};

exports.obtenerPorEmail = async (email) => {
  const result = await pool.query('SELECT * FROM usuario WHERE email=$1', [email]);
  return result.rows[0];
};

exports.obtenerPorDni = async (dni) => {
  const result = await pool.query('SELECT * FROM usuario WHERE dni=$1', [dni]);
  return result.rows[0];
};

exports.obtenerTodos = async () => {
  const result = await pool.query('SELECT * FROM usuario');
  return result.rows;
};