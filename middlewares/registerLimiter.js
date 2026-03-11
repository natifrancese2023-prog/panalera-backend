const { rateLimit } = require('express-rate-limit');

const registerLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutos
  max: 10,                 // máximo 10 registros por IP en ese tiempo
  message: 'Demasiados intentos de registro, intente más tarde'
});

module.exports = registerLimiter;
