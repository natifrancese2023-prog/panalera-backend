// services/comprasSugeridasPdfService.js
//
// Genera el PDF de "lista de mercadería" de una Compra Sugerida, para
// que el usuario se lo mande al proveedor por fuera del sistema
// (WhatsApp, mail, etc.). A propósito NO incluye precios, costos,
// subtotales ni totales -- ver punto 8 del diseño del módulo.
//
// Requiere: npm install pdfkit --save

const PDFDocument = require("pdfkit");

function formatearCantidad(item) {
  const unidades = item.cantidad_confirmada_unidades;
  if (item.presentacion_compra && item.cantidad_por_presentacion > 1) {
    const enPresentacion = unidades / item.cantidad_por_presentacion;
    return `${enPresentacion} ${item.presentacion_compra} (${unidades} unidades)`;
  }
  if (item.presentacion_compra) {
    return `${unidades} ${item.presentacion_compra}`;
  }
  return `${unidades} unidades`;
}

/**
 * @param {Object} sugerida  resultado de comprasSugeridasModel.obtenerPorId(id)
 * @returns {Promise<Buffer>}
 */
function generarPdfListaMercaderia(sugerida) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const chunks = [];

    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const fecha = new Date(sugerida.generado_en).toLocaleDateString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });

    // ── Encabezado ──
    doc
      .fontSize(18)
      .font("Helvetica-Bold")
      .text("Pedido de mercadería", { align: "left" });

    doc.moveDown(0.5);
    doc
      .fontSize(12)
      .font("Helvetica")
      .text(`Proveedor: ${sugerida.proveedor_nombre}`)
      .text(`Fecha: ${fecha}`);

    doc.moveDown(1);
    doc
      .moveTo(doc.x, doc.y)
      .lineTo(doc.page.width - doc.page.margins.right, doc.y)
      .strokeColor("#cccccc")
      .stroke();
    doc.moveDown(1);

    // ── Tabla de productos (sin precios) ──
    const colProducto = doc.x;
    const colCantidad = doc.page.width - doc.page.margins.right - 180;

    doc.font("Helvetica-Bold").fontSize(11);
    const yEncabezado = doc.y;
    doc.text("Producto", colProducto, yEncabezado, { continued: false });
    doc.text("Cantidad", colCantidad, yEncabezado, { width: 180, align: "right" });
    doc.moveDown(0.3);
    doc
      .moveTo(doc.x, doc.y)
      .lineTo(doc.page.width - doc.page.margins.right, doc.y)
      .strokeColor("#000000")
      .stroke();
    doc.moveDown(0.5);

    doc.font("Helvetica").fontSize(11);
    for (const item of sugerida.items) {
      const nombreCompleto = item.nombre_variante
        ? `${item.producto} — ${item.nombre_variante}`
        : item.producto;

      const yFila = doc.y;
      doc.text(nombreCompleto, colProducto, yFila, { width: colCantidad - colProducto - 10 });
      doc.text(formatearCantidad(item), colCantidad, yFila, { width: 180, align: "right" });
      doc.moveDown(0.6);

      // Salto de página si se acerca al final
      if (doc.y > doc.page.height - doc.page.margins.bottom - 80) {
        doc.addPage();
      }
    }

    // ── Observaciones ──
    if (sugerida.observaciones) {
      doc.moveDown(1.5);
      doc.font("Helvetica-Bold").fontSize(11).text("Observaciones:");
      doc.font("Helvetica").fontSize(11).text(sugerida.observaciones);
    }

    doc.end();
  });
}

module.exports = { generarPdfListaMercaderia };