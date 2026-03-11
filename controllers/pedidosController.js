const pedidosModel = require('../models/pedidosModel');

exports.crearPedido = async (req, res) => {
  try {
    const idCliente = req.usuario.id; // viene del token
    const { productos } = req.body;   // array [{id_producto, cantidad}]
    const nuevoPedido = await pedidosModel.insertarPedido(idCliente, productos);
    res.json(nuevoPedido);
  } catch (err) {
    console.error(err);
    res.status(500).send('Error al crear pedido');
  }
};

exports.listarPedidosCliente = async (req, res) => {
  try {
    const idCliente = req.usuario.id;
    const pedidos = await pedidosModel.obtenerPorCliente(idCliente);
    res.json(pedidos);
  } catch (err) {
    res.status(500).send('Error al listar pedidos del cliente');
  }
};

exports.listarTodos = async (req, res) => {
  try {
    const pedidos = await pedidosModel.obtenerTodos();
    res.json(pedidos);
  } catch (err) {
    res.status(500).send('Error al listar todos los pedidos');
  }
};

exports.cambiarEstado = async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body; // 'pendiente','confirmado','entregado','cancelado'
    const actualizado = await pedidosModel.actualizarEstado(id, estado);
    res.json(actualizado);
  } catch (err) {
    res.status(500).send('Error al cambiar estado del pedido');
  }
};
