import express, { type Request, type Response } from "express";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import prisma, { Prisma } from "../lib/prisma.js";
import { authenticateToken, requireRole } from "../middleware/auth.js";
import { lockTransferBalance } from "../utils/transferBalance.js";
import { assertOperationalSession, OperationalConflict } from "../utils/operationalConflict.js";
import { assertCurrencyCounted, isPendingCurrencyError } from "../utils/stagedOpening.js";
import { getEstadoMonedasObligatorias, tieneIncidenciaAperturaRegistrada } from "../utils/aperturaCajaRequirements.js";
import { gyeDayRangeUtcFromDate, gyeDayRangeUtcFromDateOnly } from "../utils/timezone.js";
import { calculateMetalLines, metalLineSchema, metalPurchaseSchema, validateMetalPayment } from "../utils/metalPurchase.js";
import logger from "../utils/logger.js";

const router = express.Router();
const admins = ["ADMIN", "SUPER_USUARIO"];
const readers = [...admins, "ADMINISTRATIVO", "OPERADOR"];
router.use(authenticateToken, requireRole(readers));
router.use((_req, res, next) => { res.setHeader("Cache-Control", "no-store"); next(); });
class MetalError extends Error { constructor(public status: number, message: string) { super(message); } }
function fail(status: number, message: string): never { throw new MetalError(status, message); }
function userOf(req: Request) { return req.user || fail(401, "Usuario no autenticado."); }
const wrap = (fn: (req: Request, res: Response) => Promise<unknown>): express.RequestHandler => async (req, res) => {
  try { await fn(req, res); } catch (e) {
    if (e instanceof z.ZodError) { res.status(400).json({ success: false, error: e.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; ") }); return; }
    const status = e instanceof MetalError ? e.status : e instanceof OperationalConflict || isPendingCurrencyError(e) ? 409 : 500;
    if (status === 500) logger.error("Compra de metales: operación fallida", { code: e instanceof Prisma.PrismaClientKnownRequestError ? e.code : "INTERNAL", usuario_id: req.user?.id });
    res.status(status).json({ success: false, error: status === 500 ? "No se pudo completar la operación. Consulte el historial antes de reintentar." : (e as Error).message });
  }
};
const include = { detalles: { orderBy: { codigo_pieza: "asc" as const } }, eventos: { orderBy: { fecha: "asc" as const } } };
function scope(req: Request): Prisma.CompraMetalWhereInput {
  if (userOf(req).rol === "OPERADOR") return { punto_atencion_id: userOf(req).punto_atencion_id || "SIN_PUNTO" };
  return {};
}
async function advisory(tx: Prisma.TransactionClient, key: string) {
  await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
}
async function opening(tx: Prisma.TransactionClient, jornadaId: string) {
  await tx.$queryRaw`SELECT id FROM "Jornada" WHERE id = ${jornadaId} FOR SHARE`;
  const { gte, lt } = gyeDayRangeUtcFromDate(new Date());
  const jornada = await tx.jornada.findFirst({ where: { id: jornadaId, estado: "ACTIVO", fecha_salida: null, fecha_inicio: { gte, lt } } });
  if (!jornada) fail(409, "Debe existir una jornada activa de hoy, fuera de almuerzo.");
  const apertura = await tx.aperturaCaja.findUnique({ where: { jornada_id: jornadaId } });
  const required = getEstadoMonedasObligatorias(apertura);
  if (!apertura || apertura.estado !== "ABIERTA" || required.pendientes_guardado.length || (required.descuadradas.length && !tieneIncidenciaAperturaRegistrada(apertura))) fail(409, "Complete y confirme la apertura de caja antes de operar.");
  return jornada;
}
function calculation(lines: z.infer<typeof metalLineSchema>[]) {
  try { return calculateMetalLines(lines); } catch (e) { return fail(400, (e as Error).message); }
}

router.get("/contexto", wrap(async (req, res) => {
  const pointId = userOf(req).punto_atencion_id;
  const [config, monedas] = await Promise.all([
    pointId ? prisma.configuracionCompraMetal.findUnique({ where: { punto_atencion_id: pointId } }) : null,
    prisma.moneda.findMany({ where: { activo: true }, select: { id: true, codigo: true }, orderBy: { orden_display: "asc" } }),
  ]);
  res.json({ success: true, habilitado: config?.habilitado === true, punto_id: pointId, monedas });
}));
router.get("/configuracion", requireRole(admins), wrap(async (_req, res) => {
  const puntos = await prisma.puntoAtencion.findMany({ select: { id: true, nombre: true, activo: true, configuracionMetales: true }, orderBy: { nombre: "asc" } });
  res.json({ success: true, puntos });
}));
router.put("/configuracion/:id", requireRole(admins), wrap(async (req, res) => {
  const id = z.string().uuid().parse(req.params.id);
  const body = z.object({ habilitado: z.boolean(), motivo: z.string().trim().min(5).max(500) }).strict().parse(req.body);
  await prisma.$transaction(async tx => {
    await advisory(tx, `metals-point:${id}`);
    const point = await tx.puntoAtencion.findUnique({ where: { id } });
    if (!point || (body.habilitado && !point.activo)) fail(400, "Punto inexistente o inactivo.");
    await tx.configuracionCompraMetal.upsert({ where: { punto_atencion_id: id }, create: { punto_atencion_id: id, habilitado: body.habilitado, actualizado_por: userOf(req).id }, update: { habilitado: body.habilitado, actualizado_por: userOf(req).id } });
    await tx.eventoCompraMetal.create({ data: { usuario_id: userOf(req).id, accion: "CONFIGURACION", evidencia: { punto_id: id, ...body } } });
  });
  res.json({ success: true });
}));
router.post("/cotizar", wrap(async (req, res) => {
  const lines = z.array(metalLineSchema).min(1).max(20).parse(req.body.detalles);
  res.json({ success: true, ...calculation(lines) });
}));
router.post("/preparar", wrap(async (req, res) => {
  const input = metalPurchaseSchema.parse(req.body);
  const quote = calculation(input.detalles);
  try { validateMetalPayment(input, quote.total); } catch (e) { fail(400, (e as Error).message); }
  res.json({ success: true, ...quote });
}));
router.get("/", wrap(async (req, res) => {
  const date = z.string().date();
  const query = z.object({ desde: date.optional(), hasta: date.optional(), operador: z.string().trim().max(200).optional(),
    punto_id: z.string().uuid().optional(), pagina: z.coerce.number().int().min(1).max(100000).default(1) }).parse(req.query);
  if (query.desde && query.hasta && query.desde > query.hasta) fail(400, "El rango de fechas está invertido.");
  const where: Prisma.CompraMetalWhereInput = { ...scope(req), ...(query.punto_id && userOf(req).rol !== "OPERADOR" ? { punto_atencion_id: query.punto_id } : {}) };
  if (query.operador) where.operador_nombre = { contains: query.operador, mode: "insensitive" };
  if (query.desde || query.hasta) where.fecha = { ...(query.desde ? { gte: gyeDayRangeUtcFromDateOnly(query.desde).gte } : {}), ...(query.hasta ? { lt: gyeDayRangeUtcFromDateOnly(query.hasta).lt } : {}) };
  const [compras, cantidad, totales, metales] = await prisma.$transaction([
    prisma.compraMetal.findMany({ where, select: { id: true, numero: true, fecha: true, punto_nombre: true, operador_nombre: true, moneda_codigo: true, total: true, medio_pago: true, estado: true }, orderBy: [{ fecha: "desc" }, { id: "desc" }], skip: (query.pagina - 1) * 25, take: 25 }),
    prisma.compraMetal.count({ where }),
    prisma.compraMetal.groupBy({ by: ["moneda_codigo", "medio_pago", "estado"], orderBy: { moneda_codigo: "asc" }, where, _sum: { total: true }, _count: true }),
    prisma.detalleCompraMetal.groupBy({ by: ["metal", "pureza"], orderBy: { metal: "asc" }, where: { compra: { ...where, estado: "PAGADA" } }, _sum: { peso_neto: true, gramos_finos: true, piezas: true } }),
  ]);
  res.json({ success: true, compras, cantidad, pagina: query.pagina, totales, metales });
}));
router.get("/:id", wrap(async (req, res) => {
  const compra = await prisma.compraMetal.findFirst({ where: { id: req.params.id, ...scope(req) }, include });
  if (!compra) fail(404, "Compra no encontrada.");
  res.json({ success: true, compra });
}));
router.get("/intento/:key", requireRole(["OPERADOR"]), wrap(async (req, res) => {
  const key = z.string().uuid().parse(req.params.key);
  const compra = await prisma.$transaction(async tx => {
    await advisory(tx, `metal-request:${userOf(req).id}:${key}`);
    return tx.compraMetal.findUnique({ where: { usuario_id_clave_operacion: { usuario_id: userOf(req).id, clave_operacion: key } }, include });
  }, { timeout: 20000 });
  res.json({ success: true, compra });
}));
router.post("/", requireRole(["OPERADOR"]), wrap(async (req, res) => {
  const key = z.string().uuid().parse(req.get("Idempotency-Key"));
  const input = metalPurchaseSchema.parse(req.body);
  const quote = calculation(input.detalles);
  try { validateMetalPayment(input, quote.total); } catch (e) { fail(400, (e as Error).message); }
  const hash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
  const user = userOf(req);
  const result = await prisma.$transaction(async tx => {
    await advisory(tx, `metal-request:${user.id}:${key}`);
    const previous = await tx.compraMetal.findUnique({ where: { usuario_id_clave_operacion: { usuario_id: user.id, clave_operacion: key } }, include });
    if (previous) { if (previous.solicitud_hash !== hash) fail(409, "Este intento ya se usó con otros datos. Consulte el historial."); return previous; }
    const pointId = user.punto_atencion_id || fail(403, "Seleccione un punto de atención.");
    await advisory(tx, `metals-point:${pointId}`);
    const config = await tx.configuracionCompraMetal.findUnique({ where: { punto_atencion_id: pointId }, include: { punto: true } });
    if (!config?.habilitado || !config.punto.activo) fail(403, "La compra de metales no está habilitada en este punto.");
    const currency = await tx.moneda.findUnique({ where: { id: input.moneda_id } });
    if (!currency?.activo) fail(400, "Moneda de pago inactiva o inexistente.");
    await lockTransferBalance(tx, pointId, input.moneda_id);
    await assertOperationalSession(tx, user, pointId);
    const jornada = await tx.jornada.findFirst({ where: { usuario_id: user.id, punto_atencion_id: pointId, estado: "ACTIVO", fecha_salida: null }, orderBy: { fecha_inicio: "desc" } });
    if (!jornada) fail(409, "Inicie jornada y complete la apertura.");
    await opening(tx, jornada.id);
    const cash = input.medio_pago === "EFECTIVO";
    if (cash) await assertCurrencyCounted(tx, pointId, input.moneda_id);
    const balance = await tx.saldo.findUnique({ where: { punto_atencion_id_moneda_id: { punto_atencion_id: pointId, moneda_id: input.moneda_id } } });
    const total = new Prisma.Decimal(quote.total);
    const bills = new Prisma.Decimal(input.billetes || 0), coins = new Prisma.Decimal(input.monedas || 0);
    if (cash && (!balance || balance.cantidad.lt(total) || balance.billetes.lt(bills) || balance.monedas_fisicas.lt(coins))) fail(409, "Efectivo insuficiente para el importe o el desglose solicitado.");
    if (cash && balance && !balance.billetes.plus(balance.monedas_fisicas).eq(balance.cantidad)) fail(409, "El saldo físico y su desglose no coinciden. Revise caja antes de comprar.");
    const before = new Prisma.Decimal(cash ? (balance?.cantidad ?? fail(409, "No hay saldo de caja.")) : balance?.bancos || 0);
    const after = before.minus(total);
    if (after.abs().gte("10000000000000")) fail(409, "El saldo excedería la precisión monetaria admitida.");
    const id = randomUUID(), number = `MET-${id.toUpperCase()}`;
    const compra = await tx.compraMetal.create({ data: {
      id, numero: number, punto_atencion_id: pointId, usuario_id: user.id, jornada_id: jornada.id,
      moneda_id: input.moneda_id, clave_operacion: key, solicitud_hash: hash, vendedor: input.vendedor,
      punto_nombre: config.punto.nombre, operador_nombre: user.nombre, moneda_codigo: currency.codigo,
      medio_pago: input.medio_pago, total, billetes: bills, monedas: coins, banco: input.banco, referencia: input.referencia, comprobante: input.comprobante,
      detalles: { create: quote.detalles.map(({ resultado_concluyente: _result, ...line }, i) => ({ ...line, codigo_pieza: `${number}-${i + 1}` })) },
      eventos: { create: { usuario_id: user.id, accion: "COMPRA_PAGADA", evidencia: { saldo_anterior: before.toFixed(2), saldo_nuevo: after.toFixed(2), medio_pago: input.medio_pago } } },
    }, include });
    if (balance) await tx.saldo.update({ where: { id: balance.id }, data: cash ? { cantidad: after, billetes: balance.billetes.minus(bills), monedas_fisicas: balance.monedas_fisicas.minus(coins) } : { bancos: after } });
    else await tx.saldo.create({ data: { punto_atencion_id: pointId, moneda_id: input.moneda_id, cantidad: 0, billetes: 0, monedas_fisicas: 0, bancos: after } });
    await tx.movimientoSaldo.create({ data: { punto_atencion_id: pointId, moneda_id: input.moneda_id, usuario_id: user.id, tipo_movimiento: "EGRESO", tipo_referencia: "COMPRA_METAL", referencia_id: id, monto: total.negated(), saldo_anterior: before, saldo_nuevo: after, descripcion: `Compra de metales ${number} ${cash ? "(CAJA)" : "(BANCOS) - NO afecta cuadre físico"}` } });
    // Receipt persistence participates in the same transaction. Never repeat a payment to reprint.
    await tx.recibo.create({ data: { numero_recibo: number, tipo_operacion: "MOVIMIENTO", referencia_id: id, usuario_id: user.id, punto_atencion_id: pointId, datos_operacion: { modulo: "COMPRA_METAL", numero: number, total: quote.total, medio_pago: input.medio_pago } } });
    return compra;
  }, { timeout: 20000 });
  res.status(201).json({ success: true, compra: result });
}));
router.post("/:id/reversar", requireRole(admins), wrap(async (req, res) => {
  const evidence = z.object({ motivo: z.string().trim().min(10).max(1000), piezas_devueltas: z.literal(true),
    evidencia_devolucion: z.string().trim().min(10).max(1000), evidencia_dinero: z.string().trim().min(10).max(1000),
    billetes: z.string().regex(/^\d{1,13}(\.\d{1,2})?$/).optional(), monedas: z.string().regex(/^\d{1,13}(\.\d{1,2})?$/).optional(),
  }).strict().parse(req.body);
  const result = await prisma.$transaction(async tx => {
    await advisory(tx, `metal-reversal:${req.params.id}`);
    const purchase = await tx.compraMetal.findUnique({ where: { id: req.params.id }, include });
    if (!purchase) fail(404, "Compra no encontrada.");
    if (purchase.estado === "REVERSADA") return purchase;
    await lockTransferBalance(tx, purchase.punto_atencion_id, purchase.moneda_id);
    // v1 limits reversals to the original open session, never silently rewrites a closed day.
    await opening(tx, purchase.jornada_id);
    const cash = purchase.medio_pago === "EFECTIVO";
    const bills = new Prisma.Decimal(evidence.billetes || 0), coins = new Prisma.Decimal(evidence.monedas || 0);
    if (cash && !bills.plus(coins).eq(purchase.total)) fail(400, "El efectivo recuperado debe sumar el total.");
    if (!cash && (evidence.billetes !== undefined || evidence.monedas !== undefined)) fail(400, "Un reverso bancario no acredita efectivo.");
    if (cash) await assertCurrencyCounted(tx, purchase.punto_atencion_id, purchase.moneda_id);
    const balance = await tx.saldo.findUniqueOrThrow({ where: { punto_atencion_id_moneda_id: { punto_atencion_id: purchase.punto_atencion_id, moneda_id: purchase.moneda_id } } });
    if (cash && !balance.billetes.plus(balance.monedas_fisicas).eq(balance.cantidad)) fail(409, "El desglose de caja no coincide con su saldo.");
    const before = cash ? balance.cantidad : balance.bancos, after = before.plus(purchase.total);
    if (after.abs().gte("10000000000000")) fail(409, "El saldo excedería la precisión monetaria admitida.");
    await tx.saldo.update({ where: { id: balance.id }, data: cash ? { cantidad: after, billetes: balance.billetes.plus(bills), monedas_fisicas: balance.monedas_fisicas.plus(coins) } : { bancos: after } });
    await tx.movimientoSaldo.create({ data: { punto_atencion_id: purchase.punto_atencion_id, moneda_id: purchase.moneda_id, usuario_id: userOf(req).id, tipo_movimiento: "INGRESO", tipo_referencia: "COMPRA_METAL_REVERSO", referencia_id: purchase.id, monto: purchase.total, saldo_anterior: before, saldo_nuevo: after, descripcion: `Reverso compra de metales ${purchase.numero} ${cash ? "(CAJA)" : "(BANCOS) - NO afecta cuadre físico"}` } });
    return tx.compraMetal.update({ where: { id: purchase.id }, data: { estado: "REVERSADA", eventos: { create: { usuario_id: userOf(req).id, accion: "REVERSO", evidencia: evidence } } }, include });
  }, { timeout: 20000 });
  res.json({ success: true, compra: result });
}));
export default router;
