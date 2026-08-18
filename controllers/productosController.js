const { validationResult } = require('express-validator');
const productosModel = require('../models/productosModel');
const proveedoresModel = require('../models/proveedoresModel');
const kardexModel = require('../models/kardexModel');

async function normalizarProveedores(value, res) {
  if (value === undefined) return undefined;

  let proveedores;
  try {
    proveedores = typeof value === 'string' ? JSON.parse(value) : value;
  } catch (err) {
    res.status(400).json({ error: 'Los proveedores deben tener un formato valido' });
    return null;
  }

  if (!Array.isArray(proveedores)) {
    res.status(400).json({ error: 'Los proveedores deben enviarse como una lista' });
    return null;
  }

  const ids = [...new Set(proveedores.map(Number))];
  if (ids.some((id) => !Number.isInteger(id) || id < 1)) {
    res.status(400).json({ error: 'Debe indicar proveedores validos' });
    return null;
  }

  for (const id of ids) {
    if (!(await proveedoresModel.obtenerPorId(id))) {
      res.status(400).json({ error: 'Uno de los proveedores no existe' });
      return null;
    }
  }

  return ids;
}

async function validarCodigosBarras(variantes, res) {
  const codigos = new Set();

  for (const variante of variantes || []) {
    const codigo = variante.codigo_barras == null
      ? null
      : String(variante.codigo_barras).trim();
    variante.codigo_barras = codigo || null;

    if (!codigo) continue;
    if (codigos.has(codigo)) {
      res.status(409).json({ error: 'No se permiten codigos de barras duplicados' });
      return false;
    }
    codigos.add(codigo);

    const existente = await productosModel.obtenerVariantePorCodigoBarras(codigo);
    if (existente && String(existente.id_variante) !== String(variante.id_variante || '')) {
      res.status(409).json({ error: 'El codigo de barras ya esta asignado a otra variante' });
      return false;
    }
  }

  return true;
}

function validarValoresNoNegativos(variantes, res) {
  for (const variante of variantes || []) {
    const nombre = variante.nombre_variante || 'sin nombre';
    const stock = Number(variante.stock);
    const precioCompra = Number(variante.precio_compra);
    const precioVenta = Number(variante.precio_venta);

    if (Number.isNaN(stock) || stock < 0) {
      res.status(400).json({ error: `El stock no puede ser negativo (variante "${nombre}")` });
      return false;
    }
    if (Number.isNaN(precioCompra) || precioCompra < 0) {
      res.status(400).json({ error: `El precio de compra no puede ser negativo (variante "${nombre}")` });
      return false;
    }
    if (Number.isNaN(precioVenta) || precioVenta < 0) {
      res.status(400).json({ error: `El precio de venta no puede ser negativo (variante "${nombre}")` });
      return false;
    }
  }
  return true;
}

function esErrorValorNegativo(err) {
  return err.code === '23514' && String(err.constraint || '').startsWith('chk_producto_variantes_');
}
function esErrorCodigoBarrasDuplicado(err) {
  return err.code === '23505' && err.constraint === 'uq_producto_variantes_codigo_barras';
}

function esErrorVarianteConDependencias(err) {
  return err.code === '23503'; // foreign_key_violation
}
async function crearProducto(req, res, next) {
   try {
    const errores = validationResult(req);
    if (!errores.isEmpty()) {
      return res.status(400).json({ error: errores.array()[0].msg });
    }
    const imagen_url = req.file ? req.file.path : null;
     const existente = await productosModel.obtenerPorNombreYCategoria(
      req.body.nombre,
      parseInt(req.body.id_categoria)
    );
    if (existente) {
      return res
        .status(409)
        .json({ error: "Ya existe un producto con ese nombre en esa categoría" });
    }

    const productoParaDB = {
      nombre:       req.body.nombre,
      descripcion:  req.body.descripcion,
      id_categoria: parseInt(req.body.id_categoria),
      imagen_url,
    };

    let variantesParaDB = [];
    try {
      if (req.body.variantes) {
        variantesParaDB =
          typeof req.body.variantes === 'string'
            ? JSON.parse(req.body.variantes)
            : req.body.variantes;
      }
    } catch (e) {
      console.error("Error al parsear variantes:", e);
      variantesParaDB = [];
    }

    if (variantesParaDB.length === 0) {
      variantesParaDB.push({
        nombre_variante: 'Único',
        stock:          parseInt(req.body.stock)          || 0,
        precio_compra:  parseFloat(req.body.precio_compra) || 0,
        precio_venta:   parseFloat(req.body.precio_venta)  || 0,
      });
    }

    if (!(await validarCodigosBarras(variantesParaDB, res))) return;
    if (!validarValoresNoNegativos(variantesParaDB, res)) return;
    const proveedores = await normalizarProveedores(req.body.proveedores ?? '[]', res);
    if (proveedores === null) return;

    const resultado = await productosModel.insertarConVariantes(
      productoParaDB,
      variantesParaDB,
      req.usuario?.id ?? null,
      proveedores,
    );

    res.status(201).json({
      mensaje: 'Producto creado con éxito',
      id: resultado.id_producto,
    });
  } catch (err) {
    console.error("ERROR DETECTADO EN EL BACKEND:", err.message);
    if (esErrorCodigoBarrasDuplicado(err)) {
      return res.status(409).json({ error: 'El codigo de barras ya esta asignado a otra variante' });
    }
    if (esErrorValorNegativo(err)) {
      return res.status(400).json({ error: 'El stock y los precios no pueden ser negativos' });
    }
    if (esErrorVarianteConDependencias(err)) {
      return res.status(409).json({
        error: 'No se puede eliminar una variante que ya tiene compras, ventas o movimientos de stock registrados.',
      });
    }
    next(err);
  }
}

async function actualizarProducto(req, res, next) {
  try {
    const errores = validationResult(req);
    if (!errores.isEmpty()) {
      return res.status(400).json({ error: errores.array()[0].msg });
    }
    const { id } = req.params;

    const datosProducto = {
      nombre:       req.body.nombre,
      descripcion:  req.body.descripcion,
      id_categoria: parseInt(req.body.id_categoria),
      // Respeta imagen nueva o mantiene la existente
      imagen_url:   req.file ? req.file.path : req.body.imagen_url,
    };

    // FIX: las variantes se parsean aquí y se pasan como TERCER argumento,
    // consistente con la nueva firma de actualizarConVariantes(id, datos, variantes).
    const variantes =
      typeof req.body.variantes === 'string'
        ? JSON.parse(req.body.variantes)
        : req.body.variantes;

    if (!(await validarCodigosBarras(variantes, res))) return;
    if (!validarValoresNoNegativos(variantes, res)) return;
    const proveedores = await normalizarProveedores(req.body.proveedores, res);
    if (proveedores === null) return;

    const resultado = await productosModel.actualizarConVariantes(
      id,
      datosProducto,
      variantes,
      req.usuario?.id ?? null,
      proveedores,
    );
    res.json({ mensaje: "Producto y variantes actualizados correctamente", resultado });
  } catch (err) {
    if (esErrorCodigoBarrasDuplicado(err)) {
      return res.status(409).json({ error: 'El codigo de barras ya esta asignado a otra variante' });
    }
   if (esErrorValorNegativo(err)) {
      return res.status(400).json({ error: 'El stock y los precios no pueden ser negativos' });
    }
    if (esErrorVarianteConDependencias(err)) {
      return res.status(409).json({
        error: 'No se puede eliminar una variante que ya tiene compras, ventas o movimientos de stock registrados.',
      });
    }
    next(err);
  }
}

async function eliminarProducto(req, res, next) {
  try {
    const { id } = req.params;
    const eliminado = await productosModel.eliminar(id);
    if (!eliminado) return res.status(404).json({ error: "Producto no encontrado" });
    res.json({ mensaje: "Producto eliminado correctamente" });
  } catch (err) {
    next(err);
  }
}

// GET /productos — panel de administración
// Ahora el modelo devuelve objetos ya agrupados con variantes[] anidadas,
// stock_total, precio_min y precio_compra_min calculados.
async function listarProductos(req, res, next) {
  try {
    const productos = await productosModel.obtenerTodosConVariantes();
    res.json(productos);
  } catch (err) {
    next(err);
  }
}

// GET /productos/catalogo — vista pública
// FIX: se preservan precio_compra_min y nombre_categoria con sus nombres correctos
async function listarCatalogo(req, res, next) {
  try {
    const productos = await productosModel.obtenerTodosConVariantes();
    const catalogo = productos.map((p) => ({
      id_producto:       p.id_producto,
      nombre:            p.nombre,
      descripcion:       p.descripcion,
      precio_min:        p.precio_min,
      precio_compra_min: p.precio_compra_min,
      imagen_url:        p.imagen_url,
      categoria:         p.nombre_categoria,
      stock_total:       p.stock_total,          // para que el frontend detecte sin stock
      variantes:         p.variantes.map((v) => ({
        id_variante:     v.id_variante,
        nombre_variante: v.nombre_variante,
        codigo_barras:   v.codigo_barras,
        precio_venta:    v.precio_venta,
        stock:           v.stock,                // necesario para marcar variante sin stock
      })),
    }));
    res.json(catalogo);
  } catch (err) {
    next(err);
  }
}
const obtenerHistorialPrecios = async (req, res) => {
  try {
    const { id } = req.params;

    console.log("➡️ Controller historial precios");
    console.log("ID:", id);

    const datos = await productosModel.obtenerHistorialPrecio(id)

    console.log(datos);

    res.json({
      ok: true,
      total: datos.length,
      datos,
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      ok: false,
      error: "Error al obtener el historial de precios.",
    });
  }
};
const obtenerHistorialCostos = async (req, res) => {
  try {
    const { id } = req.params;

    const datos = await productosModel.obtenerHistorialCosto(id);

    res.json({
      ok: true,
      total: datos.length,
      datos,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      ok: false,
      error: "Error al obtener el historial de costos.",
    });
  }
};
const obtenerKardex = async (req, res) => {
  try {
    const { id } = req.params;

    const datos = await kardexModel.obtenerPorProducto(id);

    res.json({
      ok: true,
      total: datos.length,
      datos,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      ok: false,
      error: "Error al obtener el Kardex.",
    });
  }
};
const obtenerHistorialCompras = async (req, res) => {
  try {
    const { id } = req.params;

    const datos = await productosModel.obtenerHistorialCompras(id);

    res.json({
      ok: true,
      total: datos.length,
      datos,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      ok: false,
      error: "Error al obtener el historial de compras.",
    });
  }
};
const obtenerHistorialVentas = async (req, res) => {
  try {
    const { id } = req.params;

    const datos = await productosModel.obtenerHistorialVentas(id);

    res.json({
      ok: true,
      total: datos.length,
      datos,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      ok: false,
      error: "Error al obtener el historial de ventas.",
    });
  }
};

module.exports = {
  crearProducto,
  actualizarProducto,
  listarProductos,
  listarCatalogo,
  eliminarProducto,
  obtenerHistorialPrecios,
  obtenerHistorialCostos,
  obtenerKardex,
  obtenerHistorialCompras,
  obtenerHistorialVentas,
  
};