import { z } from "zod";
import { evaluationSchema, metalLineSchema } from "./metalPurchase.js";

// Orden de trabajo «Evaluación de oro» (formato entregado por Punto Cambio).
export const ORDER_STATES = ["PENDIENTE_AUTORIZACION", "AUTORIZADA", "EVALUADA", "COMPRADA", "DEVUELTA", "ANULADA"] as const;
export type OrderState = (typeof ORDER_STATES)[number];
export const OPEN_STATES: OrderState[] = ["PENDIENTE_AUTORIZACION", "AUTORIZADA", "EVALUADA"];
export const JEWEL_TYPES = ["ANILLO", "CADENA", "PULSERA", "ESCLAVA", "ARETES", "DIJE", "COLLAR", "RELOJ", "MONEDA", "LINGOTE", "OTRO"] as const;
export const PROCESS_LABELS = { ACIDO: "Prueba de ácido", PIEDRA_TOQUE: "Prueba de piedra de toque", DENSIDAD: "Prueba de densidad / peso específico", XRF: "Prueba electrónica (XRF)", OTRO: "Otros" } as const;

const decimal = (scale: number) => z.string().regex(new RegExp(`^(0|[1-9][0-9]{0,9})(\\.[0-9]{1,${scale}})?$`), `Número decimal positivo con hasta ${scale} decimales`);
const text = (max: number) => z.string().trim().min(1).max(max);
const dataImage = (max: number) => z.string().max(max, "Imagen demasiado grande").regex(/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/]+={0,2}$/, "Imagen JPG o PNG no válida");
// La pantalla comprime las fotos antes de enviarlas; estos límites protegen el tamaño de cada orden.
export const piecePhoto = dataImage(450_000);
export const documentPhoto = dataImage(700_000);

export const clientSchema = z.object({ nombre: text(200), documento: text(40), telefono: text(40), direccion: text(300), procedencia: text(1000) }).strict();
export const receivedJewelSchema = z.object({
  tipo: z.enum(JEWEL_TYPES), descripcion: text(300), piezas: z.number().int().min(1).max(1000), peso_recibido: decimal(3),
  color: text(60), estado_conservacion: text(200), piedras: z.string().trim().max(300).default(""), foto_antes: piecePhoto,
}).strict();
export const PROCESS_CODES = ["ACIDO", "PIEDRA_TOQUE", "DENSIDAD", "XRF", "OTRO"] as const;
export type ProcessCode = (typeof PROCESS_CODES)[number];
// Sección 4 «Procesos a realizar»: se marcan antes de la firma; el cliente autoriza esas pruebas y no otras.
export const createOrderSchema = z.object({
  cliente: clientSchema, observaciones_cliente: z.string().trim().max(1000).default(""),
  procesos: z.array(z.enum(PROCESS_CODES)).min(1, "Marque al menos un proceso a realizar.").max(5).refine(list => new Set(list).size === list.length, "Procesos repetidos."),
  otros_procesos: z.string().trim().max(200).default(""),
  joyas: z.array(receivedJewelSchema).min(1).max(20),
}).strict().refine(o => !o.procesos.includes("OTRO") || o.otros_procesos.length > 0, { message: "Describa el proceso marcado como «Otros».", path: ["otros_procesos"] });
export const authorizeOrderSchema = z.object({ foto_autorizacion: documentPhoto, firmada: z.literal(true) }).strict();
export const evaluatedJewelSchema = z.object({
  id: z.string().uuid(), metal: z.enum(["ORO", "PLATA"]), metodo: z.enum(["ACIDO", "XRF", "OTRO"]),
  pureza: decimal(3), pureza_declarada: z.string().trim().max(80).default(""), deducciones: decimal(3), precio_gramo: decimal(6),
  observaciones: z.string().trim().max(500).default(""), foto_despues: piecePhoto.optional(), evaluacion: evaluationSchema,
}).strict();
export const evaluateOrderSchema = z.object({
  moneda_id: z.string().uuid(), seguridad: z.object({ acido_vigente: z.boolean(), guantes: z.boolean() }).strict().optional(),
  otros_procesos: z.string().trim().max(200).default(""), resultado_observaciones: z.string().trim().max(1000).default(""),
  joyas: z.array(evaluatedJewelSchema).min(1).max(20),
}).strict();
export const returnOrderSchema = z.object({ motivo: text(500), joyas_devueltas: z.literal(true), foto: documentPhoto.optional() }).strict();
export const cancelOrderSchema = z.object({ motivo: text(500) }).strict();
const money = z.string().regex(/^(0|[1-9][0-9]{0,12})(\.[0-9]{1,2})?$/, "Importe con hasta dos decimales");
export const orderPaymentSchema = z.object({
  orden_id: z.string().uuid(), medio_pago: z.enum(["EFECTIVO", "TRANSFERENCIA"]), billetes: money.optional(), monedas: money.optional(),
  banco: text(120).optional(), referencia: text(150).optional(), comprobante: piecePhoto.optional(),
}).strict();
export type OrderPayment = z.infer<typeof orderPaymentSchema>;

type EvaluatedJewel = z.infer<typeof evaluatedJewelSchema>;
/** Procesos realizados, deducidos de lo registrado en cada joya (sección 4 de la orden). */
export function deriveProcesses(jewels: EvaluatedJewel[], otros: string) {
  const set = new Set<ProcessCode>();
  for (const j of jewels) {
    if (j.metodo === "ACIDO" || j.evaluacion.reaccion !== "NO_REALIZADA") set.add("ACIDO");
    if (j.evaluacion.piedra !== "NO_REALIZADA") set.add("PIEDRA_TOQUE");
    if (j.evaluacion.densidad) set.add("DENSIDAD");
    if (j.metodo === "XRF") set.add("XRF");
    if (j.metodo === "OTRO") set.add("OTRO");
  }
  if (otros) set.add("OTRO");
  return { realizados: [...set], otros_realizados: otros };
}
/** Pruebas realizadas que el cliente no autorizó al firmar la orden. */
export function unauthorizedProcesses(realizados: ProcessCode[], autorizados: string[]) {
  return realizados.filter(p => !autorizados.includes(p)).map(p => PROCESS_LABELS[p]);
}

type StoredJewel = { descripcion: string; piezas: number; peso_recibido: { toString(): string }; foto_antes: string };
/** Línea de cálculo de compra a partir de la joya recibida y su evaluación. */
export function lineFromJewel(stored: StoredJewel, e: Pick<EvaluatedJewel, "metal" | "metodo" | "pureza" | "pureza_declarada" | "deducciones" | "precio_gramo" | "observaciones" | "evaluacion"> & { foto_despues?: string | null }): z.infer<typeof metalLineSchema> {
  return {
    metal: e.metal, descripcion: stored.descripcion, piezas: stored.piezas, peso_bruto: stored.peso_recibido.toString(), deducciones: e.deducciones,
    pureza_declarada: e.pureza_declarada, pureza: e.pureza, metodo: e.metodo, observaciones: e.observaciones, resultado_concluyente: true,
    precio_gramo: e.precio_gramo, foto: e.foto_despues || stored.foto_antes, evaluacion: evaluationSchema.strip().parse(e.evaluacion),
  };
}
export function gyeYear(date = new Date()) {
  return Number(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Guayaquil", year: "numeric" }).format(date));
}
