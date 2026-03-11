const express = require('express');
const { body } = require('express-validator');
const router = express.Router();

const productosController = require('../controllers/productosController');
const verificarToken = require('../middlewares/auth');
const verificarRol = require('../middlewares/roles');

const validarProducto = [
  body('nombre').notEmpty().withMessage('El nombre es obligatorio'),
  body('descripcion').optional().isLength({ min: 5 }).withMessage('La descripción debe tener al menos 5 caracteres'),
  body('stock').isInt({ min: 0 }).withMessage('El stock debe ser un número entero mayor o igual a 0'),
  body('precio_compra').isFloat({ min: 0 }).withMessage('El precio de compra debe ser positivo'),
  body('precio_venta').isFloat({ min: 0 }).withMessage('El precio de venta debe ser positivo'),
  body('id_categoria').isInt({ min: 1 }).withMessage('Debe indicar una categoría válida')
];

router.get('/', verificarToken, verificarRol(['dueño', 'empleado']), productosController.listarProductos);
router.post('/', verificarToken, verificarRol(['dueño']), validarProducto, productosController.crearProducto);
router.put('/:id', verificarToken, verificarRol(['dueño']), validarProducto, productosController.actualizarProducto);
router.delete('/:id', verificarToken, verificarRol(['dueño']), productosController.eliminarProducto);

module.exports = router;