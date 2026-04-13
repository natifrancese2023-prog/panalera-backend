const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const usuariosController = require('../controllers/usuariosController');
const verificarToken = require('../middlewares/auth'); // 🔑 IMPORTANTE

const validarRegistro = [
  body('nombre').notEmpty().withMessage('El nombre es obligatorio'),
  body('apellido').notEmpty().withMessage('El apellido es obligatorio'),
  body('dni')
    .isNumeric().withMessage('El DNI debe ser numérico')
    .isLength({ min: 7, max: 8 }).withMessage('El DNI debe tener entre 7 y 8 dígitos'),
  body('telefono')
    .isNumeric().withMessage('El teléfono debe ser numérico')
    .isLength({ min: 8 }).withMessage('El teléfono debe tener al menos 8 dígitos'),
  body('email').isEmail().withMessage('Debe ser un email válido'),
  body('contraseña')
    .isLength({ min: 8 }).withMessage('La contraseña debe tener al menos 8 caracteres')
    .matches(/[A-Z]/).withMessage('La contraseña debe contener al menos una letra mayúscula')
    .matches(/[0-9]/).withMessage('La contraseña debe contener al menos un número')
    .matches(/[^A-Za-z0-9]/).withMessage('La contraseña debe contener al menos un símbolo'),
  body('rol').isIn(['cliente', 'dueño']).withMessage('El rol debe ser cliente o dueño')
];

// Registro
router.post('/registro', validarRegistro, usuariosController.registrarUsuario);

// Login
router.post('/login', usuariosController.loginUsuario);

// Obtener todos los usuarios
router.get('/', verificarToken, usuariosController.obtenerUsuarios);

module.exports = router;
