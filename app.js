const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();

console.log('JWT_SECRET cargado:', process.env.JWT_SECRET ? 'SÍ' : 'NO');

// Capturadores globales de errores
process.on('uncaughtException', (err) => {
  console.error('❌ Excepción no atrapada:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Promesa rechazada sin catch:', reason);
});

const app = express();
app.set('trust proxy', 1);

// Configuraciones
const corsOptions = require('./middlewares/corsConfig');
const loginLimiter = require('./middlewares/loginLimiter');
const registerLimiter = require('./middlewares/registerLimiter');
const pedidosLimiter = require('./middlewares/pedidosLimiter');

// Middlewares globales
app.use(cors(corsOptions));
app.use(helmet());
app.use(express.json());

// Rate limiters
app.use('/usuarios/login',    loginLimiter);
app.use('/usuarios/registro', registerLimiter);
app.use('/pedidos',           pedidosLimiter);

// Rutas
app.use('/productos',   require('./routes/productos'));
app.use('/usuarios',    require('./routes/usuarios'));
app.use('/pedidos',     require('./routes/pedidos'));
app.use('/categorias',  require('./routes/categorias'));
app.use('/proveedores', require('./routes/proveedores'));
app.use('/compras',     require('./routes/compras'));
app.use('/facturas',    require('./routes/facturas'));
app.use('/gastos',      require('./routes/gastos'));
app.use('/api/stats',   require('./routes/stats.routes'));
app.use('/api',         require('./routes/export'));

// Error handler
const errorHandler = require('./middlewares/errorHandler');
app.use(errorHandler);

module.exports = app;
