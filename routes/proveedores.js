const express = require('express');
const router = express.Router();
const proveedoresController = require('../controllers/proveedoresController');
const verificarToken = require('../middlewares/auth');
const verificarRol = require('../middlewares/roles');

router.get('/',     verificarToken, verificarRol(['dueno']), proveedoresController.listar);
router.get('/:id',  verificarToken, verificarRol(['dueno']), proveedoresController.obtenerPorId);
router.post('/',    verificarToken, verificarRol(['dueno']), proveedoresController.crear);
router.put('/:id',  verificarToken, verificarRol(['dueno']), proveedoresController.actualizar);
router.delete('/:id', verificarToken, verificarRol(['dueno']), proveedoresController.eliminar);

module.exports = router;