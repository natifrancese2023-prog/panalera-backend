const express = require('express');
const router = express.Router();
const pedidosController = require('../controllers/pedidosController');
const verificarToken = require('../middlewares/auth');
const verificarRol = require('../middlewares/roles');

// Cliente: crear pedido y ver sus pedidos
router.post('/', verificarToken, verificarRol(['cliente', 'dueno']), pedidosController.crearPedido);
router.get('/mis-pedidos', verificarToken, verificarRol(['cliente']), pedidosController.listarPedidosCliente);
router.get('/:id/detalle', verificarToken, verificarRol(['dueno']), pedidosController.obtenerDetalle);

// Dueño: ver todos los pedidos y cambiar estado
router.get('/', verificarToken, verificarRol(['dueno']), pedidosController.listarTodos);
router.put('/:id/estado', verificarToken, verificarRol(['dueno']), pedidosController.cambiarEstado);


module.exports = router;