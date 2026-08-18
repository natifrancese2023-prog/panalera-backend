const express = require('express');
const router = express.Router();
const proveedoresController = require('../controllers/proveedoresController');
const verificarToken = require('../middlewares/auth');
const verificarRol = require('../middlewares/roles');

// TODO: ajustar los roles según lo que se defina en la pregunta abierta #3
// del informe de auditoría (quién más, además de 'dueno', puede gestionar
// producto_proveedor). Se deja 'dueno' como placeholder para mantener
// la misma protección que el resto del módulo.
const ROLES_PRODUCTO_PROVEEDOR = ['dueno'];

router.use((req, res, next) => {
  console.log(req.method, req.originalUrl);
  next();
});

// ==========================================
// Productos asociados a un proveedor
// ==========================================
// Nota: se mantiene el namespace /productos plano (no anidado bajo /:id)
// para no romper el contrato actual del frontend en esta corrección
// puntual. La unificación a /proveedores/:id/productos (recomendación
// del informe, prioridad media #6) se deja para un refactor aparte,
// ya que implica tocar routes + controller + los 3 componentes React
// que arman la URL.

router.get(
  "/:id/productos",
  verificarToken,
  verificarRol(ROLES_PRODUCTO_PROVEEDOR),
  proveedoresController.obtenerProductosProveedor
);

router.post(
  "/productos",
  verificarToken,
  verificarRol(ROLES_PRODUCTO_PROVEEDOR),
  proveedoresController.asociarProductoProveedor
);

// FIX (bug crítico #1 del informe de auditoría):
// esta ruta estaba stubbeada con un handler de prueba que nunca
// llamaba al controller real. Editar una asociación no persistía
// nada en la base, aunque el frontend recibía 200 OK.
router.put(
  "/productos",
  verificarToken,
  verificarRol(ROLES_PRODUCTO_PROVEEDOR),
  proveedoresController.actualizarProductoProveedor
);

router.patch(
  "/productos/:idProveedor/:idProducto/:idVariante/estado",
  verificarToken,
  verificarRol(ROLES_PRODUCTO_PROVEEDOR),
  proveedoresController.cambiarEstadoProductoProveedor
);

// ==========================================
// CRUD proveedor
// ==========================================

router.get('/',     verificarToken, verificarRol(['dueno']), proveedoresController.listar);
router.get('/:id',  verificarToken, verificarRol(['dueno']), proveedoresController.obtenerPorId);
router.post('/',    verificarToken, verificarRol(['dueno']), proveedoresController.crear);
router.put('/:id',  verificarToken, verificarRol(['dueno']), proveedoresController.actualizar);
router.delete('/:id', verificarToken, verificarRol(['dueno']), proveedoresController.eliminar);

module.exports = router;