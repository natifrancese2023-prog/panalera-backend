// backend/constants/stockEnums.js

const TRANSICIONES_PERMITIDAS = Object.freeze({
  pendiente: ['confirmado', 'entregado', 'cancelado'],
  confirmado: ['entregado', 'cancelado'],
  entregado: ['facturado', 'cancelado'],
  facturado: [],
  cancelado: [],
});

const TIPOS_MOVIMIENTO = Object.freeze({
  COMPRA: 'COMPRA',
  VENTA: 'VENTA',
  PEDIDO_RESERVA: 'PEDIDO_RESERVA',
  PEDIDO_CANCELACION: 'PEDIDO_CANCELACION',
  DEVOLUCION_CLIENTE: 'DEVOLUCION_CLIENTE',
  AJUSTE_POSITIVO: 'AJUSTE_POSITIVO',
  AJUSTE_NEGATIVO: 'AJUSTE_NEGATIVO',
});

const OPERACIONES_STOCK = Object.freeze({
  DESCUENTO: 'DESCUENTO',
  DEVOLUCION: 'DEVOLUCION',
  COMPRA: 'COMPRA',
  INCREMENTO_AJUSTE: 'INCREMENTO_AJUSTE',
  DECREMENTO_AJUSTE: 'DECREMENTO_AJUSTE',
});

// Mapa de factores numéricos para eliminar bloques if/else complejos en el servicio
const FACTOR_OPERACION = Object.freeze({
  [OPERACIONES_STOCK.COMPRA]: 1,
  [OPERACIONES_STOCK.DEVOLUCION]: 1,
  [OPERACIONES_STOCK.INCREMENTO_AJUSTE]: 1,
  [OPERACIONES_STOCK.DESCUENTO]: -1,
  [OPERACIONES_STOCK.DECREMENTO_AJUSTE]: -1,
});

module.exports = {
  TRANSICIONES_PERMITIDAS,
  TIPOS_MOVIMIENTO,
  OPERACIONES_STOCK,
  FACTOR_OPERACION,
};