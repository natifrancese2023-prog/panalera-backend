const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const usuariosController = require('../controllers/usuariosController');
const verificarToken = require('../middlewares/auth');

// Middleware de validación para registro y edición
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
  
  // Usamos 'contrasena' para evitar problemas con la Ñ
  body('contrasena')
    .optional({ checkFalsy: true }) 
    .isLength({ min: 8 }).withMessage('La contraseña debe tener al menos 8 caracteres')
    .matches(/[A-Z]/).withMessage('La contraseña debe contener al menos una letra mayúscula')
    .matches(/[0-9]/).withMessage('La contraseña debe contener al menos un número')
    .matches(/[^A-Za-z0-9]/).withMessage('La contraseña debe contener al menos un símbolo'),
    
  body('rol').isIn(['cliente', 'dueño']).withMessage('El rol debe ser cliente o dueño')
];

// --- RUTAS DE USUARIOS ---

// Registro (POST http://localhost:8080/usuarios/registro)
router.post('/registro', validarRegistro, usuariosController.registrarUsuario);

// Login (POST http://localhost:8080/usuarios/login)
router.post('/login', usuariosController.loginUsuario);

// Obtener todos los usuarios (GET http://localhost:8080/usuarios)
router.get('/', verificarToken, usuariosController.obtenerUsuarios);

// --- NUEVAS RUTAS (Las que te daban 404) ---

// Actualizar usuario (PUT http://localhost:8080/usuarios/:id)
router.put('/:id', verificarToken, validarRegistro, usuariosController.actualizarUsuario);

// Eliminar usuario (DELETE http://localhost:8080/usuarios/:id)
router.delete('/:id', verificarToken, usuariosController.eliminarUsuario);

// Obtener pedidos del cliente (GET http://localhost:8080/usuarios/:id/pedidos)
router.get('/:id/pedidos', verificarToken, usuariosController.obtenerPedidosUsuario);

module.exports = router;