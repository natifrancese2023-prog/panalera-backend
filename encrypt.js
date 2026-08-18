const bcrypt = require('bcrypt');

const password = 'clave_segura';   // tu contraseña en texto plano
const saltRounds = 10;             // nivel de seguridad

const hash = bcrypt.hashSync(password, saltRounds);
console.log('Contraseña encriptada:', hash);
