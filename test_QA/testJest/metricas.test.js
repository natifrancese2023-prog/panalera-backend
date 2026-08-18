const request = require("supertest");
const app = require("../../app");

let tokenDueño;

beforeAll(async () => {
  const login = await request(app)
    .post("/usuarios/login")
    .send({ email: "nati@mail.com", contraseña: "clave_segura" });
  tokenDueño = login.body.token;
});

describe("Endpoint métricas", () => {
  it("debería devolver métricas con estructura correcta", async () => {
    const res = await request(app)
      .get("/metricas?inicio=2024-01-01&fin=2024-12-31")
      .set("Authorization", `Bearer ${tokenDueño}`);
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("totales");
    expect(res.body.totales).toHaveProperty("ingresos");
    expect(res.body.totales).toHaveProperty("egresos");
    expect(res.body).toHaveProperty("grafico");
    expect(res.body).toHaveProperty("alertas");
  });

  it("debería devolver métricas en cero si no hay datos", async () => {
    const res = await request(app)
      .get("/metricas?inicio=1900-01-01&fin=1900-12-31")
      .set("Authorization", `Bearer ${tokenDueño}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.totales.ingresos).toBe(0);
    expect(res.body.totales.egresos).toBe(0);
  });
});
