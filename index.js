const express = require('express');
require('dotenv').config();
console.log('JWT_SECRET cargado:', process.env.JWT_SECRET);
const app = express();

// ✅ CORS siempre primero — antes de cualquier otro middleware
app.use(require('./middlewares/corsConfig'));
app.use(express.json());
app.use(require('./middlewares/helmetConfig'));
app.use(require('./middlewares/xssConfig'));

// Rate limiters por ruta específica
const loginLimiter    = require('./middlewares/loginLimiter');
const registerLimiter = require('./middlewares/registerLimiter');
const pedidosLimiter  = require('./middlewares/pedidosLimiter');

app.use('/usuarios/login',    loginLimiter);
app.use('/usuarios/registro', registerLimiter);
app.use('/pedidos',           pedidosLimiter);

// ✅ Todas las rutas registradas
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

app.use(require('./middlewares/errorHandler'));

// 👇 Exportá la app para Supertest
module.exports = app;

// Solo levantá el servidor si ejecutás directamente este archivo
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Servidor escuchando en http://localhost:${PORT}`);
  });
}