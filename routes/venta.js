const express = require('express');
const router = express.Router();

const ventaController = require('../controllers/ventaController');

const verificarToken = require('../middlewares/auth');
const verificarRol = require('../middlewares/roles');
router.post(
    '/directa',
    verificarToken,
    verificarRol(['dueno']),
    ventaController.crearVentaDirecta
);

module.exports = router;

