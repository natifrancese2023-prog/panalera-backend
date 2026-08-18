const request = require("supertest");
const app = require("../../app");
const pool = require("../../db");

jest.setTimeout(30000);

let tokenDueño;
let pedidoCreado;

beforeAll(async () => {
  const login = await request(app)
    .post("/usuarios/login")
    .send({ email: "mimitos_agostina@gmail.com", contrasena: "Mimitos1!" });
  tokenDueño = login.body.token;
});

describe("Flujo completo de pedidos", () => {
  it("debería crear un pedido válido", async () => {
    const res = await request(app)
      .post("/pedidos")
      .set("Authorization", `Bearer ${tokenDueño}`)
      .send({
        id_cliente: 2,
        productos: [
          {
            id_producto: 1,
            id_variante: 2,
            cantidad: 1, // stock disponible = 2
            precio_unitario: 2500, // precio real de la variante
          },
        ],
      });

    console.log("Respuesta creación pedido:", res.body);

    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty("id_pedido");
    pedidoCreado = res.body.id_pedido;
  });

  it("debería listar todos los pedidos", async () => {
    const res = await request(app)
      .get("/pedidos")
      .set("Authorization", `Bearer ${tokenDueño}`);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("debería obtener detalle del pedido creado", async () => {
    const res = await request(app)
      .get(`/pedidos/${pedidoCreado}/detalle`)
      .set("Authorization", `Bearer ${tokenDueño}`);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("debería cambiar estado del pedido", async () => {
    const res = await request(app)
      .put(`/pedidos/${pedidoCreado}/estado`)
      .set("Authorization", `Bearer ${tokenDueño}`)
      .send({ estado: "confirmado" });
    expect(res.statusCode).toBe(200);
    expect(res.body.pedido.estado).toBe("confirmado");
  });
});

afterAll(async () => {
  await pool.end();
});
