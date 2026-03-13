const express = require('express');
const router = express.Router();
const pedidosController = require('../controllers/pedidosController');
const verificarToken = require('../middlewares/auth');
const verificarRol = require('../middlewares/roles');

// Cliente: crear pedido y ver sus pedidos
router.post('/', verificarToken, verificarRol(['cliente', 'dueño']), pedidosController.crearPedido);
router.get('/mis-pedidos', verificarToken, verificarRol(['cliente']), pedidosController.listarPedidosCliente);

// Dueño: ver todos los pedidos y cambiar estado
router.get('/', verificarToken, verificarRol(['dueño']), pedidosController.listarTodos);
router.put('/:id/estado', verificarToken, verificarRol(['dueño']), pedidosController.cambiarEstado);

module.exports = router;