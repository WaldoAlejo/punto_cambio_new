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
import { calculateMetalLines, metalLineSchema, validateMetalPayment, type MetalPurchaseInput } from "../utils/metalPurchase.js";
import { authorizeOrderSchema, cancelOrderSchema, createOrderSchema, deriveProcesses, unauthorizedProcesses, evaluateOrderSchema, gyeYear, lineFromJewel, OPEN_STATES, ORDER_STATES, orderPaymentSchema, returnOrderSchema, type OrderPayment, type OrderState } from "../utils/metalOrder.js";
import type { Evaluacion } from "../utils/metalEvaluation.js";
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
const include = { detalles: { orderBy: { codigo_pieza: "asc" as const } }, eventos: { orderBy: { fecha: "asc" as const } }, orden: { select: { id: true, numero: true } } };
const orderInclude = { joyas: { orderBy: { posicion: "asc" as const } }, moneda: { select: { id: true, codigo: true } }, compra: { select: { id: true, numero: true, estado: true } } };
type OrderWithJewels = Prisma.OrdenEvaluacionMetalGetPayload<{ include: typeof orderInclude }>;
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
/** Datos de compra construidos en el servidor desde la orden evaluada: el cliente solo envía el pago. */
function purchaseFromOrder(order: OrderWithJewels, payment: OrderPayment): MetalPurchaseInput {
  if (order.estado !== "EVALUADA" || order.compra || !order.moneda_id || !order.oferta_total) fail(409, "La orden debe estar evaluada, con oferta vigente y sin compra previa.");
  const detalles = order.joyas.map(j => {
    if (!j.metal || !j.metodo || !j.evaluacion || j.pureza === null || j.deducciones === null || j.precio_gramo === null) return fail(409, "La orden no tiene la evaluación completa de todas las joyas.");
    return lineFromJewel(j, { metal: j.metal as "ORO" | "PLATA", metodo: j.metodo as "ACIDO" | "XRF" | "OTRO", pureza: j.pureza.toString(), pureza_declarada: j.pureza_declarada, deducciones: j.deducciones.toString(), precio_gramo: j.precio_gramo.toString(), observaciones: j.observaciones, evaluacion: j.evaluacion as Evaluacion, foto_despues: j.foto_despues });
  });
  const { orden_id: _order, ...pay } = payment;
  return { ...pay, moneda_id: order.moneda_id as string, vendedor: order.cliente as MetalPurchaseInput["vendedor"], detalles, ...(order.seguridad ? { seguridad: order.seguridad as MetalPurchaseInput["seguridad"] } : {}) };
}
function orderScope(req: Request): Prisma.OrdenEvaluacionMetalWhereInput {
  if (userOf(req).rol === "OPERADOR") return { punto_atencion_id: userOf(req).punto_atencion_id || "SIN_PUNTO" };
  return {};
}
async function activeJornada(tx: Prisma.TransactionClient, userId: string, pointId: string) {
  const { gte, lt } = gyeDayRangeUtcFromDate(new Date());
  return tx.jornada.findFirst({ where: { usuario_id: userId, punto_atencion_id: pointId, estado: "ACTIVO", fecha_salida: null, fecha_inicio: { gte, lt } } });
}
/** Cambia una orden bajo bloqueo, solo desde los estados permitidos y por un operador de su mismo punto. */
async function mutateOrder(req: Request, allowed: OrderState[], fn: (tx: Prisma.TransactionClient, order: OrderWithJewels) => Promise<void>) {
  const id = z.string().uuid().parse(req.params.id), user = userOf(req);
  return prisma.$transaction(async tx => {
    await advisory(tx, `metal-order:${id}`);
    const order = await tx.ordenEvaluacionMetal.findUnique({ where: { id }, include: orderInclude });
    if (!order || order.punto_atencion_id !== user.punto_atencion_id) fail(404, "Orden no encontrada en su punto.");
    if (!allowed.includes(order.estado as OrderState)) fail(409, `La orden está ${order.estado.replace(/_/g, " ").toLowerCase()} y no admite esta acción.`);
    await fn(tx, order);
    return tx.ordenEvaluacionMetal.findUniqueOrThrow({ where: { id }, include: orderInclude });
  }, { timeout: 20000 });
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
  const payment = orderPaymentSchema.parse(req.body);
  const order = await prisma.ordenEvaluacionMetal.findFirst({ where: { id: payment.orden_id, ...orderScope(req) }, include: orderInclude });
  if (!order) fail(404, "Orden no encontrada.");
  const input = purchaseFromOrder(order, payment);
  const quote = calculation(input.detalles);
  try { validateMetalPayment(input, quote.total); } catch (e) { fail(400, (e as Error).message); }
  res.json({ success: true, ...quote, moneda_codigo: order.moneda?.codigo, orden: { id: order.id, numero: order.numero, cliente: order.cliente } });
}));
// ===== Órdenes de trabajo «Evaluación de oro» =====
// Flujo: PENDIENTE_AUTORIZACION (imprimir y firmar) → AUTORIZADA (foto firmada) → EVALUADA (pruebas y oferta)
// → COMPRADA (pago) | DEVUELTA (cliente no acepta). Una orden sin firmar puede ANULARSE.
router.post("/ordenes", requireRole(["OPERADOR"]), wrap(async (req, res) => {
  const key = z.string().uuid().parse(req.get("Idempotency-Key"));
  const input = createOrderSchema.parse(req.body);
  const hash = createHash("sha256").update(JSON.stringify(input)).digest("hex");
  const user = userOf(req);
  const result = await prisma.$transaction(async tx => {
    await advisory(tx, `metal-order-request:${user.id}:${key}`);
    const previous = await tx.ordenEvaluacionMetal.findUnique({ where: { usuario_id_clave_operacion: { usuario_id: user.id, clave_operacion: key } }, include: orderInclude });
    if (previous) { if (previous.solicitud_hash !== hash) fail(409, "Este intento ya se usó con otros datos. Consulte las órdenes."); return previous; }
    const pointId = user.punto_atencion_id || fail(403, "Seleccione un punto de atención.");
    const config = await tx.configuracionCompraMetal.findUnique({ where: { punto_atencion_id: pointId }, include: { punto: true } });
    if (!config?.habilitado || !config.punto.activo) fail(403, "La compra de metales no está habilitada en este punto.");
    if (!await activeJornada(tx, user.id, pointId)) fail(409, "Inicie su jornada (fuera de almuerzo) antes de recibir joyas.");
    // Consecutivo global por año, sin huecos por concurrencia.
    const year = gyeYear();
    await advisory(tx, `metal-order-seq:${year}`);
    const last = await tx.ordenEvaluacionMetal.aggregate({ where: { anio: year }, _max: { secuencia: true } });
    const seq = (last._max.secuencia ?? 0) + 1, numero = `OE-${year}-${String(seq).padStart(6, "0")}`;
    const order = await tx.ordenEvaluacionMetal.create({ data: {
      numero, anio: year, secuencia: seq, punto_atencion_id: pointId, usuario_id: user.id, clave_operacion: key, solicitud_hash: hash,
      punto_nombre: config.punto.nombre, asesor_nombre: user.nombre, cliente: input.cliente, observaciones_cliente: input.observaciones_cliente,
      procesos: { autorizados: input.procesos, otros: input.otros_procesos },
      joyas: { create: input.joyas.map((j, i) => ({ ...j, posicion: i + 1 })) },
    }, include: orderInclude });
    await tx.eventoCompraMetal.create({ data: { usuario_id: user.id, accion: "ORDEN_CREADA", evidencia: { orden_id: order.id, numero, joyas: input.joyas.length } } });
    return order;
  }, { timeout: 20000 });
  res.status(201).json({ success: true, orden: result });
}));
router.get("/ordenes", wrap(async (req, res) => {
  const date = z.string().date();
  const query = z.object({ estado: z.enum(["ABIERTAS", ...ORDER_STATES]).optional(), desde: date.optional(), hasta: date.optional(), buscar: z.string().trim().max(100).optional(),
    punto_id: z.string().uuid().optional(), pagina: z.coerce.number().int().min(1).max(100000).default(1) }).parse(req.query);
  if (query.desde && query.hasta && query.desde > query.hasta) fail(400, "El rango de fechas está invertido.");
  const where: Prisma.OrdenEvaluacionMetalWhereInput = { ...orderScope(req), ...(query.punto_id && userOf(req).rol !== "OPERADOR" ? { punto_atencion_id: query.punto_id } : {}) };
  if (query.estado) where.estado = query.estado === "ABIERTAS" ? { in: OPEN_STATES } : query.estado;
  if (query.buscar) where.OR = [{ numero: { contains: query.buscar, mode: "insensitive" } }, { cliente: { path: ["nombre"], string_contains: query.buscar } }, { cliente: { path: ["documento"], string_contains: query.buscar } }];
  if (query.desde || query.hasta) where.fecha = { ...(query.desde ? { gte: gyeDayRangeUtcFromDateOnly(query.desde).gte } : {}), ...(query.hasta ? { lt: gyeDayRangeUtcFromDateOnly(query.hasta).lt } : {}) };
  const [ordenes, cantidad] = await prisma.$transaction([
    prisma.ordenEvaluacionMetal.findMany({ where, select: { id: true, numero: true, fecha: true, estado: true, punto_nombre: true, asesor_nombre: true, cliente: true, oferta_total: true, moneda: { select: { codigo: true } }, _count: { select: { joyas: true } } }, orderBy: [{ fecha: "desc" }, { id: "desc" }], skip: (query.pagina - 1) * 25, take: 25 }),
    prisma.ordenEvaluacionMetal.count({ where }),
  ]);
  res.json({ success: true, ordenes, cantidad, pagina: query.pagina });
}));
router.get("/ordenes/:id", wrap(async (req, res) => {
  const orden = await prisma.ordenEvaluacionMetal.findFirst({ where: { id: z.string().uuid().parse(req.params.id), ...orderScope(req) }, include: orderInclude });
  if (!orden) fail(404, "Orden no encontrada.");
  res.json({ success: true, orden });
}));
router.post("/ordenes/:id/autorizar", requireRole(["OPERADOR"]), wrap(async (req, res) => {
  const input = authorizeOrderSchema.parse(req.body);
  const orden = await mutateOrder(req, ["PENDIENTE_AUTORIZACION"], async (tx, order) => {
    await tx.ordenEvaluacionMetal.update({ where: { id: order.id }, data: { estado: "AUTORIZADA", autorizacion_foto: input.foto_autorizacion, autorizada_en: new Date() } });
    await tx.eventoCompraMetal.create({ data: { usuario_id: userOf(req).id, accion: "ORDEN_AUTORIZADA", evidencia: { orden_id: order.id, numero: order.numero } } });
  });
  res.json({ success: true, orden });
}));
router.post("/ordenes/:id/evaluar", requireRole(["OPERADOR"]), wrap(async (req, res) => {
  const input = evaluateOrderSchema.parse(req.body);
  const orden = await mutateOrder(req, ["AUTORIZADA", "EVALUADA"], async (tx, order) => {
    const byId = new Map(input.joyas.map(j => [j.id, j]));
    if (byId.size !== input.joyas.length || order.joyas.length !== input.joyas.length || order.joyas.some(j => !byId.has(j.id))) fail(400, "Evalúe exactamente las joyas recibidas en la orden.");
    if (input.joyas.some(j => j.metodo === "ACIDO") && !(input.seguridad?.acido_vigente && input.seguridad.guantes)) fail(400, "Confirme que el ácido no está vencido y que usó guantes durante la prueba.");
    const currency = await tx.moneda.findUnique({ where: { id: input.moneda_id } });
    if (!currency?.activo) fail(400, "Moneda de la oferta inactiva o inexistente.");
    const authorized = (order.procesos as { autorizados?: string[]; otros?: string } | null) ?? {};
    const done = deriveProcesses(input.joyas, input.otros_procesos);
    const missing = unauthorizedProcesses(done.realizados, authorized.autorizados ?? []);
    if (missing.length) fail(400, `El cliente no autorizó: ${missing.join(", ")}. Solo pueden hacerse las pruebas marcadas en la orden firmada; si necesita otra, devuelva las joyas y abra una nueva orden.`);
    const quote = calculation(order.joyas.map(j => lineFromJewel(j, byId.get(j.id) as (typeof input.joyas)[number])));
    for (const [i, stored] of order.joyas.entries()) {
      const e = byId.get(stored.id) as (typeof input.joyas)[number], line = quote.detalles[i];
      await tx.joyaOrdenEvaluacion.update({ where: { id: stored.id }, data: {
        metal: e.metal, metodo: e.metodo, evaluacion: line.evaluacion, pureza_declarada: e.pureza_declarada, pureza: e.pureza, deducciones: e.deducciones,
        peso_final: line.peso_neto, precio_gramo: e.precio_gramo, subtotal: line.subtotal, observaciones: e.observaciones, foto_despues: e.foto_despues ?? null,
      } });
    }
    await tx.ordenEvaluacionMetal.update({ where: { id: order.id }, data: {
      estado: "EVALUADA", moneda_id: input.moneda_id, oferta_total: quote.total, seguridad: input.seguridad ?? Prisma.DbNull,
      procesos: { autorizados: authorized.autorizados ?? [], otros: authorized.otros ?? "", ...done }, resultado_observaciones: input.resultado_observaciones, evaluada_en: new Date(),
    } });
    await tx.eventoCompraMetal.create({ data: { usuario_id: userOf(req).id, accion: "ORDEN_EVALUADA", evidencia: { orden_id: order.id, numero: order.numero, oferta: quote.total, moneda: currency.codigo } } });
  });
  res.json({ success: true, orden });
}));
router.post("/ordenes/:id/devolver", requireRole(["OPERADOR"]), wrap(async (req, res) => {
  const input = returnOrderSchema.parse(req.body);
  const orden = await mutateOrder(req, ["AUTORIZADA", "EVALUADA"], async (tx, order) => {
    await tx.ordenEvaluacionMetal.update({ where: { id: order.id }, data: { estado: "DEVUELTA", cerrada_en: new Date(), cierre: { accion: "DEVOLUCION", motivo: input.motivo, joyas_devueltas: true, foto: input.foto ?? null, usuario_id: userOf(req).id } } });
    await tx.eventoCompraMetal.create({ data: { usuario_id: userOf(req).id, accion: "ORDEN_DEVUELTA", evidencia: { orden_id: order.id, numero: order.numero, motivo: input.motivo } } });
  });
  res.json({ success: true, orden });
}));
router.post("/ordenes/:id/anular", requireRole(["OPERADOR"]), wrap(async (req, res) => {
  const input = cancelOrderSchema.parse(req.body);
  const orden = await mutateOrder(req, ["PENDIENTE_AUTORIZACION"], async (tx, order) => {
    await tx.ordenEvaluacionMetal.update({ where: { id: order.id }, data: { estado: "ANULADA", cerrada_en: new Date(), cierre: { accion: "ANULACION", motivo: input.motivo, usuario_id: userOf(req).id } } });
    await tx.eventoCompraMetal.create({ data: { usuario_id: userOf(req).id, accion: "ORDEN_ANULADA", evidencia: { orden_id: order.id, numero: order.numero, motivo: input.motivo } } });
  });
  res.json({ success: true, orden });
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
  const payment = orderPaymentSchema.parse(req.body);
  const hash = createHash("sha256").update(JSON.stringify(payment)).digest("hex");
  const user = userOf(req);
  const result = await prisma.$transaction(async tx => {
    await advisory(tx, `metal-request:${user.id}:${key}`);
    const previous = await tx.compraMetal.findUnique({ where: { usuario_id_clave_operacion: { usuario_id: user.id, clave_operacion: key } }, include });
    if (previous) { if (previous.solicitud_hash !== hash) fail(409, "Este intento ya se usó con otros datos. Consulte el historial."); return previous; }
    const pointId = user.punto_atencion_id || fail(403, "Seleccione un punto de atención.");
    await advisory(tx, `metals-point:${pointId}`);
    const config = await tx.configuracionCompraMetal.findUnique({ where: { punto_atencion_id: pointId }, include: { punto: true } });
    if (!config?.habilitado || !config.punto.activo) fail(403, "La compra de metales no está habilitada en este punto.");
    // La compra solo existe como cierre de una orden evaluada de este punto (autorización firmada y oferta).
    await advisory(tx, `metal-order:${payment.orden_id}`);
    const order = await tx.ordenEvaluacionMetal.findUnique({ where: { id: payment.orden_id }, include: orderInclude });
    if (!order || order.punto_atencion_id !== pointId) fail(404, "Orden no encontrada en este punto.");
    const input = purchaseFromOrder(order, payment);
    const quote = calculation(input.detalles);
    try { validateMetalPayment(input, quote.total); } catch (e) { fail(400, (e as Error).message); }
    if (!new Prisma.Decimal(quote.total).eq(order.oferta_total as Prisma.Decimal)) fail(409, "La oferta de la orden cambió. Revise la orden antes de pagar.");
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
      id, numero: number, punto_atencion_id: pointId, usuario_id: user.id, jornada_id: jornada.id, orden_id: order.id,
      moneda_id: input.moneda_id, clave_operacion: key, solicitud_hash: hash, vendedor: input.vendedor,
      punto_nombre: config.punto.nombre, operador_nombre: user.nombre, moneda_codigo: currency.codigo,
      medio_pago: input.medio_pago, total, billetes: bills, monedas: coins, banco: input.banco, referencia: input.referencia, comprobante: input.comprobante,
      detalles: { create: quote.detalles.map(({ resultado_concluyente: _result, ...line }, i) => ({ ...line, evaluacion: { ...line.evaluacion, seguridad: input.seguridad ?? null }, codigo_pieza: `${number}-${i + 1}` })) },
      eventos: { create: { usuario_id: user.id, accion: "COMPRA_PAGADA", evidencia: { saldo_anterior: before.toFixed(2), saldo_nuevo: after.toFixed(2), medio_pago: input.medio_pago } } },
    }, include });
    if (balance) await tx.saldo.update({ where: { id: balance.id }, data: cash ? { cantidad: after, billetes: balance.billetes.minus(bills), monedas_fisicas: balance.monedas_fisicas.minus(coins) } : { bancos: after } });
    else await tx.saldo.create({ data: { punto_atencion_id: pointId, moneda_id: input.moneda_id, cantidad: 0, billetes: 0, monedas_fisicas: 0, bancos: after } });
    await tx.movimientoSaldo.create({ data: { punto_atencion_id: pointId, moneda_id: input.moneda_id, usuario_id: user.id, tipo_movimiento: "EGRESO", tipo_referencia: "COMPRA_METAL", referencia_id: id, monto: total.negated(), saldo_anterior: before, saldo_nuevo: after, descripcion: `Compra de metales ${number} ${cash ? "(CAJA)" : "(BANCOS) - NO afecta cuadre físico"}` } });
    // Receipt persistence participates in the same transaction. Never repeat a payment to reprint.
    await tx.recibo.create({ data: { numero_recibo: number, tipo_operacion: "MOVIMIENTO", referencia_id: id, usuario_id: user.id, punto_atencion_id: pointId, datos_operacion: { modulo: "COMPRA_METAL", numero: number, orden: order.numero, total: quote.total, medio_pago: input.medio_pago } } });
    await tx.ordenEvaluacionMetal.update({ where: { id: order.id }, data: { estado: "COMPRADA", cerrada_en: new Date(), cierre: { accion: "COMPRA", compra_id: id, usuario_id: user.id } } });
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
