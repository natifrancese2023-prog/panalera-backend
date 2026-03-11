const express = require('express');
require('dotenv').config();
console.log('JWT_SECRET cargado:', process.env.JWT_SECRET);
const app = express();

app.use(express.json());
app.use(require('./middlewares/helmetConfig'));
app.use(require('./middlewares/xssConfig'));
app.use(require('./middlewares/corsConfig'));

const loginLimiter = require('./middlewares/loginLimiter');
const registerLimiter = require('./middlewares/registerLimiter');
const pedidosLimiter = require('./middlewares/pedidosLimiter');

app.use('/usuarios/login', loginLimiter);
app.use('/usuarios/registro', registerLimiter);
app.use('/pedidos', pedidosLimiter);

const productosRoutes = require('./routes/productos');
const usuariosRoutes = require('./routes/usuarios');
const pedidosRoutes = require('./routes/pedidos');

app.use('/productos', productosRoutes);
app.use('/usuarios', usuariosRoutes);
app.use('/pedidos', pedidosRoutes);

app.use(require('./middlewares/errorHandler'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});