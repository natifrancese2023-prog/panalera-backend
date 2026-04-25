const { validationResult } = require('express-validator');
const pedidosModel = require('../models/pedidosModel');
const pool = require('../db'); // ✅ necesario para validar stock por variante
exports.crearPedido = async (req, res) => {
  // --- LOG DE ENTRADA ---
  console.log("=== NUEVA SOLICITUD DE PEDIDO ===");
  console.log("Cuerpo completo:", JSON.stringify(req.body, null, 2));

  const errores = validationResult(req);
  if (!errores.isEmpty()) {
    console.log("Errores de validación:", errores.array());
    return res.status(400).json({ errores: errores.array() });
  }

  try {
    const { id_cliente, productos } = req.body;

    if (!id_cliente || !productos || productos.length === 0) {
      return res.status(400).json({ error: 'Datos incompletos: cliente o productos ausentes' });
    }

    // --- AUDITORÍA DE PRODUCTOS ---
    productos.forEach((p, index) => {
      console.log(`Línea ${index}: ID Prod: ${p.id_producto}, ID Var: ${p.id_variante}, Precio: ${p.precio_unitario}, Cant: ${p.cantidad}`);
      
      if (!p.precio_unitario || p.precio_unitario <= 0) {
        console.error(`⚠️ ALERTA: El producto en el índice ${index} NO TIENE PRECIO.`);
      }
    });

    const resultado = await pedidosModel.insertar({ id_cliente, productos });

    console.log("✅ Pedido insertado con éxito en DB");
    res.status(201).json({
      mensaje: 'Pedido creado correctamente',
      ...resultado
    });

  } catch (err) {
    // Aquí es donde "err.message" nos dirá si es un problema de Neon
    console.error('❌ ERROR EN MODELO:', err.message);

    if (err.message.includes('Stock') || err.message.includes('variante') || err.message.includes('precio')) {
      return res.status(400).json({ error: err.message });
    }

    res.status(500).json({ error: 'Error interno: ' + err.message });
  }
};
exports.cambiarEstado = async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body;

    const estadosValidos = ['pendiente', 'confirmado', 'entregado', 'cancelado', 'facturado'];
    if (!estadosValidos.includes(estado)) {
      return res.status(400).json({ error: 'Estado inválido' });
    }

    const actualizado = await pedidosModel.actualizarEstado(id, estado);
    
    if (!actualizado) {
      return res.status(404).json({ error: 'Pedido no encontrado' });
    }

    res.json({ mensaje: 'Estado actualizado', pedido: actualizado });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: 'Error al cambiar estado del pedido' });
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