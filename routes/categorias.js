const express = require('express');
const router = express.Router();
const categoriasController = require('../controllers/categoriasController');
const verificarToken = require('../middlewares/auth');
const verificarRol = require('../middlewares/roles');

// Listar categorías — también lo necesita el frontend público para el select del formulario
router.get('/', verificarToken, verificarRol(['dueno']), categoriasController.listar);

// Crear y eliminar — solo el dueño
router.post('/', verificarToken, verificarRol(['dueno']), categoriasController.crear);
router.delete('/:id', verificarToken, verificarRol(['dueno']), categoriasController.eliminar);

module.exports = router;