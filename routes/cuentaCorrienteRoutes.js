const express = require('express');
const router = express.Router();
const cuentaCorrienteController = require('../controllers/cuentaCorrienteController');
const verificarToken = require('../middlewares/auth');
const verificarRol = require('../middlewares/roles');
 
const ROLES = ['dueno'];
 
router.get('/', verificarToken, verificarRol(ROLES), cuentaCorrienteController.listarClientesConSaldo);
router.get('/:idCliente', verificarToken, verificarRol(ROLES), cuentaCorrienteController.obtenerCuentaCliente);
router.post('/:idCliente/pagos', verificarToken, verificarRol(ROLES), cuentaCorrienteController.registrarPago);
 
module.exports = router;
 