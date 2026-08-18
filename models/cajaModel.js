const pool = require("../db");
const { AppError } = require("./errors");

const FORMAS_PAGO_VALIDAS = [
  "efectivo",
  "debito",
  "credito",
  "transferencia",
  "mercadopago",
];

/**
 * Devuelve la caja abierta actual, o null si no hay ninguna. Se usa
 * tanto acá como desde otros módulos (Ventas, Cuenta Corriente) para
 * saber si corresponde registrar un movimiento.
 */
const obtenerCajaAbierta = async (client = pool) => {
  const { rows } = await client.query(
    `SELECT * FROM caja_apertura WHERE estado = 'abierta' LIMIT 1;`
  );
  return rows[0] || null;
};
const obtenerUltimaCajaCerrada = async (client = pool) => {
  const { rows } = await client.query(
    `
    SELECT *
    FROM caja_apertura
    WHERE estado = 'cerrada'
    ORDER BY fecha_cierre DESC
    LIMIT 1;
    `
  );

  return rows[0] || null;
};

const abrirCaja = async ({
  saldo_inicial,
  saldo_contado,
  id_usuario = null,
}) => {
  const existente = await obtenerCajaAbierta();

  if (existente) {
    throw new AppError(
      `Ya hay una caja abierta (#${existente.id_caja}, desde ${existente.fecha_apertura}). Cerrala antes de abrir una nueva.`,
      409
    );
  }

  const ultimaCaja = await obtenerUltimaCajaCerrada();

  let montoInicial;

  // ==========================================
  // PRIMERA APERTURA
  // ==========================================

  if (!ultimaCaja) {
    montoInicial = Number(saldo_inicial);

    if (
      !Number.isFinite(montoInicial) ||
      montoInicial < 0
    ) {
      throw new AppError(
        "El saldo inicial no puede ser negativo.",
        400
      );
    }
  }

  // ==========================================
  // APERTURA DESDE EL CIERRE ANTERIOR
  // ==========================================

  else {
    montoInicial = Number(saldo_contado);

    if (
      !Number.isFinite(montoInicial) ||
      montoInicial < 0
    ) {
      throw new AppError(
        "Ingresá el efectivo contado para iniciar la caja.",
        400
      );
    }
  }

  const { rows } = await pool.query(
    `
    INSERT INTO caja_apertura
      (saldo_inicial, id_usuario)
    VALUES ($1, $2)
    RETURNING *;
    `,
    [montoInicial, id_usuario]
  );

  return rows[0];
};
/**
 * Registra un movimiento de caja. Pensada para reutilizarse DENTRO de
 * otra transacción (ej. la de Venta Directa o la de un pago de cuenta
 * corriente, pasando el mismo `client`), igual que
 * cuentaCorrienteModel.registrarMovimiento.
 *
 * Si no hay caja abierta, NO bloquea la operación que la llama (una
 * venta no debería fallar porque nadie abrió la caja) -- devuelve
 * `null` y quien llama decide si loguear el caso. Queda como pregunta
 * abierta si en tu negocio real preferís lo contrario (bloquear venta
 * en efectivo sin caja abierta); así arranca, es el comportamiento
 * menos disruptivo.
 */
const registrarMovimiento = async (
  client,
  {
    tipo,
    origen,
    forma_pago,
    monto,
    id_referencia = null,
    observaciones = null,
    id_usuario = null,
  }
) => {
  const caja = await obtenerCajaAbierta(client);

  if (!caja) {
    return null;
  }

  if (!["ingreso", "egreso"].includes(tipo)) {
    throw new AppError(
      "Tipo de movimiento de caja inválido.",
      400
    );
  }

  if (!FORMAS_PAGO_VALIDAS.includes(forma_pago)) {
    throw new AppError(
      `Forma de pago inválida para caja: '${forma_pago}'.`,
      400
    );
  }

  const montoNumerico = Number(monto);

  if (
    !Number.isFinite(montoNumerico) ||
    montoNumerico <= 0
  ) {
    throw new AppError(
      "El monto del movimiento de caja debe ser mayor a 0.",
      400
    );
  }

  const { rows } = await client.query(
    `
    INSERT INTO caja_movimiento
      (
        id_caja,
        tipo,
        origen,
        forma_pago,
        monto,
        id_referencia,
        observaciones,
        id_usuario
      )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
    RETURNING *;
    `,
    [
      caja.id_caja,
      tipo,
      origen,
      forma_pago,
      montoNumerico,
      id_referencia,
      observaciones,
      id_usuario,
    ]
  );

  return rows[0];
};

/**
 * Alta de un retiro de dinero -- el único movimiento que nace directo
 * en Caja, sin pasar por otro módulo.
 */
const registrarRetiro = async ({
  monto,
  observaciones = null,
  id_usuario = null,
}) => {
  const caja = await obtenerCajaAbierta();

  if (!caja) {
    throw new AppError(
      "No hay ninguna caja abierta.",
      409
    );
  }

  const montoNumerico = Number(monto);

  if (
    !Number.isFinite(montoNumerico) ||
    montoNumerico <= 0
  ) {
    throw new AppError(
      "El monto del retiro debe ser mayor a 0.",
      400
    );
  }

  const { rows } = await pool.query(
    `
    INSERT INTO caja_movimiento
      (
        id_caja,
        tipo,
        origen,
        forma_pago,
        monto,
        observaciones,
        id_usuario
      )
    VALUES (
      $1,
      'egreso',
      'retiro',
      'efectivo',
      $2,
      $3,
      $4
    )
    RETURNING *;
    `,
    [
      caja.id_caja,
      montoNumerico,
      observaciones,
      id_usuario,
    ]
  );

  return rows[0];
};
/**
 * Estado actual de la caja abierta: saldo esperado en EFECTIVO
 * (que es lo único que se compara al cerrar, porque es lo único que
 * se puede contar físicamente), más el desglose por forma de pago de
 * todo lo demás, y el detalle de movimientos.
 */
const obtenerEstadoCaja = async (id_caja) => {
  const cajaRes = await pool.query(`SELECT * FROM caja_apertura WHERE id_caja = $1`, [id_caja]);
  const caja = cajaRes.rows[0];
  if (!caja) throw new AppError("Caja no encontrada.", 404);

  const movimientosRes = await pool.query(
    `SELECT * FROM caja_movimiento WHERE id_caja = $1 ORDER BY fecha ASC;`,
    [id_caja]
  );
  const movimientos = movimientosRes.rows;

  const porFormaPago = {};
  for (const fp of FORMAS_PAGO_VALIDAS) {
    porFormaPago[fp] = { ingresos: 0, egresos: 0 };
  }
  for (const m of movimientos) {
    const monto = Number(m.monto);
    if (m.tipo === "ingreso") porFormaPago[m.forma_pago].ingresos += monto;
    else porFormaPago[m.forma_pago].egresos += monto;
  }

  const efectivoIngresos = porFormaPago.efectivo.ingresos;
  const efectivoEgresos = porFormaPago.efectivo.egresos;
  const saldoEsperadoEfectivo =
    Number(caja.saldo_inicial) + efectivoIngresos - efectivoEgresos;

  return {
    caja,
    saldo_inicial: Number(caja.saldo_inicial),
    saldo_esperado_efectivo: saldoEsperadoEfectivo,
    desglose_por_forma_pago: porFormaPago,
    movimientos,
  };
};

const cerrarCaja = async (id_caja, { saldo_contado, id_usuario = null }) => {
  const estado = await obtenerEstadoCaja(id_caja);
  if (estado.caja.estado !== "abierta") {
    throw new AppError("Esta caja ya fue cerrada.", 409);
  }
  if (saldo_contado == null || Number(saldo_contado) < 0) {
    throw new AppError("El saldo contado no puede ser negativo.", 400);
  }

  const diferencia = Number(saldo_contado) - estado.saldo_esperado_efectivo;

  const { rows } = await pool.query(
    `
    UPDATE caja_apertura
    SET estado = 'cerrada', fecha_cierre = NOW(), saldo_contado = $2, diferencia = $3
    WHERE id_caja = $1
    RETURNING *;
    `,
    [id_caja, saldo_contado, diferencia]
  );

  return { ...estado, caja: rows[0], saldo_contado: Number(saldo_contado), diferencia };
};
const listarHistorialCajas = async () => {
  const { rows } = await pool.query(`
    SELECT
      id_caja,
      fecha_apertura,
      fecha_cierre,
      saldo_inicial,
      saldo_contado,
      diferencia,
      estado
    FROM caja_apertura
    ORDER BY fecha_apertura DESC;
  `);

  return rows;
};

module.exports = {
  obtenerCajaAbierta,
  obtenerUltimaCajaCerrada,
  abrirCaja,
  listarHistorialCajas,
  registrarMovimiento,
  registrarRetiro,
  obtenerEstadoCaja,
  cerrarCaja,
  
};