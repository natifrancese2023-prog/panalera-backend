// Test QA/testJest/pedidos.test.js
const request = require("supertest");
const app = require("../../index");

describe("Flujo de pedidos", () => {
let tokenCliente;
let tokenDueño;
let pedidoCreado;

beforeAll(async () => {
    // Login cliente
    const loginCliente = await request(app)
    .post("/usuarios/login")
    .send({ email: "nati@cliente.com", contraseña: "clave_segura" });
    tokenCliente = loginCliente.body.token;

    // Login dueño
    const loginDueño = await request(app)
    .post("/usuarios/login")
    .send({ email: "nati@mail.com", contraseña: "clave_segura" });
    tokenDueño = loginDueño.body.token;
});

it("debería rechazar crear pedido sin token", async () => {
    const res = await request(app).post("/pedidos").send({
    productos: [{ id_producto: 1, cantidad: 1 }]
    });
    expect(res.statusCode).toBe(401);
});

it("debería rechazar pedido con stock insuficiente", async () => {
    const res = await request(app)
    .post("/pedidos")
    .set("Authorization", `Bearer ${tokenCliente}`)
    .send({
        productos: [{ id_producto: 1, cantidad: 9999 }] // más que el stock
    });
    expect(res.statusCode).toBe(400);
    expect(res.text).toMatch(/Stock insuficiente/);
});

it("debería rechazar pedido con cantidad negativa", async () => {
    const res = await request(app)
    .post("/pedidos")
    .set("Authorization", `Bearer ${tokenCliente}`)
    .send({
        productos: [{ id_producto: 1, cantidad: -3 }] // cantidad inválida
    });
    expect(res.statusCode).toBe(400);
    expect(res.text).toMatch(/debe ser mayor a 0/);
});

it("debería crear un pedido válido", async () => {
    const res = await request(app)
    .post("/pedidos")
    .set("Authorization", `Bearer ${tokenCliente}`)
    .send({
        productos: [{ id_producto: 1, cantidad: 2 }]
    });
    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty("id_pedido");
    pedidoCreado = res.body;
});

it("cliente debería listar sus pedidos", async () => {
    const res = await request(app)
    .get("/pedidos/mis-pedidos")
    .set("Authorization", `Bearer ${tokenCliente}`);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
});

it("dueño debería listar todos los pedidos", async () => {
    const res = await request(app)
    .get("/pedidos")
    .set("Authorization", `Bearer ${tokenDueño}`);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
});

it("dueño debería cambiar estado de un pedido", async () => {
    const res = await request(app)
    .put(`/pedidos/${pedidoCreado.id_pedido}/estado`)
    .set("Authorization", `Bearer ${tokenDueño}`)
    .send({ estado: "confirmado" });
    expect(res.statusCode).toBe(200);
    expect(res.body.estado).toBe("confirmado");
});

it("debería rechazar cambio de estado inválido", async () => {
    const res = await request(app)
    .put(`/pedidos/${pedidoCreado.id_pedido}/estado`)
    .set("Authorization", `Bearer ${tokenDueño}`)
      .send({ estado: "en camino" }); // estado no permitido
    expect(res.statusCode).toBe(400);
    expect(res.text).toMatch(/Estado inválido/);
});
});
