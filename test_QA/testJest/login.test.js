// Test QA/testJest/login.test.js
const request = require("supertest");
const app = require("../../app"); // importa tu servidor Express
const pool = require("../../db");

let tokenDueño; // variable global para usar en otros tests

describe("POST /usuarios/login", () => {
  it("debería rechazar credenciales inválidas", async () => {
    const res = await request(app)
      .post("/usuarios/login")
      .send({ email: "fakeUser", contrasena: "wrongPass" });

    expect(res.statusCode).toBe(401);
    expect(res.body.error).toBe("Credenciales inválidas");
  });

  it("debería aceptar credenciales válidas y devolver token", async () => {
    const res = await request(app)
      .post("/usuarios/login")
      .send({ email: "mimitos_agostina@gmail.com", contrasena: "Mimitos1!" });

    console.log("Login response:", res.body); // debug para ver qué devuelve
    tokenDueño = res.body.token;              // guardamos el token

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("token");
    expect(typeof res.body.token).toBe("string");
  });
});

// cerramos la conexión a la BD después de todos los tests
afterAll(async () => {
  await pool.end();
});
