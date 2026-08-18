jest.mock('../../db', () => ({
  query: jest.fn(),
}));

const pool = require('../../db');
const productosModel = require('../../models/productosModel');

describe('codigo de barras de variantes', () => {
  afterEach(() => jest.clearAllMocks());

  it('consulta una variante por su codigo de barras', async () => {
    pool.query.mockResolvedValue({ rows: [{ id_variante: 20 }] });

    const variante = await productosModel.obtenerVariantePorCodigoBarras('7791234567890');

    expect(pool.query).toHaveBeenCalledWith(
      'SELECT id_variante FROM producto_variantes WHERE codigo_barras = $1',
      ['7791234567890'],
    );
    expect(variante).toEqual({ id_variante: 20 });
  });
});
