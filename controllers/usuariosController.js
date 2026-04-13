const { validationResult } = require('express-validator');
const bcrypt = require('bcrypt');
const usuariosModel = require('../models/usuariosModel');
const jwt = require('jsonwebtoken');

require('dotenv').config();
const SECRET = process.env.JWT_SECRET || 'clave_secreta_por_defecto';
console.log('SECRET usado en login:', SECRET); 

exports.registrarUsuario = async (req, res, next) => {
  const errores = validationResult(req);
  if (!errores.isEmpty()) {
    return res.status(400).json({ errores: errores.array() });
  }

  try {
    const { nombre, apellido, dni, telefono, email, contraseña, rol, id_direccion } = req.body;

    const emailExistente = await usuariosModel.obtenerPorEmail(email);
    if (emailExistente) {
      return res.status(409).json({ error: 'El email ya está registrado' });
    }

    const dniExistente = await usuariosModel.obtenerPorDni(dni);
    if (dniExistente) {
      return res.status(409).json({ error: 'El DNI ya está registrado' });
    }

    const hash = await bcrypt.hash(contraseña, 10);

    const nuevoUsuario = await usuariosModel.insertar({
      nombre, apellido, dni, telefono, email,
      contraseña: hash,
      rol,
      id_direccion: id_direccion || null
    });

    const { contraseña: _, ...usuarioSinPass } = nuevoUsuario;
    res.status(201).json({ mensaje: 'Usuario registrado exitosamente', usuario: usuarioSinPass });
  } catch (err) {
    next(err);
  }
};

exports.loginUsuario = async (req, res, next) => {
  console.log('SECRET usado en login:', SECRET);
  console.log('Body recibido en login:', req.body);

  try {
    const { email, contraseña } = req.body;

    if (!email || !contraseña) {
      return res.status(400).json({ error: 'Email y contraseña son obligatorios' });
    }

    const usuario = await usuariosModel.obtenerPorEmail(email);
    if (!usuario) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const coincide = await bcrypt.compare(contraseña, usuario.contraseña);
    if (!coincide) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const token = jwt.sign(
      { id: usuario.id_usuario, email: usuario.email, rol: usuario.rol },
      SECRET,
      { expiresIn: '8h' }
    );

    res.json({ mensaje: 'Login exitoso', token });
  } catch (err) {
    next(err);
  }
};

exports.obtenerUsuarios = async (req, res, next) => {
  try {
    const usuarios = await usuariosModel.obtenerTodos();
    console.log('Usuarios desde la base:', usuarios);

    const usuariosSinPass = usuarios.map(u => {
      const { contraseña, ...resto } = u;
      return resto;
    });

    res.json(usuariosSinPass);
  } catch (err) {
    console.error('Error en obtenerUsuarios:', err);
    next(err);
  }
};
