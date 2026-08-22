const express = require('express');
const router = express.Router();
const controller = require('../controllers/notaCreditoController');
const verificarToken = require('../middlewares/auth');
const verificarRol = require('../middlewares/roles');

router.get('/', verificarToken, verificarRol(['dueno']), controller.listar);
router.get('/cliente/:id_cliente', verificarToken, verificarRol(['dueno']), controller.listarPorCliente);

module.exports = router;
