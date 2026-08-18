const comprasSugeridasModel = require("../models/comprasSugeridasModel");
const { calcularSugerencias } = require("../services/comprasSugeridasService");

exports.calcular = async (req, res, next) => {
  try {
    const periodoAnalisisDias = Number(req.query.periodoAnalisisDias);
    const periodoCoberturaDias = Number(req.query.periodoCoberturaDias);

    if (!periodoAnalisisDias || !periodoCoberturaDias) {
      return res.status(400).json({
        error: "periodoAnalisisDias y periodoCoberturaDias son obligatorios.",
      });
    }

    const resultado = await calcularSugerencias({
      periodoAnalisisDias,
      periodoCoberturaDias,
    });

    res.json(resultado);
  } catch (error) {
    if (error.message?.includes("debe ser un entero")) {
      return res.status(400).json({ error: error.message });
    }
    next(error);
  }
};

exports.crear = async (req, res, next) => {
  try {
    const { items, periodoAnalisisDias, periodoCoberturaDias, observaciones } = req.body;

    const cabeceras = await comprasSugeridasModel.crearDesdeGrilla(items, {
      periodoAnalisisDias,
      periodoCoberturaDias,
      observaciones,
      id_usuario: req.usuario?.id ?? null,
    });

    res.status(201).json({
      mensaje: `Se generaron ${cabeceras.length} compra(s) sugerida(s) pendiente(s).`,
      compras_sugeridas: cabeceras,
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    next(error);
  }
};

exports.listar = async (req, res, next) => {
  try {
    const pendientes = await comprasSugeridasModel.listarPendientes();
    res.json(pendientes);
  } catch (error) {
    next(error);
  }
};

exports.obtenerPorId = async (req, res, next) => {
  try {
    const { id } = req.params;
    const sugerida = await comprasSugeridasModel.obtenerPorId(id);
    if (!sugerida) {
      return res.status(404).json({ error: "Compra sugerida no encontrada." });
    }
    res.json(sugerida);
  } catch (error) {
    next(error);
  }
};

// Da forma a los datos para precargar el modal "Nueva compra" del
// módulo Compras existente. No crea ninguna compra -- eso lo sigue
// haciendo el módulo Compras cuando el usuario confirme desde ahí.
exports.prepararParaCompra = async (req, res, next) => {
  try {
    const { id } = req.params;
    const datos = await comprasSugeridasModel.prepararParaCompra(id);
    res.json(datos);
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    next(error);
  }
};

// Alternativas de proveedor para un producto/variante puntual, para que
// el usuario pueda cambiar manualmente lo que sugirió el motor.
exports.proveedoresDisponibles = async (req, res, next) => {
  try {
    const idProducto = Number(req.query.idProducto);
    const idVariante = req.query.idVariante ? Number(req.query.idVariante) : null;

    if (!idProducto) {
      return res.status(400).json({ error: "idProducto es obligatorio." });
    }

    const disponibles = await comprasSugeridasModel.obtenerProveedoresDisponibles(
      idProducto,
      idVariante
    );
    res.json(disponibles);
  } catch (error) {
    next(error);
  }
};

// Genera el PDF de "lista de mercadería" para enviarle al proveedor.
// A propósito NO incluye precios, costos, subtotales ni totales --
// es solo qué pedir, no un comprobante ni una orden de compra formal.
exports.generarPDF = async (req, res, next) => {
  try {
    const { id } = req.params;
    const sugerida = await comprasSugeridasModel.obtenerPorId(id);

    if (!sugerida) {
      return res.status(404).json({ error: "Compra sugerida no encontrada." });
    }

    const { generarPdfListaMercaderia } = require("../services/comprasSugeridasPdfService");
    const buffer = await generarPdfListaMercaderia(sugerida);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="pedido-${sugerida.proveedor_nombre.replace(/\s+/g, "_")}-${id}.pdf"`
    );
    res.send(buffer);
  } catch (error) {
    next(error);
  }
};

// Se llama DESPUÉS de que el módulo Compras ya creó la compra real
// (POST /compras), para vincularla y marcar la sugerida como usada.
exports.marcarRegistrada = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { id_compra } = req.body;

    if (!id_compra) {
      return res.status(400).json({ error: "id_compra es obligatorio." });
    }

    const actualizada = await comprasSugeridasModel.marcarRegistrada(id, id_compra);
    res.json({ mensaje: "Compra sugerida marcada como registrada.", compra_sugerida: actualizada });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    next(error);
  }
};