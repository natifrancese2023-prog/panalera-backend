const express = require('express');
const router = express.Router();
const comprasSugeridasController = require('../controllers/comprasSugeridasController');
const verificarToken = require('../middlewares/auth');
const verificarRol = require('../middlewares/roles');
 
// Mismo rol que ya protege Proveedores y Compras, para mantener
// consistencia con el resto del ERP.
const ROLES = ['dueno'];
 
// Motor de cálculo puro -- no persiste nada, solo devuelve la grilla.
router.get('/calcular', verificarToken, verificarRol(ROLES), comprasSugeridasController.calcular);
 
router.get('/proveedores-disponibles', verificarToken, verificarRol(ROLES), comprasSugeridasController.proveedoresDisponibles);
 
router.get('/', verificarToken, verificarRol(ROLES), comprasSugeridasController.listar);
router.post('/', verificarToken, verificarRol(ROLES), comprasSugeridasController.crear);
router.get('/:id', verificarToken, verificarRol(ROLES), comprasSugeridasController.obtenerPorId);
router.get('/:id/preparar-compra', verificarToken, verificarRol(ROLES), comprasSugeridasController.prepararParaCompra);
router.get('/:id/pdf', verificarToken, verificarRol(ROLES), comprasSugeridasController.generarPDF);
router.put('/:id/registrar', verificarToken, verificarRol(ROLES), comprasSugeridasController.marcarRegistrada);
 
module.exports = router;
 