// middlewares/roles.js
const verificarRol = (rolesPermitidos) => {
  return (req, res, next) => {
    if (!req.usuario) {
      return res.status(403).send('Usuario no autenticado');
    }

    if (!rolesPermitidos.includes(req.usuario.rol)) {
      return res.status(403).send('No tienes permisos para esta acción');
    }

    next();
  };
};

module.exports = verificarRol;

