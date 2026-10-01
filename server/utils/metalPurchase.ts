import { z } from "zod";
import { Prisma } from "../lib/prisma.js";
import { evaluateMetalLine, INTENSITIES, MATERIALS, REACTIONS, type Reaccion } from "./metalEvaluation.js";
const Decimal = Prisma.Decimal.clone({ precision: 40, rounding: Prisma.Decimal.ROUND_HALF_UP });

const decimal = (scale: number) => z.string().regex(new RegExp(`^(0|[1-9][0-9]{0,9})(\\.[0-9]{1,${scale}})?$`), `Número decimal positivo con hasta ${scale} decimales`);
const text = (max: number) => z.string().trim().min(1).max(max);
// Small raster attachments are stored with the private purchase, never public URLs.
const photo = z.string().max(280000).regex(/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/).optional();
const codes = <T extends readonly { codigo: string }[]>(list: T) => z.enum(list.map(i => i.codigo) as [T[number]["codigo"], ...T[number]["codigo"][]]);
// Lista de verificación de la capacitación de reconocimiento de oro; ver metalEvaluation.ts.
export const evaluationSchema = z.object({
  tipo_color: z.enum(["AMARILLO", "ROJO", "BLANCO", "PLATA"]), sello: z.string().max(20),
  sello_con_lupa: z.boolean(), uniones_revisadas: z.boolean(), color_uniforme: z.boolean(),
  iman: z.enum(["NO_ATRAE", "ATRAE"]), piedra: z.enum(["MARCA_UNIFORME", "OTRO_METAL", "NO_REALIZADA"]),
  lima: z.enum(["NO_NECESARIA", "MISMO_METAL", "OTRO_METAL"]), acido_usado: z.enum(["10K", "14K", "18K", "NO_APLICA"]),
  reaccion: z.enum(Object.keys(REACTIONS) as [Reaccion, ...Reaccion[]]), intensidad: codes(INTENSITIES), material: codes(MATERIALS),
  densidad: z.object({ peso_aire: decimal(3), peso_agua: decimal(3) }).strict().optional(),
  justificacion: z.string().trim().max(500).optional(),
}).strict();
export const metalLineSchema = z.object({
  metal: z.enum(["ORO", "PLATA"]), descripcion: text(300), piezas: z.number().int().min(1).max(1000),
  peso_bruto: decimal(3), deducciones: decimal(3), pureza_declarada: z.string().trim().max(80),
  pureza: decimal(3), metodo: z.enum(["ACIDO", "XRF", "OTRO"]), observaciones: z.string().trim().max(500).default(""),
  resultado_concluyente: z.literal(true), precio_gramo: decimal(6), foto: photo, evaluacion: evaluationSchema,
}).strict();
export const metalPurchaseSchema = z.object({
  seguridad: z.object({ acido_vigente: z.boolean(), guantes: z.boolean() }).strict().optional(),
  moneda_id: z.string().uuid(), vendedor: z.object({ nombre: text(200), documento: text(40),
    telefono: text(40), procedencia: text(1000) }).strict(),
  detalles: z.array(metalLineSchema).min(1).max(20),
  medio_pago: z.enum(["EFECTIVO", "TRANSFERENCIA"]), billetes: decimal(2).optional(), monedas: decimal(2).optional(),
  banco: text(120).optional(), referencia: text(150).optional(), comprobante: photo,
}).strict();
export type MetalPurchaseInput = z.infer<typeof metalPurchaseSchema>;
export function calculateMetalLines(lines: z.infer<typeof metalLineSchema>[]) {
  const details = lines.map(line => {
    const net = new Decimal(line.peso_bruto).minus(line.deducciones);
    const purity = new Decimal(line.pureza);
    const price = new Decimal(line.precio_gramo);
    if (!net.gt(0) || !purity.gt(0) || purity.gt(1000) || !price.gt(0)) throw new Error("Peso neto, pureza y precio deben ser positivos; la pureza no puede superar 1000 milésimas.");
    const verdict = evaluateMetalLine(line.metal, line.metodo, purity.toNumber(), line.evaluacion);
    if (verdict.estado !== "APTA") throw new Error(`${line.descripcion}: ${verdict.motivos.join(" ")}`);
    const subtotal = net.mul(price).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
    if (!subtotal.gt(0) || subtotal.gte("10000000000000")) throw new Error("Importe fuera de la precisión monetaria admitida.");
    return { ...line, evaluacion: { ...line.evaluacion, resultado: verdict.estado, pureza_maxima: verdict.pureza_maxima ?? null, avisos: verdict.avisos }, peso_neto: net.toFixed(3), gramos_finos: net.mul(purity).div(1000).toFixed(6), subtotal: subtotal.toFixed(2) };
  });
  const total = details.reduce((sum, line) => sum.plus(line.subtotal), new Decimal(0));
  if (total.gte("10000000000000")) throw new Error("Total fuera de la precisión monetaria admitida.");
  return { detalles: details, total: total.toFixed(2) };
}
export function validateMetalPayment(input: MetalPurchaseInput, total: string) {
  if (input.medio_pago === "EFECTIVO") {
    if (input.banco || input.referencia || input.comprobante) throw new Error("Un pago en efectivo no debe incluir datos bancarios.");
    if (input.billetes === undefined || input.monedas === undefined || !new Prisma.Decimal(input.billetes).plus(input.monedas).eq(total)) throw new Error("Billetes y monedas deben sumar el total de la compra.");
  } else if (!input.banco || !input.referencia || input.billetes !== undefined || input.monedas !== undefined) {
    throw new Error("La transferencia requiere banco y referencia, sin desglose de efectivo.");
  }
}
