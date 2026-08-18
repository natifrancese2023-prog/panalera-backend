const pool = require("../db");
const { AppError } = require("./errors");
const cajaModel = require("./cajaModel");
const FORMAS_PAGO_VALIDAS = [
  "efectivo",
  "debito",
  "credito",
  "transferencia",
  "mercadopago",
];
/**
 * Inserta un movimiento de cuenta corriente. Diseñada para poder
 * reutilizarse DENTRO de otra transacción (ej. la de Venta Directa,
 * pasando el mismo `client`) o de forma standalone (pasando `pool`).
 */
const registrarMovimiento = async (
  client,
  {
    id_cliente,
    tipo,
    monto,
    id_pedido = null,
    forma_pago = null,
    observaciones = null,
    id_usuario = null,
  }
) => {
  // ==========================================
  // VALIDAR TIPO
  // ==========================================

  if (!["venta", "pago"].includes(tipo)) {
    throw new AppError(
      "Tipo de movimiento inválido.",
      400
    );
  }

  // ==========================================
  // VALIDAR CLIENTE
  // ==========================================

  const clienteRes = await client.query(
    `
    SELECT id_usuario
    FROM usuario
    WHERE id_usuario = $1
      AND rol = 'cliente'
    `,
    [id_cliente]
  );

  if (clienteRes.rowCount === 0) {
    throw new AppError(
      "Cliente no encontrado.",
      404
    );
  }

  // ==========================================
  // VALIDAR MONTO
  // ==========================================

  const montoNumerico = Number(monto);

  if (
    !Number.isFinite(montoNumerico) ||
    montoNumerico <= 0
  ) {
    throw new AppError(
      "El monto del movimiento debe ser mayor a 0.",
      400
    );
  }

  // ==========================================
  // INSERTAR MOVIMIENTO
  // ==========================================

  const { rows } = await client.query(
    `
    INSERT INTO cuenta_corriente_movimiento
      (
        id_cliente,
        tipo,
        monto,
        id_pedido,
        forma_pago,
        observaciones,
        id_usuario
      )
    VALUES ($1,$2,$3,$4,$5,$6,$7)
    RETURNING *;
    `,
    [
      id_cliente,
      tipo,
      montoNumerico,
      id_pedido,
      forma_pago,
      observaciones,
      id_usuario,
    ]
  );

  return rows[0];
};
/**
 * Saldo actual (calculado, nunca almacenado) + historial de
 * movimientos de un cliente.
 */
const obtenerCuentaCliente = async (id_cliente) => {
  const clienteRes = await pool.query(
    `SELECT id_usuario, nombre, apellido, dni FROM usuario WHERE id_usuario = $1 AND rol = 'cliente'`,
    [id_cliente]
  );
  const cliente = clienteRes.rows[0];
  if (!cliente) {
    throw new AppError("Cliente no encontrado.", 404);
  }

  const movimientosRes = await pool.query(
    `
    SELECT *
    FROM cuenta_corriente_movimiento
    WHERE id_cliente = $1
    ORDER BY fecha ASC;
    `,
    [id_cliente]
  );

  const saldo = movimientosRes.rows.reduce(
    (acc, m) => acc + (m.tipo === "venta" ? Number(m.monto) : -Number(m.monto)),
    0
  );

  return {
    cliente,
    saldo,
    movimientos: movimientosRes.rows,
  };
};

/**
 * Lista todos los clientes con saldo pendiente (>0), para una pantalla
 * general de cuentas corrientes sin tener que buscar cliente por
 * cliente.
 */
const listarClientesConSaldo = async () => {
  const { rows } = await pool.query(
    `
    SELECT
      u.id_usuario,
      u.nombre,
      u.apellido,
      u.dni,
      COALESCE(SUM(CASE WHEN m.tipo = 'venta' THEN m.monto ELSE -m.monto END), 0) AS saldo
    FROM usuario u
    INNER JOIN cuenta_corriente_movimiento m ON m.id_cliente = u.id_usuario
    WHERE u.rol = 'cliente'
    GROUP BY u.id_usuario, u.nombre, u.apellido, u.dni
    HAVING COALESCE(SUM(CASE WHEN m.tipo = 'venta' THEN m.monto ELSE -m.monto END), 0) > 0
    ORDER BY saldo DESC;
    `
  );
  return rows;
};

/**
 * Registra un pago suelto (no asociado a una venta puntual del
 * momento) -- lo que el cliente abona después, desde la pantalla de
 * Cuenta Corriente. FASE 3: además genera su movimiento de Caja
 * correspondiente (es plata real entrando al negocio).
 */
const registrarPago = async (
  id_cliente,
  {
    monto,
    forma_pago,
    observaciones = null,
    id_usuario = null,
  }
) => {
  if (!forma_pago || !FORMAS_PAGO_VALIDAS.includes(forma_pago)) {
    throw new AppError(
      "La forma de pago es inválida.",
      400
    );
  }

  const montoPago = Number(monto);

  if (!Number.isFinite(montoPago) || montoPago <= 0) {
    throw new AppError(
      "El monto del pago debe ser mayor a 0.",
      400
    );
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // ==========================================
    // VERIFICAR CLIENTE
    // ==========================================

    const clienteRes = await client.query(
      `
      SELECT id_usuario
      FROM usuario
      WHERE id_usuario = $1
        AND rol = 'cliente'
      `,
      [id_cliente]
    );

    if (clienteRes.rowCount === 0) {
      throw new AppError(
        "Cliente no encontrado.",
        404
      );
    }

    // ==========================================
    // CALCULAR SALDO ACTUAL
    // ==========================================

    const saldoRes = await client.query(
      `
      SELECT
        COALESCE(
          SUM(
            CASE
              WHEN tipo = 'venta' THEN monto
              WHEN tipo = 'pago' THEN -monto
              ELSE 0
            END
          ),
          0
        ) AS saldo
      FROM cuenta_corriente_movimiento
      WHERE id_cliente = $1
      `,
      [id_cliente]
    );

    const saldoActual = Number(
      saldoRes.rows[0].saldo || 0
    );

    // ==========================================
    // NO PERMITIR PAGO MAYOR A LA DEUDA
    // ==========================================

    if (saldoActual <= 0) {
      throw new AppError(
        "El cliente no tiene saldo pendiente.",
        400
      );
    }

    if (montoPago > saldoActual) {
      throw new AppError(
        `El monto supera el saldo pendiente. Saldo actual: $${saldoActual.toLocaleString(
          "es-AR"
        )}.`,
        400
      );
    }

    // ==========================================
    // REGISTRAR PAGO EN CUENTA CORRIENTE
    // ==========================================

    const movimiento = await registrarMovimiento(
      client,
      {
        id_cliente,
        tipo: "pago",
        monto: montoPago,
        forma_pago,
        observaciones,
        id_usuario,
      }
    );

    // ==========================================
    // REGISTRAR INGRESO EN CAJA
    // ==========================================

    await cajaModel.registrarMovimiento(
      client,
      {
        tipo: "ingreso",
        origen: "pago_cc",
        forma_pago,
        monto: montoPago,
        id_referencia: movimiento.id_movimiento,
        observaciones,
        id_usuario,
      }
    );

    await client.query("COMMIT");

    return movimiento;

  } catch (error) {

    await client.query("ROLLBACK");
    throw error;

  } finally {

    client.release();

  }
};
module.exports = {
  registrarMovimiento,
  obtenerCuentaCliente,
  listarClientesConSaldo,
  registrarPago,
};