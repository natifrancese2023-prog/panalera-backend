// Test QA/testJest/login.test.js
const request = require("supertest");
const app = require("../../index"); // importa tu servidor Express
const pool = require("../../db");

describe("POST /usuarios/login", () => {
  it("debería rechazar credenciales inválidas", async () => {
    const res = await request(app)
      .post("/usuarios/login") // 👈 ruta corregida
      .send({ email: "fakeUser", contraseña: "wrongPass" });

    expect(res.statusCode).toBe(401); // debería devolver 401
    expect(res.body.error).toBe("Credenciales inválidas");
  });

  it("debería aceptar credenciales válidas y devolver token", async () => {
    const res = await request(app)
      .post("/usuarios/login") // 👈 ruta corregida
      .send({ email: "nati@cliente.com", contraseña: "clave_segura" }); // usa un usuario válido de tu BD

    expect(res.statusCode).toBe(200); // login exitoso
    expect(res.body).toHaveProperty("token"); // debe devolver un token
    expect(typeof res.body.token).toBe("string"); // el token debe ser un string
  });
});
afterAll(async () => {
    await pool.end();
});