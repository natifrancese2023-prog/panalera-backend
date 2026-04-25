const request = require("supertest");
const app = require("../../app");
const pool = require("../../db");

jest.setTimeout(30000);

let tokenDueño;
let pedidoCreado;
let facturaCreada;

beforeAll(async () => {
  // Login con dueño
  const login = await request(app)
    .post("/usuarios/login")
    .send({ email: "mimitos_agostina@gmail.com", contrasena: "Mimitos1!" });
  tokenDueño = login.body.token;

  // Crear pedido válido
  const pedidoRes = await request(app)
    .post("/pedidos")
    .set("Authorization", `Bearer ${tokenDueño}`)
    .send({
      id_cliente: 2, // Cliente real
      productos: [
        {
          id_producto: 1,   // Producto Estrella
          id_variante: 2,   // Variante Único
          cantidad: 1,
          precio_unitario: 2500
        }
      ]
    });

  pedidoCreado = pedidoRes.body.id_pedido;

  // Cambiar estado del pedido a 'entregado' (requisito para facturar)
  await request(app)
    .put(`/pedidos/${pedidoCreado}/estado`)
    .set("Authorization", `Bearer ${tokenDueño}`)
    .send({ estado: "entregado" });
});

describe("Flujo completo de facturas", () => {
  it("debería crear una factura válida", async () => {
    const res = await request(app)
      .post("/facturas")
      .set("Authorization", `Bearer ${tokenDueño}`)
      .send({
        id_pedido: pedidoCreado,
        forma_pago: "efectivo",
        observaciones: "Factura de prueba"
      });

    console.log("Respuesta creación factura:", res.body);

    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty("factura");
    facturaCreada = res.body.factura.id_factura;
  });

  it("debería listar todas las facturas", async () => {
    const res = await request(app)
      .get("/facturas")
      .set("Authorization", `Bearer ${tokenDueño}`);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("debería obtener la factura creada por ID", async () => {
    const res = await request(app)
      .get(`/facturas/${facturaCreada}`)
      .set("Authorization", `Bearer ${tokenDueño}`);
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("id_factura");
    expect(res.body.id_factura).toBe(facturaCreada);
  });
});

afterAll(async () => {
  await pool.end();
});

