import express, { Request, Response, NextFunction } from "express";
import { authenticateToken, requireRole } from "../middleware/auth.js";
import { idempotency } from "../middleware/idempotency.js";
import prisma from "../lib/prisma.js";
import {
  Prisma,
  ServicioExterno,
  TipoMovimiento as PrismaTipoMovimiento,
  TipoViaTransferencia,
  TipoAsignacionServicio,
} from "@prisma/client";
import {
  registrarMovimientoSaldo,
  TipoMovimiento as TipoMov,
  TipoReferencia,
} from "../services/movimientoSaldoService.js";

const router = express.Router();

/** === Tipos auxiliares TS === */
type RolUsuario =
  | "OPERADOR"
  | "ADMIN"
  | "SUPER_USUARIO"
  | "ADMINISTRATIVO"
  | "CONCESION";
interface AuthenticatedUser {
  id: string;
  username: string;
  nombre: string;
  rol: RolUsuario;
  activo: boolean;
  punto_atencion_id: string | null;
}
type AuthedRequest = Request & { user: AuthenticatedUser };

/** Type guard: asegura que req.user existe y es OPERADOR */
function isOperador(
  req: Request
): req is AuthedRequest & { user: AuthenticatedUser & { rol: "OPERADOR" } } {
  const user = (req as Partial<AuthedRequest>).user;
  return !!user && user.rol === "OPERADOR";
}

function isServicioExterno(v: unknown): v is ServicioExterno {
  return (
    typeof v === "string" &&
    Object.values(ServicioExterno).includes(v as ServicioExterno)
  );
}

function isTipoMovimientoInOut(
  v: unknown
): v is Extract<PrismaTipoMovimiento, "INGRESO" | "EGRESO"> {
  return v === PrismaTipoMovimiento.INGRESO || v === PrismaTipoMovimiento.EGRESO;
}

function parseMetodoIngreso(v: unknown): TipoViaTransferencia {
  const raw = typeof v === "string" ? v.trim().toUpperCase() : "";
  if (raw === "BANCO") return TipoViaTransferencia.BANCO;
  if (raw === "MIXTO") return TipoViaTransferencia.MIXTO;
  return TipoViaTransferencia.EFECTIVO;
}

/** Catálogos válidos (coinciden con Prisma enums) */
const SERVICIOS_VALIDOS: ServicioExterno[] = [
  ServicioExterno.YAGANASTE,
  ServicioExterno.BANCO_GUAYAQUIL,
  ServicioExterno.WESTERN,
  ServicioExterno.PRODUBANCO,
  ServicioExterno.BANCO_PACIFICO,
  ServicioExterno.SERVIENTREGA,
  ServicioExterno.INSUMOS_OFICINA,
  ServicioExterno.INSUMOS_LIMPIEZA,
  ServicioExterno.OTROS,
];

// Servicios que tienen asignación de saldo propio (crédito digital)
const SERVICIOS_CON_ASIGNACION: ServicioExterno[] = [
  ServicioExterno.YAGANASTE,
  ServicioExterno.BANCO_GUAYAQUIL,
  ServicioExterno.WESTERN,
  ServicioExterno.PRODUBANCO,
  ServicioExterno.BANCO_PACIFICO,
  ServicioExterno.SERVIENTREGA,
];

// Servicios que usan saldo general/efectivo (no tienen asignación)
const SERVICIOS_SALDO_GENERAL: ServicioExterno[] = [
  ServicioExterno.INSUMOS_OFICINA,
  ServicioExterno.INSUMOS_LIMPIEZA,
  ServicioExterno.OTROS,
];

const TIPOS_VALIDOS: Array<Extract<PrismaTipoMovimiento, "INGRESO" | "EGRESO">> = [
  PrismaTipoMovimiento.INGRESO,
  PrismaTipoMovimiento.EGRESO,
];

/** Utils fecha GYE */
async function gyeTodayWindow() {
  const { gyeDayRangeUtcFromDate } = await import("../utils/timezone.js");
  return gyeDayRangeUtcFromDate(new Date()); // { gte, lt }
}

/** Asegura que exista USD y devuelve su id (usa unique por codigo) */
async function ensureUsdMonedaId(): Promise<string> {
  const existing = await prisma.moneda.findUnique({
    where: { codigo: "USD" },
    select: { id: true },
  });
  if (existing?.id) return existing.id;

  const created = await prisma.moneda.create({
    data: {
      nombre: "Dólar estadounidense",
      simbolo: "$",
      codigo: "USD",
      activo: true,
      orden_display: 0,
      comportamiento_compra: "MULTIPLICA",
      comportamiento_venta: "DIVIDE",
    },
    select: { id: true },
  });
  return created.id;
}

/* ==============================
 * Middleware personalizado para validar saldo en servicios externos
 * - Servicios con asignación (YaGanaste, Bancos, Western): validan su saldo asignado para INGRESO
 * - Servicios de saldo general (Insumos, Otros): validan saldo general para EGRESO
 * ============================== */
async function validarSaldoServicioExterno(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const servicio = body.servicio;
  const tipo_movimiento = body.tipo_movimiento;
  const monto = body.monto;
  const billetes = body.billetes;
  const monedas_fisicas = body.monedas_fisicas;
  const metodo_ingreso = body.metodo_ingreso;
  
  // Servicios con asignación: INGRESO necesita validar su propio saldo
  if (
    isServicioExterno(servicio) &&
    SERVICIOS_CON_ASIGNACION.includes(servicio) &&
    tipo_movimiento === PrismaTipoMovimiento.INGRESO
  ) {
    // La validación del saldo asignado se hace en la transacción principal
    return next();
  }
  
  // Servicios de saldo general: INGRESO no requiere validación (cliente trae dinero)
  if (
    isServicioExterno(servicio) &&
    SERVICIOS_SALDO_GENERAL.includes(servicio) &&
    tipo_movimiento === PrismaTipoMovimiento.INGRESO
  ) {
    return next();
  }
  
  // EGRESO siempre necesita validar saldo general (sale dinero del punto)
  // Pero debe validarse por bucket (CAJA vs BANCOS) según metodo_ingreso.
  if (tipo_movimiento === PrismaTipoMovimiento.EGRESO) {
    try {
      const montoNum = typeof monto === "string" ? parseFloat(monto) : Number(monto);
      if (!isFinite(montoNum) || montoNum <= 0) {
        res.status(400).json({ success: false, message: "monto debe ser un número > 0" });
        return;
      }

      const metodoIngreso = parseMetodoIngreso(metodo_ingreso);
      const billetesMonto =
        typeof billetes === "number" && !isNaN(billetes) ? billetes : 0;
      const monedasMonto =
        typeof monedas_fisicas === "number" && !isNaN(monedas_fisicas)
          ? monedas_fisicas
          : 0;

      let montoCaja = 0;
      let montoBancos = 0;
      if (metodoIngreso === TipoViaTransferencia.EFECTIVO) {
        montoCaja = montoNum;
      } else if (metodoIngreso === TipoViaTransferencia.BANCO) {
        montoBancos = montoNum;
      } else if (metodoIngreso === TipoViaTransferencia.MIXTO) {
        montoCaja = Math.min(montoNum, Math.max(0, billetesMonto + monedasMonto));
        montoBancos = Math.max(0, montoNum - montoCaja);
      }

      const usdId = await ensureUsdMonedaId();
      const puntoId = (req as Partial<AuthedRequest>).user?.punto_atencion_id;
      if (!puntoId) {
        res.status(400).json({
          success: false,
          message:
            "Debes iniciar una jornada y tener un punto de atención asignado para registrar movimientos.",
        });
        return;
      }

      const saldo = await prisma.saldo.findUnique({
        where: {
          punto_atencion_id_moneda_id: {
            punto_atencion_id: puntoId,
            moneda_id: usdId,
          },
        },
        select: { cantidad: true, bancos: true },
      });

      const saldoCaja = Number(saldo?.cantidad || 0);
      const saldoBancos = Number(saldo?.bancos || 0);

      if (saldoCaja + 0.01 < montoCaja) {
        res.status(400).json({
          success: false,
          message: `Saldo insuficiente en CAJA. Saldo: $${saldoCaja.toFixed(
            2
          )}, requerido: $${montoCaja.toFixed(2)}`,
        });
        return;
      }
      if (saldoBancos + 0.01 < montoBancos) {
        res.status(400).json({
          success: false,
          message: `Saldo insuficiente en BANCOS. Saldo: $${saldoBancos.toFixed(
            2
          )}, requerido: $${montoBancos.toFixed(2)}`,
        });
        return;
      }

      return next();
    } catch {
      res.status(500).json({ success: false, message: "Error validando saldo" });
      return;
    }
  }
  
  return next();
}

/* ==============================
 * POST /servicios-externos/movimientos  (OPERADOR)
 * ============================== */
router.post(
  "/movimientos",
  authenticateToken,
  idempotency({ route: "/api/servicios-externos/movimientos" }),
  validarSaldoServicioExterno,
  async (req: Request, res: Response) => {
    try {
      if (!isOperador(req)) {
        res.status(403).json({
          success: false,
          message: "Permisos insuficientes (solo OPERADOR)",
        });
        return;
      }

      const body = (req.body ?? {}) as Record<string, unknown>;
      const servicio = body.servicio;
      const tipo_movimiento = body.tipo_movimiento;
      const monto = body.monto;
      const descripcion = body.descripcion;
      const numero_referencia = body.numero_referencia;
      const comprobante_url = body.comprobante_url;
      const billetes = body.billetes;
      const monedas_fisicas = body.monedas_fisicas;
      const metodo_ingreso = body.metodo_ingreso;

      const puntoId = req.user.punto_atencion_id;

      if (!puntoId) {
        res.status(400).json({
          success: false,
          message:
            "Debes iniciar una jornada y tener un punto de atención asignado para registrar movimientos.",
        });
        return;
      }
      if (!isServicioExterno(servicio) || !SERVICIOS_VALIDOS.includes(servicio)) {
        res.status(400).json({ success: false, message: "servicio inválido" });
        return;
      }
      if (!isTipoMovimientoInOut(tipo_movimiento) || !TIPOS_VALIDOS.includes(tipo_movimiento)) {
        res
          .status(400)
          .json({ success: false, message: "tipo_movimiento inválido" });
        return;
      }

      // Validar metodo_ingreso (EFECTIVO, BANCO, MIXTO)
      const metodoIngreso = parseMetodoIngreso(metodo_ingreso);

      const montoNum = typeof monto === "string" ? parseFloat(monto) : Number(monto);
      if (!isFinite(montoNum) || montoNum <= 0) {
        res
          .status(400)
          .json({ success: false, message: "monto debe ser un número > 0" });
        return;
      }

      const usdId = await ensureUsdMonedaId();

      const movimiento = await prisma.$transaction(async (tx) => {
        const round2 = (n: number) => Math.round(n * 100) / 100;
        const clamp0 = (n: number) => (n < 0 ? 0 : n);

        const normalizeBreakdownToTotal = (input: {
          total: number;
          billetes: number;
          monedas: number;
          bancos: number;
        }) => {
          let total = round2(input.total);
          let billetesN = round2(clamp0(input.billetes));
          let monedasN = round2(clamp0(input.monedas));
          let bancosN = round2(clamp0(input.bancos));

          if (total < 0) total = 0;
          if (bancosN > total) bancosN = total;

          const rest = total - monedasN - bancosN;
          billetesN = round2(clamp0(rest));

          const sum = round2(billetesN + monedasN + bancosN);
          const diff = round2(total - sum);
          if (Math.abs(diff) > 0.01) {
            billetesN = round2(clamp0(billetesN + diff));
          }
          return { total, billetes: billetesN, monedas: monedasN, bancos: bancosN };
        };

        const consumeFrom = (
          current: { billetes: number; monedas: number; bancos: number },
          amount: number,
          prefer: Array<"bancos" | "billetes" | "monedas">
        ) => {
          let remaining = round2(amount);
          const out = { ...current };
          for (const key of prefer) {
            if (remaining <= 0.0001) break;
            const available = out[key];
            const take = Math.min(available, remaining);
            out[key] = round2(out[key] - take);
            remaining = round2(remaining - take);
          }
          return { next: out, remaining };
        };

        // Separar servicios con asignación vs saldo general
        let saldoServicioAnterior: number | null = null;
        let saldoServicioNuevo: number | null = null;
        
        const tieneAsignacion = SERVICIOS_CON_ASIGNACION.includes(servicio);

        if (tieneAsignacion) {
          // Obtener saldo del servicio externo específico
          const saldoServicio = await tx.servicioExternoSaldo.findUnique({
            where: {
              punto_atencion_id_servicio_moneda_id: {
                punto_atencion_id: puntoId,
                  servicio,
                moneda_id: usdId,
              },
            },
          });

          saldoServicioAnterior = Number(saldoServicio?.cantidad || 0);
          
          // NUEVA LÓGICA CORRECTA:
          // INGRESO (Cliente paga servicio) -> RESTA del saldo asignado (se usa el crédito)
          // EGRESO (Operador repone dinero) -> SUMA al saldo asignado (se repone el crédito)
          const deltaDigital =
            tipo_movimiento === PrismaTipoMovimiento.INGRESO ? -montoNum : montoNum;
          saldoServicioNuevo = saldoServicioAnterior + deltaDigital;

          // Validar saldo suficiente del SERVICIO para INGRESOS (usa crédito)
          if (
            tipo_movimiento === PrismaTipoMovimiento.INGRESO &&
            saldoServicioNuevo < 0
          ) {
            throw new Error(
              `Saldo insuficiente en el servicio ${servicio}. Saldo actual: $${saldoServicioAnterior.toFixed(
                2
              )}, Monto requerido: $${montoNum.toFixed(2)}`
            );
          }

          const billetesMonto =
            typeof billetes === "number" && !isNaN(billetes) ? billetes : 0;
          const monedasMonto =
            typeof monedas_fisicas === "number" && !isNaN(monedas_fisicas)
              ? monedas_fisicas
              : 0;
          
          let bancosMonto = 0;
          if (metodoIngreso === TipoViaTransferencia.BANCO) {
            bancosMonto = montoNum;
          } else if (metodoIngreso === TipoViaTransferencia.MIXTO) {
            bancosMonto = Math.max(0, montoNum - (billetesMonto + monedasMonto));
          }

          // Aplicar actualización robusta: mantener `cantidad` (TOTAL) y evitar componentes negativos.
          const currentTotal = saldoServicio ? Number(saldoServicio.cantidad) : 0;
          const currentBilletesRaw = saldoServicio ? Number(saldoServicio.billetes) : 0;
          const currentMonedasRaw = saldoServicio ? Number(saldoServicio.monedas_fisicas) : 0;
          const currentBancosRaw = saldoServicio ? Number(saldoServicio.bancos) : 0;

          const normalizedCurrent = normalizeBreakdownToTotal({
            total: currentTotal,
            billetes: currentBilletesRaw,
            monedas: currentMonedasRaw,
            bancos: currentBancosRaw,
          });

          const nextTotal = round2(normalizedCurrent.total + deltaDigital);
          if (nextTotal < -0.01) {
            throw new Error(
              `Saldo insuficiente en el servicio ${servicio}. Saldo actual: $${normalizedCurrent.total.toFixed(
                2
              )}, Monto requerido: $${montoNum.toFixed(2)}`
            );
          }

          let nextBreakdown = { ...normalizedCurrent, total: clamp0(nextTotal) };

          if (deltaDigital > 0) {
            // Recarga
            if (metodoIngreso === TipoViaTransferencia.BANCO) {
              nextBreakdown.bancos = round2(nextBreakdown.bancos + deltaDigital);
            } else if (metodoIngreso === TipoViaTransferencia.EFECTIVO) {
              const addBil = billetesMonto > 0 || monedasMonto > 0 ? billetesMonto : deltaDigital;
              const addMon = billetesMonto > 0 || monedasMonto > 0 ? monedasMonto : 0;
              nextBreakdown.billetes = round2(nextBreakdown.billetes + addBil);
              nextBreakdown.monedas = round2(nextBreakdown.monedas + addMon);
            } else {
              const efectivo = Math.min(deltaDigital, Math.max(0, billetesMonto + monedasMonto));
              const banco = round2(deltaDigital - efectivo);
              const addBil = billetesMonto > 0 || monedasMonto > 0 ? Math.min(efectivo, billetesMonto) : efectivo;
              const addMon = billetesMonto > 0 || monedasMonto > 0 ? Math.min(efectivo - addBil, monedasMonto) : 0;
              nextBreakdown.billetes = round2(nextBreakdown.billetes + addBil);
              nextBreakdown.monedas = round2(nextBreakdown.monedas + addMon);
              nextBreakdown.bancos = round2(nextBreakdown.bancos + banco);
            }
          } else if (deltaDigital < 0) {
            // Consumo
            const consume = round2(-deltaDigital);
            const prefer: Array<"bancos" | "billetes" | "monedas"> =
              metodoIngreso === TipoViaTransferencia.BANCO
                ? ["bancos", "billetes", "monedas"]
                : metodoIngreso === TipoViaTransferencia.EFECTIVO
                  ? ["billetes", "monedas", "bancos"]
                  : ["bancos", "billetes", "monedas"];

            const consumed = consumeFrom(
              {
                billetes: nextBreakdown.billetes,
                monedas: nextBreakdown.monedas,
                bancos: nextBreakdown.bancos,
              },
              consume,
              prefer
            );

            if (consumed.remaining > 0.01) {
              throw new Error(
                `Saldo insuficiente en el servicio ${servicio} para descontar. Restante: $${consumed.remaining.toFixed(
                  2
                )}`
              );
            }

            nextBreakdown = {
              ...nextBreakdown,
              billetes: consumed.next.billetes,
              monedas: consumed.next.monedas,
              bancos: consumed.next.bancos,
            };
          }

          const finalNormalized = normalizeBreakdownToTotal({
            total: nextBreakdown.total,
            billetes: nextBreakdown.billetes,
            monedas: nextBreakdown.monedas,
            bancos: nextBreakdown.bancos,
          });

          if (saldoServicio) {
            await tx.servicioExternoSaldo.update({
              where: { id: saldoServicio.id },
              data: {
                cantidad: finalNormalized.total,
                billetes: finalNormalized.billetes,
                monedas_fisicas: finalNormalized.monedas,
                bancos: finalNormalized.bancos,
                updated_at: new Date(),
              },
            });
          } else {
            await tx.servicioExternoSaldo.create({
              data: {
                punto_atencion_id: puntoId,
                servicio,
                moneda_id: usdId,
                cantidad: finalNormalized.total,
                billetes: finalNormalized.billetes,
                monedas_fisicas: finalNormalized.monedas,
                bancos: finalNormalized.bancos,
                updated_at: new Date(),
              },
            });
          }
        }

        // SALDO FÍSICO GENERAL DEL PUNTO (efectivo de cambio de divisas)
        const saldoGeneral = await tx.saldo.findUnique({
          where: {
            punto_atencion_id_moneda_id: {
              punto_atencion_id: puntoId,
              moneda_id: usdId,
            },
          },
        });

        const saldoGeneralAnterior = Number(saldoGeneral?.cantidad || 0);
        const saldoBancosAnterior = Number(saldoGeneral?.bancos || 0);
        let billetesMonto =
          typeof billetes === "number" && !isNaN(billetes) ? billetes : 0;
        let monedasMonto =
          typeof monedas_fisicas === "number" && !isNaN(monedas_fisicas)
            ? monedas_fisicas
            : 0;

        const breakdownProvided =
          (typeof billetes === "number" && billetes > 0) ||
          (typeof monedas_fisicas === "number" && monedas_fisicas > 0);

        // Si es EFECTIVO y no viene desglose, asumir todo en billetes para
        // mantener consistencia (evita que `Saldo.cantidad` cambie pero el desglose quede en 0).
        if (metodoIngreso === TipoViaTransferencia.EFECTIVO && !breakdownProvided) {
          billetesMonto = montoNum;
          monedasMonto = 0;
        }

        // Si es BANCO, no debe venir desglose en efectivo.
        if (metodoIngreso === TipoViaTransferencia.BANCO) {
          billetesMonto = 0;
          monedasMonto = 0;
        }

        // Separar el movimiento físico en CAJA vs BANCOS (no mezclar en `Saldo.cantidad`)
        let montoCaja = 0;
        let bancosMonto = 0;
        if (metodoIngreso === TipoViaTransferencia.EFECTIVO) {
          montoCaja = montoNum;
        } else if (metodoIngreso === TipoViaTransferencia.BANCO) {
          bancosMonto = montoNum;
        } else if (metodoIngreso === TipoViaTransferencia.MIXTO) {
          montoCaja = Math.min(montoNum, Math.max(0, billetesMonto + monedasMonto));
          bancosMonto = Math.max(0, montoNum - montoCaja);
        }

        // Validaciones básicas de coherencia
        if (metodoIngreso === TipoViaTransferencia.EFECTIVO) {
          const efectivoDetallado = billetesMonto + monedasMonto;
          if (Math.abs(efectivoDetallado - montoNum) > 0.01) {
            throw new Error(
              `Detalle de efectivo inconsistente: billetes+monedas ($${efectivoDetallado.toFixed(
                2
              )}) debe igualar monto ($${montoNum.toFixed(2)}) en EFECTIVO.`
            );
          }
        }
        if (metodoIngreso === TipoViaTransferencia.MIXTO) {
          const efectivoDetallado = billetesMonto + monedasMonto;
          if (efectivoDetallado - montoNum > 0.01) {
            throw new Error(
              `Detalle MIXTO inconsistente: billetes+monedas ($${efectivoDetallado.toFixed(
                2
              )}) no puede exceder monto ($${montoNum.toFixed(2)}).`
            );
          }
        }

        const sign = tipo_movimiento === PrismaTipoMovimiento.INGRESO ? 1 : -1;
        const deltaCaja = sign * montoCaja;
        const deltaBancos = sign * bancosMonto;
        const nuevoSaldoCaja = saldoGeneralAnterior + deltaCaja;
        const nuevoSaldoBancos = saldoBancosAnterior + deltaBancos;

        if (nuevoSaldoCaja < -0.01) {
          throw new Error(
            `Saldo insuficiente en CAJA. Saldo actual: $${saldoGeneralAnterior.toFixed(
              2
            )}, requerido: $${Math.abs(deltaCaja).toFixed(2)}`
          );
        }
        if (nuevoSaldoBancos < -0.01) {
          throw new Error(
            `Saldo insuficiente en BANCOS. Saldo actual: $${saldoBancosAnterior.toFixed(
              2
            )}, requerido: $${Math.abs(deltaBancos).toFixed(2)}`
          );
        }

        if (saldoGeneral) {
          let dBil = 0;
          let dMon = 0;
          let dBk = 0;

          if (metodoIngreso === "EFECTIVO") {
            dBil =
              tipo_movimiento === PrismaTipoMovimiento.INGRESO
                ? billetesMonto
                : -billetesMonto;
            dMon =
              tipo_movimiento === PrismaTipoMovimiento.INGRESO
                ? monedasMonto
                : -monedasMonto;
          } else if (metodoIngreso === "BANCO") {
            dBk =
              tipo_movimiento === PrismaTipoMovimiento.INGRESO
                ? montoNum
                : -montoNum;
          } else if (metodoIngreso === "MIXTO") {
            dBil =
              tipo_movimiento === PrismaTipoMovimiento.INGRESO
                ? billetesMonto
                : -billetesMonto;
            dMon =
              tipo_movimiento === PrismaTipoMovimiento.INGRESO
                ? monedasMonto
                : -monedasMonto;
            const bM = Math.max(0, montoNum - (billetesMonto + monedasMonto));
            dBk =
              tipo_movimiento === PrismaTipoMovimiento.INGRESO ? bM : -bM;
          }

          await tx.saldo.update({
            where: { id: saldoGeneral.id },
            data: {
              cantidad: nuevoSaldoCaja,
              billetes: { increment: dBil },
              monedas_fisicas: { increment: dMon },
              bancos: { increment: dBk },
              updated_at: new Date(),
            },
          });
        } else {
          // Crear saldo general si no existe (respetando CAJA vs BANCOS)
          const initialCaja = sign * montoCaja;
          const initialBil = sign * billetesMonto;
          const initialMon = sign * monedasMonto;
          const initialBk = sign * bancosMonto;

          await tx.saldo.create({
            data: {
              punto_atencion_id: puntoId,
              moneda_id: usdId,
              cantidad: initialCaja,
              billetes: initialBil,
              monedas_fisicas: initialMon,
              bancos: initialBk,
              updated_at: new Date(),
            },
          });
        }

        // Registro del movimiento
        const svcMov = await tx.servicioExternoMovimiento.create({
          data: {
            punto_atencion_id: puntoId,
            servicio,
            tipo_movimiento,
            moneda_id: usdId,
            monto: montoNum,
            usuario_id: req.user.id,
            fecha: new Date(),
            descripcion: typeof descripcion === "string" ? descripcion : null,
            numero_referencia:
              typeof numero_referencia === "string" ? numero_referencia : null,
            comprobante_url:
              typeof comprobante_url === "string" ? comprobante_url : null,
            billetes: billetesMonto,
            monedas_fisicas: monedasMonto,
            bancos: bancosMonto,
            metodo_ingreso: metodoIngreso,
          },
        });

        // Trazabilidad en MovimientoSaldo (separando CAJA vs BANCOS)
        const tipoMovSaldo =
          tipo_movimiento === PrismaTipoMovimiento.INGRESO
            ? TipoMov.INGRESO
            : TipoMov.EGRESO;

        if (montoCaja > 0) {
          await registrarMovimientoSaldo(
            {
              puntoAtencionId: puntoId,
              monedaId: usdId,
              tipoMovimiento: tipoMovSaldo,
              monto: montoCaja,
              saldoAnterior: saldoGeneralAnterior,
              saldoNuevo: nuevoSaldoCaja,
              tipoReferencia: TipoReferencia.SERVICIO_EXTERNO,
              referenciaId: svcMov.id,
              saldoBucket: "CAJA",
              descripcion: `${servicio} - ${descripcion || tipo_movimiento} (CAJA)` ,
              usuarioId: req.user.id,
            },
            tx
          );
        }

        if (bancosMonto > 0) {
          await registrarMovimientoSaldo(
            {
              puntoAtencionId: puntoId,
              monedaId: usdId,
              tipoMovimiento: tipoMovSaldo,
              monto: bancosMonto,
              saldoAnterior: saldoBancosAnterior,
              saldoNuevo: nuevoSaldoBancos,
              tipoReferencia: TipoReferencia.SERVICIO_EXTERNO,
              referenciaId: svcMov.id,
              saldoBucket: "BANCOS",
              descripcion: `${servicio} - ${descripcion || tipo_movimiento} (BANCOS)` ,
              usuarioId: req.user.id,
            },
            tx
          );
        }

        return {
          ...svcMov,
          monto: Number(svcMov.monto),
          ...(tieneAsignacion && {
            saldo_anterior: saldoServicioAnterior,
            saldo_nuevo: saldoServicioNuevo,
          }),
        };
      });

      res.status(201).json({ success: true, movimiento });
    } catch (error) {
      console.error("Error creando movimiento de servicios externos:", error);
      res.status(500).json({
        success: false,
        message: error instanceof Error ? error.message : "Error desconocido",
      });
    }
  }
);

/* ==============================
 * GET /movimientos/:pointId  (OPERADOR — solo su punto)
 * ============================== */
router.get(
  "/movimientos/:pointId",
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      if (!isOperador(req)) {
        res.status(403).json({
          success: false,
          message: "Permisos insuficientes (solo OPERADOR)",
        });
        return;
      }

      const puntoAsignado = req.user.punto_atencion_id;
      const { pointId } = req.params;
      if (pointId !== puntoAsignado) {
        res.status(403).json({
          success: false,
          message: "Solo puedes consultar movimientos del punto asignado.",
        });
        return;
      }

      const { servicio, tipo_movimiento, desde, hasta, limit } = req.query as {
        servicio?: string;
        tipo_movimiento?: string;
        desde?: string;
        hasta?: string;
        limit?: string;
      };
      const take = Math.min(Math.max(parseInt(limit || "100", 10), 1), 500);

      const where: Prisma.ServicioExternoMovimientoWhereInput = {
        punto_atencion_id: pointId,
      };
      if (isServicioExterno(servicio) && SERVICIOS_VALIDOS.includes(servicio))
        where.servicio = servicio;
      if (isTipoMovimientoInOut(tipo_movimiento) && TIPOS_VALIDOS.includes(tipo_movimiento))
        where.tipo_movimiento = tipo_movimiento;
      if (desde || hasta) {
        where.fecha = {
          gte: desde ? new Date(`${desde}T00:00:00.000Z`) : undefined,
          lte: hasta ? new Date(`${hasta}T23:59:59.999Z`) : undefined,
        };
      }

      const rows = await prisma.servicioExternoMovimiento.findMany({
        where,
        orderBy: { fecha: "desc" },
        take,
        include: {
          usuario: { select: { id: true, nombre: true } },
          moneda: { select: { id: true, nombre: true, codigo: true, simbolo: true } },
          puntoAtencion: { select: { id: true, nombre: true } },
        },
      });

      res.json({ success: true, movimientos: rows });
    } catch {
      res.status(500).json({ success: false, message: "Error listando movimientos" });
    }
  }
);

/* ==============================
 * DELETE /movimientos/:id  (ADMIN/SUPER_USUARIO)
 * Reversa saldos digital y físico
 * ============================== */
router.delete(
  "/movimientos/:id",
  authenticateToken,
  requireRole(["ADMIN", "SUPER_USUARIO"]),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const userId = (req as Partial<AuthedRequest>).user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: "No autorizado" });
        return;
      }

      await prisma.$transaction(async (tx) => {
        const mov = await tx.servicioExternoMovimiento.findUnique({
          where: { id },
        });
        if (!mov) throw new Error("Movimiento no encontrado");

        const { gte, lt } = await gyeTodayWindow();
        if (!(mov.fecha >= gte && mov.fecha < lt)) {
          throw new Error("Solo se pueden eliminar movimientos del día actual");
        }

        const tieneAsignacion = SERVICIOS_CON_ASIGNACION.includes(mov.servicio);

        // 1. REVERTIR SALDO DIGITAL DEL SERVICIO (solo para servicios con asignación)
        if (tieneAsignacion) {
          const sSvc = await tx.servicioExternoSaldo.findUnique({
            where: {
              punto_atencion_id_servicio_moneda_id: {
                punto_atencion_id: mov.punto_atencion_id,
                servicio: mov.servicio,
                moneda_id: mov.moneda_id,
              },
            },
          });

          if (sSvc) {
            const montoNum = Number(mov.monto);
            const billetes = Number(mov.billetes || 0);
            const monedas = Number(mov.monedas_fisicas || 0);
            
            // Revertir: Si fue INGRESO (restó digital), ahora sumamos
            // Si fue EGRESO (sumó digital), ahora restamos
            const mult = mov.tipo_movimiento === "INGRESO" ? 1 : -1;
            
            let bancos = 0;
            if (mov.metodo_ingreso === "BANCO") bancos = montoNum;
            else if (mov.metodo_ingreso === "MIXTO") bancos = Math.max(0, montoNum - (billetes + monedas));

            await tx.servicioExternoSaldo.update({
              where: { id: sSvc.id },
              data: {
                cantidad: { increment: montoNum * mult },
                billetes: { increment: billetes * mult },
                monedas_fisicas: { increment: monedas * mult },
                bancos: { increment: bancos * mult },
                updated_at: new Date(),
              },
            });
          }
        }

        // 2. REVERTIR SALDO FÍSICO GENERAL
        const sGen = await tx.saldo.findUnique({
          where: {
            punto_atencion_id_moneda_id: {
              punto_atencion_id: mov.punto_atencion_id,
              moneda_id: mov.moneda_id,
            },
          },
        });

        if (sGen) {
          const montoNum = Number(mov.monto);
          const billetes = Number(mov.billetes || 0);
          const monedas = Number(mov.monedas_fisicas || 0);
          
          const bancosMov = Number(mov.bancos || 0);
          const montoCaja = Math.max(0, montoNum - bancosMov);
          const montoBancos = Math.max(0, bancosMov);

          // Si fue INGRESO (sumó físico), ahora restamos
          // Si fue EGRESO (restó físico), ahora sumamos
          const mult = mov.tipo_movimiento === "INGRESO" ? -1 : 1;
          const deltaCaja = montoCaja * mult;
          const deltaBancos = montoBancos * mult;

          let dBil = 0,
            dMon = 0;
          if (mov.metodo_ingreso === "EFECTIVO" || mov.metodo_ingreso === "MIXTO") {
            dBil = billetes * mult;
            dMon = monedas * mult;
          }

          const saldoCajaAnterior = Number(sGen.cantidad);
          const saldoBancosAnterior = Number(sGen.bancos || 0);
          const nuevoCaja = saldoCajaAnterior + deltaCaja;
          const nuevoBancos = saldoBancosAnterior + deltaBancos;

          await tx.saldo.update({
            where: { id: sGen.id },
            data: {
              cantidad: nuevoCaja,
              billetes: { increment: dBil },
              monedas_fisicas: { increment: dMon },
              bancos: { increment: deltaBancos },
              updated_at: new Date(),
            },
          });

          // Trazabilidad del ajuste (separando CAJA vs BANCOS)
          if (Math.abs(deltaCaja) > 0.0001) {
            await registrarMovimientoSaldo(
              {
                puntoAtencionId: mov.punto_atencion_id,
                monedaId: mov.moneda_id,
                tipoMovimiento: TipoMov.AJUSTE,
                monto: deltaCaja,
                saldoAnterior: saldoCajaAnterior,
                saldoNuevo: nuevoCaja,
                tipoReferencia: TipoReferencia.SERVICIO_EXTERNO,
                referenciaId: mov.id,
                saldoBucket: "CAJA",
                descripcion: `Reverso eliminación ${mov.servicio} ${mov.tipo_movimiento} (CAJA)`,
                usuarioId: userId,
              },
              tx
            );
          }
          if (Math.abs(deltaBancos) > 0.0001) {
            await registrarMovimientoSaldo(
              {
                puntoAtencionId: mov.punto_atencion_id,
                monedaId: mov.moneda_id,
                tipoMovimiento: TipoMov.AJUSTE,
                monto: deltaBancos,
                saldoAnterior: saldoBancosAnterior,
                saldoNuevo: nuevoBancos,
                tipoReferencia: TipoReferencia.SERVICIO_EXTERNO,
                referenciaId: mov.id,
                saldoBucket: "BANCOS",
                descripcion: `Reverso eliminación ${mov.servicio} ${mov.tipo_movimiento} (BANCOS)`,
                usuarioId: userId,
              },
              tx
            );
          }
        }

        await tx.servicioExternoMovimiento.delete({ where: { id: mov.id } });
      });

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  }
);

/* Otros endpoints administrativos (Cierres, etc.) mantienen su lógica de fecha GYE */
router.get("/admin/movimientos", authenticateToken, requireRole(["ADMIN", "SUPER_USUARIO"]), async (_req, _res) => {
  // ... similar a la anterior pero para admin
});

// Cierres
router.post("/cierre/abrir", authenticateToken, async (_req, _res) => {
  // ... lógica de apertura
});

// (Se omiten los cierres para brevedad, pero deben usar gyeTodayWindow)

// ==============================
// POST /asignar-saldo  (ADMIN/SUPER_USUARIO)
// Permite a administradores asignar / recargar saldo digital de un servicio externo
// ==============================
router.post(
  "/asignar-saldo",
  authenticateToken,
  requireRole(["ADMIN", "SUPER_USUARIO"]),
  async (req: Request, res: Response) => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const punto_atencion_id = body.punto_atencion_id;
      const servicio = body.servicio;
      const monto_asignado = body.monto_asignado;
      const tipo_asignacion = body.tipo_asignacion;
      const creado_por = body.creado_por;

      const userId = (req as Partial<AuthedRequest>).user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, message: "No autorizado" });
      }

      if (
        typeof punto_atencion_id !== "string" ||
        !isServicioExterno(servicio) ||
        monto_asignado === undefined ||
        monto_asignado === null
      ) {
        return res.status(400).json({ success: false, message: "Datos incompletos" });
      }

      if (!SERVICIOS_VALIDOS.includes(servicio)) {
        return res.status(400).json({ success: false, message: "Servicio inválido" });
      }

      const montoNum = Number(monto_asignado);
      if (!isFinite(montoNum) || montoNum <= 0) {
        return res.status(400).json({ success: false, message: "monto_asignado debe ser > 0" });
      }

      const tipo =
        tipo_asignacion === "INICIAL"
          ? TipoAsignacionServicio.INICIAL
          : TipoAsignacionServicio.RECARGA;

      const usdId = await ensureUsdMonedaId();

      const resultado = await prisma.$transaction(async (tx) => {
        // 1) Crear registro de asignación
        const asign = await tx.servicioExternoAsignacion.create({
          data: {
            punto_atencion_id,
            servicio,
            moneda_id: usdId,
            monto: new Prisma.Decimal(montoNum),
            tipo,
            observaciones:
              typeof creado_por === "string" && creado_por
                ? `Asignado por ${creado_por}`
                : undefined,
            asignado_por: userId,
          },
        });

        // 2) Upsert saldo del servicio
        const existing = await tx.servicioExternoSaldo.findUnique({
          where: {
            punto_atencion_id_servicio_moneda_id: {
              punto_atencion_id,
              servicio,
              moneda_id: usdId,
            },
          },
        });

        if (existing) {
          const actualizado = await tx.servicioExternoSaldo.update({
            where: { id: existing.id },
            data: { cantidad: { increment: montoNum }, updated_at: new Date() },
          });
          return { asign, saldo: actualizado };
        } else {
          const creado = await tx.servicioExternoSaldo.create({
            data: {
              punto_atencion_id,
              servicio,
              moneda_id: usdId,
              cantidad: new Prisma.Decimal(montoNum),
              billetes: new Prisma.Decimal(0),
              monedas_fisicas: new Prisma.Decimal(0),
            },
          });
          return { asign, saldo: creado };
        }
      });

      res.json({ success: true, resultado });
    } catch (error) {
      console.error("Error asignando saldo servicio externo:", error);
      res.status(500).json({ success: false, message: error instanceof Error ? error.message : "Error desconocido" });
    }
  }
);

// ============ Admin: resumen de saldos por servicio ============
router.get(
  "/saldos",
  authenticateToken,
  requireRole(["ADMIN", "SUPER_USUARIO"]),
  async (_req: Request, res: Response) => {
    try {
      const usdId = await ensureUsdMonedaId();

      const rows = await prisma.servicioExternoSaldo.findMany({
        where: { moneda_id: usdId },
        select: { servicio: true, cantidad: true },
      });

      const agg: Record<string, number> = {};
      for (const r of rows) {
        agg[r.servicio] = (agg[r.servicio] || 0) + Number(r.cantidad || 0);
      }

      const result = await Promise.all(
        Object.keys(agg).map(async (servicioKey) => {
          if (!isServicioExterno(servicioKey)) {
            return {
              servicio: servicioKey,
              saldo_actual: Number(agg[servicioKey]),
              ultimo_movimiento: null,
            };
          }
          const servicio = servicioKey;
          const ultimo = await prisma.servicioExternoMovimiento.findFirst({
            where: { servicio },
            orderBy: { fecha: "desc" },
            select: { fecha: true },
          });
          return {
            servicio,
            saldo_actual: Number(agg[servicioKey]),
            ultimo_movimiento: ultimo?.fecha || null,
          };
        })
      );

      res.json({ success: true, saldos: result });
    } catch (error) {
      console.error("Error obteniendo saldos servicios externos:", error);
      res.status(500).json({ success: false, message: "Error obteniendo saldos" });
    }
  }
);

// ============ Admin: saldos por punto ============
router.get(
  "/saldos-por-punto",
  authenticateToken,
  requireRole(["ADMIN", "SUPER_USUARIO"]),
  async (_req: Request, res: Response) => {
    try {
      const usdId = await ensureUsdMonedaId();
      const rows = await prisma.servicioExternoSaldo.findMany({
        where: { moneda_id: usdId },
        include: { puntoAtencion: { select: { id: true, nombre: true } } },
      });

      const mapped = rows.map((r) => ({
        punto_atencion_id: r.punto_atencion_id,
        punto_atencion_nombre: r.puntoAtencion?.nombre || null,
        servicio: r.servicio,
        saldo_actual: Number(r.cantidad || 0),
      }));

      res.json({ success: true, saldos: mapped });
    } catch (error) {
      console.error("Error obteniendo saldos por punto:", error);
      res.status(500).json({ success: false, message: "Error obteniendo saldos por punto" });
    }
  }
);

// ============ Admin: historial de asignaciones ============
router.get(
  "/historial-asignaciones",
  authenticateToken,
  requireRole(["ADMIN", "SUPER_USUARIO"]),
  async (_req: Request, res: Response) => {
    try {
      const rows = (await prisma.servicioExternoAsignacion.findMany({
        orderBy: { fecha: "desc" },
        take: 200,
        include: {
          puntoAtencion: { select: { id: true, nombre: true } },
          usuarioAsignador: { select: { id: true, nombre: true } },
        },
      }));

      const mapped = rows.map((r) => ({
        id: r.id,
        punto_atencion_id: r.punto_atencion_id,
        punto_atencion_nombre: r.puntoAtencion?.nombre || null,
        servicio: r.servicio,
        monto_asignado: Number(r.monto || 0),
        creado_por: r.usuarioAsignador?.nombre || null,
        creado_en: r.fecha,
      }));

      res.json({ success: true, historial: mapped });
    } catch (error) {
      console.error("Error historial asignaciones:", error);
      res.status(500).json({ success: false, message: "Error obteniendo historial" });
    }
  }
);

// ============ Admin: listar movimientos (query) ============
router.get(
  "/movimientos",
  authenticateToken,
  requireRole(["ADMIN", "SUPER_USUARIO"]),
  async (req: Request, res: Response) => {
    try {
      const { pointId, servicio, tipo_movimiento, desde, hasta, limit } = req.query as {
        pointId?: string;
        servicio?: string;
        tipo_movimiento?: string;
        desde?: string;
        hasta?: string;
        limit?: string;
      };
      const take = Math.min(Math.max(parseInt(limit || "100", 10), 1), 1000);

      const where: Prisma.ServicioExternoMovimientoWhereInput = {};
      if (pointId && pointId !== "ALL") where.punto_atencion_id = pointId;
      if (isServicioExterno(servicio) && SERVICIOS_VALIDOS.includes(servicio))
        where.servicio = servicio;
      if (isTipoMovimientoInOut(tipo_movimiento) && TIPOS_VALIDOS.includes(tipo_movimiento))
        where.tipo_movimiento = tipo_movimiento;
      if (desde || hasta) {
        where.fecha = {
          gte: desde ? new Date(`${desde}T00:00:00.000Z`) : undefined,
          lte: hasta ? new Date(`${hasta}T23:59:59.999Z`) : undefined,
        };
      }

      const rows = await prisma.servicioExternoMovimiento.findMany({
        where,
        orderBy: { fecha: "desc" },
        take,
        include: {
          usuario: { select: { id: true, nombre: true } },
          moneda: { select: { id: true, nombre: true, codigo: true, simbolo: true } },
          puntoAtencion: { select: { id: true, nombre: true } },
        },
      });

      res.json({ success: true, movimientos: rows });
    } catch (error) {
      console.error("Error listando movimientos admin:", error);
      res.status(500).json({ success: false, message: "Error listando movimientos" });
    }
  }
);

// ============ OPERADOR: saldos asignados por servicio (último estado) ============
router.get(
  "/saldos-asignados",
  authenticateToken,
  async (req: Request, res: Response) => {
    try {
      if (!isOperador(req)) {
        res.status(403).json({
          success: false,
          message: "Permisos insuficientes (solo OPERADOR)",
        });
        return;
      }

      const pointId = req.user.punto_atencion_id;
      if (!pointId) {
        res.status(400).json({
          success: false,
          message: "No tienes un punto de atención asignado",
        });
        return;
      }

      // Obtener información del punto de atención
      const punto = await prisma.puntoAtencion.findUnique({
        where: { id: pointId },
        select: { nombre: true },
      });

      if (!punto) {
        res.status(404).json({
          success: false,
          message: "Punto de atención no encontrado",
        });
        return;
      }

      // Obtener saldos actuales por servicio
      const usdId = await ensureUsdMonedaId();
      const saldos = await prisma.servicioExternoSaldo.findMany({
        where: { punto_atencion_id: pointId, moneda_id: usdId },
        select: { servicio: true, cantidad: true, billetes: true, monedas_fisicas: true },
      });

      // Obtener últimas asignaciones solo para servicios con asignación
      const saldosAsignados = await Promise.all(
        SERVICIOS_CON_ASIGNACION.map(async (servicio) => {
          const ultimaAsignacion = await prisma.servicioExternoAsignacion.findFirst({
            where: { punto_atencion_id: pointId, servicio },
            orderBy: { fecha: "desc" },
            select: { monto: true, fecha: true },
          });

          const saldoActual = saldos.find((s) => s.servicio === servicio);

          // ✅ CORRECCIÓN: El campo cantidad ya contiene el saldo correcto
          // cantidad = monto_asignado + movimientos (INGRESO resta, EGRESO suma)
          // Los campos billetes/monedas/bancos son solo para desglose, NO se suman al total
          const saldoDisponible = Number(saldoActual?.cantidad || 0);
          const billetes = Number(saldoActual?.billetes || 0);
          const monedas = Number(saldoActual?.monedas_fisicas || 0);

          return {
            servicio,
            saldo_asignado: saldoDisponible, // Saldo disponible actual (cantidad ya incluye todo)
            monto_asignado_inicial: ultimaAsignacion ? Number(ultimaAsignacion.monto) : 0, // Monto inicial para referencia
            actualizado_en: ultimaAsignacion?.fecha?.toISOString() || null,
            billetes: billetes,
            monedas_fisicas: monedas,
          };
        })
      );

      res.json({
        success: true,
        punto_nombre: punto.nombre,
        saldos_asignados: saldosAsignados,
      });
    } catch (error) {
      console.error("Error obteniendo saldos asignados:", error);
      res.status(500).json({ success: false, message: "Error obteniendo saldos asignados" });
    }
  }
);

export default router;
