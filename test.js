const c = require('./controllers/productosController');
const t = require('./middlewares/auth');
const r = require('./middlewares/roles');

console.log('controller:', typeof c.listarProductos);
console.log('auth:', typeof t);
console.log('roles:', typeof r);
console.log('listarProductos:', typeof c.listarProductos);
console.log('crearProducto:', typeof c.crearProducto);
console.log('actualizarProducto:', typeof c.actualizarProducto);
console.log('eliminarProducto:', typeof c.eliminarProducto);
const u = require('./controllers/usuariosController');
console.log('registrarUsuario:', typeof u.registrarUsuario);
console.log('loginUsuario:', typeof u.loginUsuario);