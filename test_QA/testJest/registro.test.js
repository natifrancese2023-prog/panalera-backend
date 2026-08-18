// Test QA/testJest/registro.test.js
const request = require("supertest");
const app = require("../../app");

describe("POST /usuarios/registro", () => {
it("debería rechazar si faltan campos obligatorios", async () => {
    const res = await request(app)
    .post("/usuarios/registro")
      .send({ email: "faltante@test.com" }); // faltan nombre, apellido, etc.

    expect(res.statusCode).toBe(400);
    expect(res.body.errores).toBeDefined();
});

it("debería rechazar si el DNI no es numérico o no tiene 7-8 dígitos", async () => {
    const res = await request(app)
    .post("/usuarios/registro")
    .send({
        nombre: "Nati",
        apellido: "Test",
        dni: "AA123", // inválido
        telefono: "35123456",
        email: `dni${Date.now()}@test.com`,
        contraseña: "ClaveSegura1!",
        rol: "cliente"
    });

    expect(res.statusCode).toBe(400);
});

it("debería rechazar si el email ya existe", async () => {
    const res = await request(app)
    .post("/usuarios/registro")
    .send({
        nombre: "Nati",
        apellido: "Cliente",
        dni: "12345678",
        telefono: "3512345678",
        email: "nati@cliente.com", // ya registrado en tu BD
        contraseña: "ClaveSegura1!",
        rol: "cliente"
    });

    expect(res.statusCode).toBe(409);
    expect(res.body.error).toBe("El email ya está registrado");
});

it("debería rechazar si la contraseña no cumple las reglas", async () => {
    const res = await request(app)
    .post("/usuarios/registro")
    .send({
        nombre: "Nati",
        apellido: "Cliente",
        dni: Math.floor(10000000 + Math.random() * 89999999).toString(),
        telefono: "3512345678",
        email: `pass${Date.now()}@test.com`,
        contraseña: "simple", // no cumple reglas
        rol: "cliente"
    });

    expect(res.statusCode).toBe(400);
});

it("debería registrar un usuario válido", async () => {
    const uniqueEmail = `test${Date.now()}@cliente.com`;
    const uniqueDni = Math.floor(10000000 + Math.random() * 89999999).toString();

    const res = await request(app)
    .post("/usuarios/registro")
    .send({
        nombre: "Nuevo",
        apellido: "Usuario",
        dni: uniqueDni,
        telefono: "3512345678",
        email: uniqueEmail,
        contraseña: "ClaveSegura1!",
        rol: "cliente"
    });

    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty("usuario");
    expect(res.body.usuario).toHaveProperty("email", uniqueEmail);
});
});
