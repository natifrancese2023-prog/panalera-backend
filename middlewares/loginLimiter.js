const { rateLimit } = require('express-rate-limit');

const loginLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 5,
  message: 'Demasiados intentos de login, intente más tarde'
});

module.exports = loginLimiter;
