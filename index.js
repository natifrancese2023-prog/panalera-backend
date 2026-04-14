const express = require('express');
const cors = require('cors'); // Importamos la librería
const helmet = require('helmet'); // Importamos helmet
require('dotenv').config();

console.log('JWT_SECRET cargado:', process.env.JWT_SECRET ? 'SÍ' : 'NO');
const app = express();

// 1. CONFIGURACIONES (Importamos los objetos/funciones)
const corsOptions = require('./middlewares/corsConfig');
const loginLimiter = require('./middlewares/loginLimiter');
const registerLimiter = require('./middlewares/registerLimiter');
const pedidosLimiter = require('./middlewares/pedidosLimiter');

// 2. MIDDLEWARES GLOBALES (Aquí es donde se rompe si no usás cors())
app.use(cors(corsOptions)); // ✅ CORREGIDO: Usamos la función cors
app.use(helmet());          // ✅ CORREGIDO: Usamos helmet como función
app.use(express.json());

// 3. RATE LIMITERS POR RUTA (Solo donde se necesitan)
app.use('/usuarios/login',    loginLimiter);
app.use('/usuarios/registro', registerLimiter);
app.use('/pedidos',           pedidosLimiter);

// 4. RUTAS
app.use('/productos',   require('./routes/productos'));
app.use('/usuarios',    require('./routes/usuarios'));
app.use('/pedidos',     require('./routes/pedidos'));
app.use('/categorias',  require('./routes/categorias'));
app.use('/proveedores', require('./routes/proveedores'));
app.use('/compras',     require('./routes/compras'));
app.use('/facturas',    require('./routes/facturas'));
app.use('/gastos',      require('./routes/gastos'));
app.use('/api',         require('./routes/export'));
app.use('/api/stats',   require('./routes/stats.routes'));

// 5. MANEJO DE ERRORES (Siempre va ÚLTIMO)
const errorHandler = require('./middlewares/errorHandler');
app.use(errorHandler);

module.exports = app;

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Servidor escuchando en http://localhost:${PORT}`);
  });
}