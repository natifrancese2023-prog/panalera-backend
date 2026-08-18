const request = require("supertest");
const app = require("../../app");

let tokenDueño;

beforeAll(async () => {
  const login = await request(app)
    .post("/usuarios/login")
    .send({ email: "nati@mail.com", contraseña: "clave_segura" });
  tokenDueño = login.body.token;
});

describe("Flujo de gastos", () => {
  it("debería rechazar crear gasto sin token", async () => {
    const res = await request(app).post("/gastos").send({
      descripcion: "Compra insumos",
      monto: 500
    });
    expect(res.statusCode).toBe(401);
  });

  it("debería rechazar gasto con monto negativo", async () => {
    const res = await request(app)
      .post("/gastos")
      .set("Authorization", `Bearer ${tokenDueño}`)
      .send({
        descripcion: "Error",
        monto: -100
      });
    expect(res.statusCode).toBe(400);
  });

  it("debería crear un gasto válido", async () => {
    const res = await request(app)
      .post("/gastos")
      .set("Authorization", `Bearer ${tokenDueño}`)
      .send({
        descripcion: "Compra de cajas",
        monto: 300
      });
    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty("gasto");
  });

  it("debería listar gastos", async () => {
    const res = await request(app)
      .get("/gastos")
      .set("Authorization", `Bearer ${tokenDueño}`);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
