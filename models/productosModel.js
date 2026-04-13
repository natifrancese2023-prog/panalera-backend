const pool = require('../db');

async function obtenerTodos() {
  const result = await pool.query('SELECT * FROM producto');
  return result.rows;
}

async function insertar(producto) {
  const { nombre, descripcion, stock, precio_compra, precio_venta, id_categoria } = producto;
  const result = await pool.query(
    'INSERT INTO producto (nombre, descripcion, stock, precio_compra, precio_venta, id_categoria) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
    [nombre, descripcion, stock, precio_compra, precio_venta, id_categoria]
  );
  return result.rows[0];
}

async function actualizar(id, producto) {
  const { nombre, descripcion, stock, precio_compra, precio_venta, id_categoria } = producto;
  const result = await pool.query(
    'UPDATE producto SET nombre=$1, descripcion=$2, stock=$3, precio_compra=$4, precio_venta=$5, id_categoria=$6 WHERE id_producto=$7 RETURNING *',
    [nombre, descripcion, stock, precio_compra, precio_venta, id_categoria, id]
  );
  return result.rows[0];
}

async function eliminar(id) {
  const result = await pool.query(
    'DELETE FROM producto WHERE id_producto=$1 RETURNING *',
    [id]
  );
  return result.rows[0];
}

async function obtenerPorNombreYCategoria(nombre, id_categoria) {
  const result = await pool.query(
    'SELECT * FROM producto WHERE nombre=$1 AND id_categoria=$2',
    [nombre, id_categoria]
  );
  return result.rows[0];
}

async function obtenerPorId(id) {
  const result = await pool.query('SELECT * FROM producto WHERE id_producto=$1', [id]);
  return result.rows[0];
}

module.exports = {
  obtenerTodos,
  insertar,
  actualizar,
  eliminar,
  obtenerPorNombreYCategoria,
  obtenerPorId
};
