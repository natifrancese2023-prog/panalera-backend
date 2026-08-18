const { rateLimit } = require('express-rate-limit');

const pedidosLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 20,                 // máximo 20 pedidos por IP en ese tiempo
  message: 'Demasiados intentos de crear pedidos, intente más tarde'
});

module.exports = pedidosLimiter;
