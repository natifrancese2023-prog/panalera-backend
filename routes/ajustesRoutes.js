const express = require('express');
const router = express.Router();

const ajustesController = require('../controllers/ajustesController');

const verificarToken = require('../middlewares/auth');
const verificarRol = require('../middlewares/roles');
router.post('/', verificarToken, verificarRol(['dueno']),ajustesController.crearAjuste);
router.post('/:id/confirmar',verificarToken, verificarRol(['dueno']), ajustesController.confirmarBorrador);
router.get('/',verificarToken, verificarRol(['dueno']), ajustesController.obtenerTodos);
router.get('/:id', verificarToken, verificarRol(['dueno']), ajustesController.obtenerDetalle);

module.exports = router;