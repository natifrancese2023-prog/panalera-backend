const { validationResult } = require('express-validator');
const pedidosModel = require('../models/pedidosModel');
const productosModel = require('../models/productosModel');
console.log('productosModel:', productosModel);




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
    } else if (req.usuario.rol === 'dueño') {
      idCliente = req.body.id_cliente;
      if (!idCliente) {
        return res.status(400).send('Debe especificar id_cliente');
      }
    }

    const { productos } = req.body;

    for (const p of productos) {
      const prod = await productosModel.obtenerPorId(p.id_producto);
      console.log('Producto consultado:', prod);

      if (!prod) {
        return res.status(400).send(`El producto con id ${p.id_producto} no existe`);
      }
      if (prod.stock < p.cantidad) {
        return res.status(400).send(`Stock insuficiente para el producto ${prod.nombre}`);
      }
      if (p.cantidad <= 0) {
        return res.status(400).send(`La cantidad para el producto ${prod.nombre} debe ser mayor a 0`);
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

    const estadosValidos = ['pendiente', 'confirmado', 'entregado', 'cancelado'];
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


