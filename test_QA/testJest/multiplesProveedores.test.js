jest.mock('../../db', () => ({
  query: jest.fn(),
}));

const pool = require('../../db');
const productosModel = require('../../models/productosModel');

describe('proveedores de productos', () => {
  afterEach(() => jest.clearAllMocks());

  it('agrega los proveedores al producto sin duplicar sus variantes', async () => {
    pool.query
      .mockResolvedValueOnce({
        rows: [{
          id_producto: 10,
          nombre: 'Producto',
          descripcion: '',
          id_categoria: 1,
          imagen_url: null,
          id_variante: 20,
          nombre_variante: 'Unico',
          codigo_barras: null,
          stock_variante: 2,
          precio_venta_variante: 1500,
          precio_compra_variante: 900,
          categoria_nombre: 'Categoria',
        }],
      })
      .mockResolvedValueOnce({
        rows: [{
          id_producto: 10,
          id_proveedor: 3,
          nombre: 'Proveedor Uno',
          telefono: '123',
          direccion: 'Direccion',
        }],
      });

    const productos = await productosModel.obtenerTodosConVariantes();

    expect(productos).toHaveLength(1);
    expect(productos[0].variantes).toHaveLength(1);
    expect(productos[0].proveedores).toEqual([{
      id_proveedor: 3,
      nombre: 'Proveedor Uno',
      telefono: '123',
      direccion: 'Direccion',
    }]);
  });
});
