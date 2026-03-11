const pool = require('../db');

exports.obtenerTodos = async () => {
  const result = await pool.query('SELECT * FROM producto');
  return result.rows;
};

exports.insertar = async (producto) => {
  const { nombre, descripcion, stock, precio_compra, precio_venta, id_categoria } = producto;
  const result = await pool.query(
    'INSERT INTO producto (nombre, descripcion, stock, precio_compra, precio_venta, id_categoria) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
    [nombre, descripcion, stock, precio_compra, precio_venta, id_categoria]
  );
  return result.rows[0];
};

exports.actualizar = async (id, producto) => {
  const { nombre, descripcion, stock, precio_compra, precio_venta, id_categoria } = producto;
  const result = await pool.query(
    'UPDATE producto SET nombre=$1, descripcion=$2, stock=$3, precio_compra=$4, precio_venta=$5, id_categoria=$6 WHERE id_producto=$7 RETURNING *',
    [nombre, descripcion, stock, precio_compra, precio_venta, id_categoria, id]
  );
  return result.rows[0];
};

exports.eliminar = async (id) => {
  await pool.query('DELETE FROM producto WHERE id_producto=$1', [id]);
};

// 🔑 Función para validar duplicados por nombre y categoría
exports.obtenerPorNombreYCategoria = async (nombre, id_categoria) => {
  const result = await pool.query(
    'SELECT * FROM producto WHERE nombre=$1 AND id_categoria=$2',
    [nombre, id_categoria]
  );
  return result.rows[0]; // devuelve el producto si existe, o undefined si no
};
