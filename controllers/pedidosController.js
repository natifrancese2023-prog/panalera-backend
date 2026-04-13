const { validationResult } = require('express-validator');
const pedidosModel = require('../models/pedidosModel');
const pool = require('../db'); // ✅ necesario para validar stock por variante

exports.crearPedido = async (req, res) => {
  const errores = validationResult(req);
  console.log('Body recibido:', req.body);

  if (!errores.isEmpty()) {
    return res.status(400).json({ errores: errores.array() });
  }

  try {
    let idCliente;

    if (req.usuario.rol === 'cliente') {
      idCliente = req.usuario.id;
    } else if (req.usuario.rol === 'dueno') {   // 👈 ojo, acá usá "dueno"
      idCliente = req.body.id_cliente;
      if (!idCliente) {
        return res.status(400).send('Debe especificar id_cliente');
      }
    }

    const { productos } = req.body;

    for (const p of productos) {
      // Validamos cantidad antes de consultar la DB
      if (!p.cantidad || p.cantidad <= 0) {
        return res.status(400).send(`La cantidad debe ser mayor a 0`);
      }

      // ✅ CORRECCIÓN: validamos stock de la VARIANTE específica, no del producto total.
      // Antes se usaba obtenerPorId(id_producto) que devuelve stock_total agregado,
      // lo que permitía vender una variante con stock 0 si otra variante tenía stock.
      const varRes = await pool.query(
        `SELECT pv.stock, pr.nombre AS nombre_producto
         FROM producto_variantes pv
         JOIN producto pr ON pr.id_producto = pv.id_producto
         WHERE pv.id_variante = $1 AND pv.id_producto = $2`,
        [p.id_variante, p.id_producto]
      );

      if (varRes.rows.length === 0) {
        return res.status(400).send(`La variante ${p.id_variante} no existe o no pertenece al producto ${p.id_producto}`);
      }

      const { stock, nombre_producto } = varRes.rows[0];
      if (stock < p.cantidad) {
        return res.status(400).send(`Stock insuficiente para "${nombre_producto}" (variante ${p.id_variante}). Stock disponible: ${stock}`);
      }
    }

    const nuevoPedido = await pedidosModel.insertarPedido(idCliente, productos);
    res.json(nuevoPedido);
  } catch (err) {
    console.error('Error en crearPedido:', err.message, err.stack);
    res.status(500).send('Error al crear pedido');
  }
};

exports.cambiarEstado = async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;

    const estadosValidos = ['pendiente', 'confirmado', 'entregado', 'cancelado', 'facturado'];
    if (!estadosValidos.includes(estado)) {
      return res.status(400).send('Estado inválido');
    }

    const actualizado = await pedidosModel.actualizarEstado(id, estado);
    res.json(actualizado);
  } catch (err) {
    res.status(500).send('Error al cambiar estado del pedido');
  }
};

exports.listarTodos = async (req, res) => {
  try {
    const pedidos = await pedidosModel.obtenerTodos();
    res.json(pedidos);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error al listar pedidos');
  }
};

exports.listarPedidosCliente = async (req, res) => {
  try {
    const idCliente = req.usuario.id;
    const pedidos = await pedidosModel.obtenerPorCliente(idCliente);

    if (!pedidos || pedidos.length === 0) {
      return res.status(404).send('No se encontraron pedidos para este cliente');
    }

    res.json(pedidos);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error al listar pedidos del cliente');
  }
};

exports.obtenerDetalle = async (req, res) => {
  try {
    const { id } = req.params;
    const detalle = await pedidosModel.obtenerDetalle(id);
    res.json(detalle);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error al obtener detalle del pedido');
  }
};