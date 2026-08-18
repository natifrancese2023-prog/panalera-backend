jest.mock('../../db', () => ({
  connect: jest.fn(),
}));

const pool = require('../../db');
const productosModel = require('../../models/productosModel');
const comprasModel = require('../../models/comprasModel');

describe('historial de costos de productos', () => {
  let client;

  beforeEach(() => {
    client = { query: jest.fn(), release: jest.fn() };
    pool.connect.mockResolvedValue(client);
  });

  afterEach(() => jest.clearAllMocks());

  it('registra un cambio de costo realizado desde Productos', async () => {
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ precio_venta: '1500', precio_compra: '900' }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ precio_venta: '1500', precio_compra: '1000' }] })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});

    await productosModel.actualizarConVariantes(
      10,
      { nombre: 'Producto', descripcion: '', id_categoria: 1, imagen_url: null },
      [{ id_variante: 20, nombre_variante: 'Unico', stock: 2, precio_compra: 1000, precio_venta: 1500 }],
      7,
    );

    const llamada = client.query.mock.calls.find(([sql]) =>
      sql.includes('INSERT INTO producto_historial_costo'),
    );
    expect(llamada[1]).toEqual([10, 20, '900', '1000', 7]);
    expect(client.query.mock.calls.map(([sql]) => sql)).toContain('COMMIT');
  });

  it('registra el cambio de costo realizado al confirmar una Compra', async () => {
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ id_compra: 30 }] })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ precio_compra: '900' }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ precio_compra: '1000' }] })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});

    await comprasModel.insertar({
      id_proveedor: 1,
      productos: [{ id_producto: 10, id_variante: 20, cantidad: 2, precio_unitario: 1000 }],
      id_usuario: 7,
    });

    const llamada = client.query.mock.calls.find(([sql]) =>
      sql.includes('INSERT INTO producto_historial_costo'),
    );
    expect(llamada[1]).toEqual([10, 20, '900', '1000', 7]);
    expect(client.query.mock.calls.map(([sql]) => sql)).toContain('COMMIT');
  });
});
