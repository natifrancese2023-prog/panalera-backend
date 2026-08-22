const express = require('express');
const router = express.Router();
const facturasController = require('../controllers/facturasController');
const verificarToken = require('../middlewares/auth');
const verificarRol = require('../middlewares/roles');

// La creación de facturas de ventas se hace exclusivamente desde
// POST /ventas/directa. Así evitamos un segundo camino que saltee Caja/CC.
router.get('/', verificarToken, verificarRol(['dueno']), facturasController.listar);
router.get('/:id', verificarToken, verificarRol(['dueno']), facturasController.obtenerPorId);
router.post('/:id/anular', verificarToken, verificarRol(['dueno']), facturasController.anularFactura);
router.post(
  '/:id/anular',
  verificarToken,
  verificarRol(['dueno']),
  facturasController.anularFactura
);

module.exports = router;
