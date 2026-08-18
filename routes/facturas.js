const express = require('express');
const router = express.Router();
const facturasController = require('../controllers/facturasController');
const verificarToken = require('../middlewares/auth');
const verificarRol = require('../middlewares/roles');

router.get('/', verificarToken, verificarRol(['dueno']), facturasController.listar);
router.post('/', verificarToken, verificarRol(['dueno']), facturasController.crear);
router.get('/:id', verificarToken, verificarRol(['dueno']), facturasController.obtenerPorId);

module.exports = router;