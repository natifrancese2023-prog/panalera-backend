// models/kardexModel.js
const pool = require('../db');

const obtenerPorProducto = async (id_producto) => {
  const query = `
    SELECT k.*, p.nombre AS producto_nombre, v.nombre_variante
    FROM public.kardex k
    JOIN public.producto p ON k.id_producto = p.id_producto
    LEFT JOIN public.producto_variantes v ON k.id_variante = v.id_variante
    WHERE k.id_producto = $1
    ORDER BY k.fecha_registro DESC`;
  const res = await pool.query(query, [id_producto]);
  return res.rows;
};

const obtenerPorVariante = async (id_variante) => {
  const query = `
    SELECT k.*, p.nombre AS producto_nombre, v.nombre_variante
    FROM public.kardex k
    JOIN public.producto p ON k.id_producto = p.id_producto
    LEFT JOIN public.producto_variantes v ON k.id_variante = v.id_variante
    WHERE k.id_variante = $1
    ORDER BY k.fecha_registro DESC`;
  const res = await pool.query(query, [id_variante]);
  return res.rows;
};

const obtenerPorOrigen = async (origen_tipo, origen_id) => {
  const query = `
    SELECT k.*, p.nombre AS producto_nombre, v.nombre_variante
    FROM public.kardex k
    JOIN public.producto p ON k.id_producto = p.id_producto
    LEFT JOIN public.producto_variantes v ON k.id_variante = v.id_variante
    WHERE k.origen_tipo = $1 AND k.origen_id = $2
    ORDER BY k.fecha_registro DESC`;
  const res = await pool.query(query, [origen_tipo, origen_id]);
  return res.rows;
};

module.exports = {
  obtenerPorProducto,
  obtenerPorVariante,
  obtenerPorOrigen,
};