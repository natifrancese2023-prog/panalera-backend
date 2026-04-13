const jwt = require('jsonwebtoken');
require('dotenv').config();

const SECRET = process.env.JWT_SECRET || 'clave_secreta_por_defecto';
console.log('🔑 SECRET cargado en auth.js:', SECRET); // se imprime al arrancar el servidor

module.exports = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  console.log('📩 Header recibido:', authHeader); // se imprime en cada request protegida
  console.log('Headers completos:', req.headers);


  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('❌ No se proporcionó token o formato incorrecto');
    return res.status(401).json({ error: 'Token no proporcionado' });
  }

  const token = authHeader.split(' ')[1];
  console.log('🔎 Token extraído:', token); // se imprime en cada request protegida

  try {
    const payload = jwt.verify(token, SECRET);
    console.log('✅ Token verificado, payload:', payload); // se imprime si el token es válido
    req.usuario = payload;
    next();
  } catch (err) {
    console.log('❌ Error al verificar token:', err.message); // se imprime si es inválido o expirado
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
};
