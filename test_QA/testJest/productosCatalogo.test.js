// Test QA/testJest/productosCatalogo.test.js
const request = require("supertest");
const app = require("../../app");

describe("GET /productos/catalogo", () => {
it("debería devolver productos disponibles sin necesidad de token", async () => {
    const res = await request(app).get("/productos/catalogo");

    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);

    // Validar que cada producto tenga stock > 0
    res.body.forEach(producto => {
    expect(producto.stock).toBeGreaterThan(0);

      // Validar que no se incluya precio_compra
    expect(producto).not.toHaveProperty("precio_compra");

      // Validar que sí tenga precio_venta
    expect(producto).toHaveProperty("precio_venta");
    });
});
});
