const request = require("supertest");
const app = require("../../app");
const pool = require("../../db");

jest.setTimeout(30000);

let tokenDueño;
let productoCreado;
let nombreUnico;

beforeAll(async () => {
  const login = await request(app)
    .post("/usuarios/login")
    .send({ email: "mimitos_agostina@gmail.com", contrasena: "Mimitos1!" });
  tokenDueño = login.body.token;

  // Generar nombre único para este ciclo de tests
  nombreUnico = "Helado Test " + Date.now();
});

describe("Flujo completo de productos", () => {
  it("debería rechazar listar productos sin token", async () => {
    const res = await request(app).get("/productos");
    expect(res.statusCode).toBe(401);
  });

  it("debería listar productos con token válido y rol dueño", async () => {
    const res = await request(app)
      .get("/productos")
      .set("Authorization", `Bearer ${tokenDueño}`);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("debería crear un producto válido", async () => {
    const res = await request(app)
      .post("/productos")
      .set("Authorization", `Bearer ${tokenDueño}`)
      .send({
        nombre: nombreUnico,
        descripcion: "Postre clásico",
        id_categoria: 1, // 👈 usar un ID real de la tabla categoria
        precio_compra: 50,
        precio_venta: 100,
        stock: 10
      });
    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty("id");
    productoCreado = { id_producto: res.body.id, nombre: nombreUnico };
  });

  it("debería rechazar crear producto duplicado", async () => {
    const res = await request(app)
      .post("/productos")
      .set("Authorization", `Bearer ${tokenDueño}`)
      .send({
        nombre: productoCreado.nombre, // 👈 mismo nombre
        descripcion: "Postre clásico",
        id_categoria: 1,
        precio_compra: 50,
        precio_venta: 100,
        stock: 10
      });
    expect(res.statusCode).toBe(409);
    expect(res.body.error).toBe("Ya existe un producto con ese nombre en esa categoría");
  });

  it("debería actualizar un producto existente", async () => {
    const res = await request(app)
      .put(`/productos/${productoCreado.id_producto}`)
      .set("Authorization", `Bearer ${tokenDueño}`)
      .send({
        nombre: "Helado de Chocolate Premium",
        descripcion: "Postre clásico",
        id_categoria: 1,
        precio_compra: 60,
        precio_venta: 120,
        stock: 15
      });
    expect(res.statusCode).toBe(200);
  });

  it("debería eliminar un producto existente", async () => {
    const res = await request(app)
      .delete(`/productos/${productoCreado.id_producto}`)
      .set("Authorization", `Bearer ${tokenDueño}`);
    expect(res.statusCode).toBe(200);
  });
});

afterAll(async () => {
  await pool.end();
});
