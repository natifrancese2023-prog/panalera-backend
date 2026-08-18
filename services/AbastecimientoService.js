const pool = require('../db');

class AbastecimientoService {
  /**
   * Obtiene la configuración comercial aplicable usando la regla de jerarquía:
   * Variante específica > Producto global.
   *
   * Uso: consumido por el módulo Compras cuando ya se sabe a qué proveedor
   * se le está comprando, para precargar compra_minima/tiempo_entrega/etc.
   * No reemplaza a proveedoresModel: esto es solo lectura.
   */
  static async obtenerConfiguracionProveedor(idProveedor, idProducto, idVariante = null, client = pool) {
    const query = `
      SELECT *
      FROM producto_proveedor
      WHERE id_proveedor = $1 
        AND id_producto = $2 
        AND (id_variante = $3 OR id_variante IS NULL)
        AND activo = TRUE
      ORDER BY id_variante DESC NULLS LAST
      LIMIT 1;
    `;
    const res = await client.query(query, [idProveedor, idProducto, idVariante]);
    return res.rows[0] || null;
  }


  static async registrarUltimaCompra(idProveedor, idProducto, idVariante, precioCompra, fechaCompra = new Date(), client = pool) {
    const query = `
      INSERT INTO producto_proveedor (
        id_proveedor, id_producto, id_variante,
        compra_minima, tiempo_entrega_dias, es_principal, prioridad, activo,
        fecha_ultima_compra, ultimo_precio_compra
      )
      VALUES ($1, $2, $3, 1, 1, FALSE, 1, TRUE, $4, $5)
      ON CONFLICT (id_proveedor, id_producto, (COALESCE(id_variante, 0)))
      DO UPDATE SET
        fecha_ultima_compra  = EXCLUDED.fecha_ultima_compra,
        ultimo_precio_compra = EXCLUDED.ultimo_precio_compra,
        activo                = TRUE
      RETURNING *;
    `;
    const res = await client.query(query, [idProveedor, idProducto, idVariante, fechaCompra, precioCompra]);
    return res.rows[0];
  }
}

module.exports = AbastecimientoService;