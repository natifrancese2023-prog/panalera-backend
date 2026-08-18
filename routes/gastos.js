const express = require('express');
const router = express.Router();
const gastosController = require('../controllers/gastosController');
const verificarToken = require('../middlewares/auth');
const verificarRol = require('../middlewares/roles');

router.get('/',      verificarToken, verificarRol(['dueno']), gastosController.listar);
router.post('/',     verificarToken, verificarRol(['dueno']), gastosController.crear);
router.put('/:id',   verificarToken, verificarRol(['dueno']), gastosController.actualizar);
router.delete('/:id',verificarToken, verificarRol(['dueno']), gastosController.eliminar);

module.exports = router;