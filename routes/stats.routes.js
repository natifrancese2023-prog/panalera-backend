const express = require('express');
const router = express.Router();
const statsController = require('../controllers/statsController');
const verificarToken = require('../middlewares/auth');
const verificarRol = require('../middlewares/roles');
 
// La ruta completa será: GET /api/stats/dashboard
router.get('/dashboard', verificarToken, verificarRol(['dueno']), statsController.obtenerMetricas);
 
module.exports = router;
 