const express = require('express');
const router = express.Router();
const comprasController = require('../controllers/comprasController');
const verificarToken = require('../middlewares/auth');
const verificarRol = require('../middlewares/roles');

router.get('/', verificarToken, verificarRol(['dueno']), comprasController.listar);
router.post('/', verificarToken, verificarRol(['dueno']), comprasController.crear);
router.get('/:id', verificarToken, verificarRol(['dueno']), comprasController.detalle);
router.put('/:id/estado-pago', verificarToken, verificarRol(['dueno']), comprasController.actualizarEstadoPago);

module.exports = router;