const { validationResult } = require("express-validator");
const bcrypt = require("bcrypt");
const usuariosModel = require("../models/usuariosModel");
const jwt = require("jsonwebtoken");

require("dotenv").config();
const SECRET = process.env.JWT_SECRET || "clave_secreta_por_defecto";

// --- REGISTRO ---
exports.registrarUsuario = async (req, res, next) => {
    const errores = validationResult(req);
    if (!errores.isEmpty()) {
        return res.status(400).json({ errores: errores.array() });
    }

    try {
        const { nombre, apellido, dni, telefono, email, contrasena, rol, id_direccion } = req.body;

        const emailExistente = await usuariosModel.obtenerPorEmail(email);
        if (emailExistente) return res.status(409).json({ error: "El email ya está registrado" });

        let passwordFinal = contrasena;
        if (!passwordFinal || passwordFinal.trim() === "") {
            passwordFinal = "Cliente1!";
        }

        const hash = await bcrypt.hash(passwordFinal, 10);

        const nuevoUsuario = await usuariosModel.insertar({
            nombre, apellido, dni, telefono, email,
            contrasena: hash,
            rol: rol || 'cliente',
            id_direccion: id_direccion || null,
        });

        const { contrasena: _, ...usuarioSinPass } = nuevoUsuario;
        res.status(201).json({ mensaje: "Usuario registrado", usuario: usuarioSinPass });
    } catch (err) {
        next(err);
    }
};

// --- LOGIN ---
exports.loginUsuario = async (req, res, next) => {
    try {
        const { email, contrasena } = req.body;
        const usuario = await usuariosModel.obtenerPorEmail(email);

        if (!usuario || !(await bcrypt.compare(contrasena, usuario.contrasena))) {
            return res.status(401).json({ error: "Credenciales inválidas" });
        }

        const token = jwt.sign(
            { id: usuario.id_usuario, email: usuario.email, rol: usuario.rol },
            SECRET,
            { expiresIn: "8h" }
        );

        res.json({ mensaje: "Login exitoso", token });
    } catch (err) {
        next(err);
    }
};

// --- OBTENER TODOS ---
exports.obtenerUsuarios = async (req, res, next) => {
    try {
        const usuarios = await usuariosModel.obtenerTodos();
        res.json(usuarios); // El modelo ya filtra la contraseña en el SELECT
    } catch (err) {
        next(err);
    }
};

// ============================================================
// NUEVAS FUNCIONES PARA GESTIÓN DE CLIENTES
// ============================================================

// --- ACTUALIZAR CLIENTE ---
exports.actualizarUsuario = async (req, res, next) => {
    try {
        const { id } = req.params;
        const datosActualizados = req.body;

        const usuarioEditado = await usuariosModel.actualizar(id, datosActualizados);
        
        if (!usuarioEditado) {
            return res.status(404).json({ error: "Usuario no encontrado" });
        }

        res.json({ mensaje: "Cliente actualizado", usuario: usuarioEditado });
    } catch (err) {
        next(err);
    }
};

// --- ELIMINAR CLIENTE ---
exports.eliminarUsuario = async (req, res, next) => {
    try {
        const { id } = req.params;
        
        // Ojo: Si el cliente tiene pedidos, esto dará error de FK (Foreign Key)
        // Podrías manejarlo con un try-catch específico o borrado lógico
        await usuariosModel.eliminar(id);
        
        res.json({ mensaje: "Cliente eliminado correctamente" });
    } catch (err) {
        if (err.code === '23503') { // Error de violación de llave foránea en Postgres
            return res.status(400).json({ error: "No se puede eliminar un cliente que ya tiene pedidos realizados." });
        }
        next(err);
    }
};

// --- OBTENER PEDIDOS DE UN USUARIO ---
exports.obtenerPedidosUsuario = async (req, res, next) => {
    try {
        const { id } = req.params;
        const pedidos = await usuariosModel.obtenerPedidosPorUsuario(id);
        res.json(pedidos);
    } catch (err) {
        next(err);
    }
};