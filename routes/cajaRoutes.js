const express = require('express');
const router = express.Router();
const cajaController = require('../controllers/cajaController');
const verificarToken = require('../middlewares/auth');
const verificarRol = require('../middlewares/roles');

const ROLES = ['dueno'];

router.get('/abierta', verificarToken, verificarRol(ROLES), cajaController.obtenerAbierta);
router.get(
  '/ultima-cerrada',
  verificarToken,
  verificarRol(ROLES),
  cajaController.obtenerUltimaCerrada
);
router.get(
  '/historial',
  verificarToken,
  verificarRol(ROLES),
  cajaController.listarHistorial
);
router.post('/abrir', verificarToken, verificarRol(ROLES), cajaController.abrir);
router.get('/:id', verificarToken, verificarRol(ROLES), cajaController.obtenerEstado);
router.post('/retiro', verificarToken, verificarRol(ROLES), cajaController.registrarRetiro);
router.put('/:id/cerrar', verificarToken, verificarRol(ROLES), cajaController.cerrar);

module.exports = router;