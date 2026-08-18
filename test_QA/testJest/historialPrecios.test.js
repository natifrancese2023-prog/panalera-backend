jest.mock('../../db', () => ({
  connect: jest.fn(),
}));

const pool = require('../../db');
const productosModel = require('../../models/productosModel');

describe('historial de precios de productos', () => {
  let client;

  beforeEach(() => {
    client = {
      query: jest.fn(),
      release: jest.fn(),
    };
    pool.connect.mockResolvedValue(client);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('registra el precio inicial de una variante dentro de la transaccion de alta', async () => {
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ id_producto: 10 }] })
      .mockResolvedValueOnce({ rows: [{ id_variante: 20, precio_venta: '1500' }] })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});

    await productosModel.insertarConVariantes(
      { nombre: 'Producto', descripcion: '', id_categoria: 1, imagen_url: null },
      [{ nombre_variante: 'Unico', stock: 2, precio_compra: 900, precio_venta: 1500 }],
      7,
    );

    const llamadaHistorial = client.query.mock.calls.find(([sql]) =>
      sql.includes('INSERT INTO producto_historial_precio'),
    );
    expect(llamadaHistorial[1]).toEqual([20, null, '1500', 7]);
    expect(client.query.mock.calls.map(([sql]) => sql)).toContain('COMMIT');
  });

  it('registra solo el cambio efectivo de precio al editar una variante', async () => {
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ precio_venta: '1000' }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ precio_venta: '1200' }] })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});

    await productosModel.actualizarConVariantes(
      10,
      { nombre: 'Producto', descripcion: '', id_categoria: 1, imagen_url: null },
      [{ id_variante: 20, nombre_variante: 'Unico', stock: 2, precio_compra: 900, precio_venta: 1200 }],
      7,
    );

    const llamadaHistorial = client.query.mock.calls.find(([sql]) =>
      sql.includes('INSERT INTO producto_historial_precio'),
    );
    expect(llamadaHistorial[1]).toEqual([20, '1000', '1200', 7]);
    expect(client.query.mock.calls.map(([sql]) => sql)).toContain('COMMIT');
  });
});
