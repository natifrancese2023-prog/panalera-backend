
const express = require('express');
const router = express.Router();
const comprasController = require('../controllers/comprasController');
const verificarToken = require('../middlewares/auth');
const verificarRol = require('../middlewares/roles');
 
router.get('/', verificarToken, verificarRol(['dueno']), comprasController.listar);
router.post('/', verificarToken, verificarRol(['dueno']), comprasController.crear);
 
// FIX (auditoría módulo Compras): el frontend (Compras.jsx, abrirDetalle)
// pide GET /compras/:id/detalle, pero esa ruta no existía -- solo estaba
// /compras/:id. Se agrega la ruta que faltaba apuntando al mismo
// controller que ya existía y funcionaba. Se deja /compras/:id también,
// por si algo más del frontend la usa (no se detectó ningún uso en el
// material auditado, pero no se quita sin confirmar).
router.get('/:id/detalle', verificarToken, verificarRol(['dueno']), comprasController.detalle);
router.get('/:id', verificarToken, verificarRol(['dueno']), comprasController.detalle);
 
router.put('/:id/estado-pago', verificarToken, verificarRol(['dueno']), comprasController.actualizarEstadoPago);
 
module.exports = router;