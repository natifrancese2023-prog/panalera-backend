// Test QA/testJest/productos.test.js
const request = require("supertest");
const app = require("../../index");

let tokenDueño;
let productoCreado;

beforeAll(async () => {
  // Login con usuario dueño para obtener token
const login = await request(app)
    .post("/usuarios/login")
    .send({ email: "nati@mail.com", contraseña: "clave_segura" });

tokenDueño = login.body.token;
});

describe("Flujo completo de productos", () => {
it("debería rechazar listar productos sin token", async () => {
    const res = await request(app).get("/productos");
    expect(res.statusCode).toBe(401);
});

it("debería listar productos con token válido y rol dueño", async () => {
    const res = await request(app)
    .get("/productos")      .set("Authorization", `Bearer ${tokenDueño}`);

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
});

it("debería crear un producto válido", async () => {
    const res = await request(app)
    .post("/productos")
    .set("Authorization", `Bearer ${tokenDueño}`)
    .send({
        nombre: "Helado de Chocolate",
        descripcion: "Helado artesanal sabor chocolate",
        stock: 50,
        precio_compra: 100,
        precio_venta: 200,
        id_categoria: 1
    });

    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty("producto");
    productoCreado = res.body.producto;
});

it("debería rechazar crear producto duplicado", async () => {
    const res = await request(app)
    .post("/productos")
    .set("Authorization", `Bearer ${tokenDueño}`)
    .send({
        nombre: "Helado de Chocolate",
        descripcion: "Duplicado",
        stock: 10,
        precio_compra: 50,
        precio_venta: 100,
        id_categoria: 1
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
        descripcion: "Helado artesanal con cacao extra",
        stock: 60,
        precio_compra: 120,
        precio_venta: 250,
        id_categoria: 1
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.producto.nombre).toBe("Helado de Chocolate Premium");
});

it("debería eliminar un producto existente", async () => {
    const res = await request(app)
    .delete(`/productos/${productoCreado.id_producto}`)
    .set("Authorization", `Bearer ${tokenDueño}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.mensaje).toBe("Producto eliminado correctamente");
});
});
