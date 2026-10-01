// Tipos y utilidades de la orden de trabajo «Evaluación de oro».
import type { Evaluacion } from "../../../server/utils/metalEvaluation";

export type OrderState = "PENDIENTE_AUTORIZACION" | "AUTORIZADA" | "EVALUADA" | "COMPRADA" | "DEVUELTA" | "ANULADA";
export type Safety = { acido_vigente: boolean; guantes: boolean };
export type SavedEvaluation = Partial<Evaluacion> & { resultado?: string; avisos?: string[]; pureza_maxima?: number | null; seguridad?: Safety | null };
export type Client = { nombre: string; documento: string; telefono: string; direccion: string; procedencia: string };
export type OrderJewel = {
  id: string; posicion: number; tipo: string; descripcion: string; piezas: number; peso_recibido: string; color: string; estado_conservacion: string; piedras: string;
  foto_antes: string; foto_despues?: string | null; metal?: "ORO" | "PLATA" | null; metodo?: "ACIDO" | "XRF" | "OTRO" | null; evaluacion?: SavedEvaluation | null;
  pureza_declarada: string; pureza?: string | null; deducciones?: string | null; peso_final?: string | null; precio_gramo?: string | null; subtotal?: string | null; observaciones: string;
};
export type Order = {
  id: string; numero: string; fecha: string; estado: OrderState; punto_nombre: string; asesor_nombre: string; cliente: Client; observaciones_cliente: string;
  procesos?: { autorizados: string[]; otros: string; realizados?: string[]; otros_realizados?: string } | null; autorizacion_foto?: string | null; autorizada_en?: string | null; moneda?: { id: string; codigo: string } | null;
  oferta_total?: string | null; seguridad?: Safety | null; resultado_observaciones: string; evaluada_en?: string | null;
  cierre?: { accion: string; motivo?: string; foto?: string | null; compra_id?: string } | null; cerrada_en?: string | null; joyas: OrderJewel[]; compra?: { id: string; numero: string; estado: string } | null;
};
export type OrderRow = Pick<Order, "id" | "numero" | "fecha" | "estado" | "punto_nombre" | "asesor_nombre" | "cliente" | "oferta_total" | "moneda"> & { _count: { joyas: number } };

export const STATE_LABEL: Record<OrderState, { texto: string; clase: string }> = {
  PENDIENTE_AUTORIZACION: { texto: "Pendiente de firma", clase: "bg-amber-100 text-amber-900" },
  AUTORIZADA: { texto: "Autorizada: en evaluación", clase: "bg-blue-100 text-blue-900" },
  EVALUADA: { texto: "Evaluada: oferta al cliente", clase: "bg-violet-100 text-violet-900" },
  COMPRADA: { texto: "Comprada", clase: "bg-green-100 text-green-900" },
  DEVUELTA: { texto: "Devuelta al cliente", clase: "bg-slate-200 text-slate-800" },
  ANULADA: { texto: "Anulada", clase: "bg-red-100 text-red-900" },
};
export const JEWEL_TYPES: [string, string][] = [["ANILLO", "Anillo"], ["CADENA", "Cadena"], ["PULSERA", "Pulsera"], ["ESCLAVA", "Esclava"], ["ARETES", "Aretes"], ["DIJE", "Dije"], ["COLLAR", "Collar"], ["RELOJ", "Reloj"], ["MONEDA", "Moneda"], ["LINGOTE", "Lingote"], ["OTRO", "Otro"]];
export const jewelTypeLabel = (code: string) => JEWEL_TYPES.find(([c]) => c === code)?.[1] ?? code;
export const PROCESS_LABELS: Record<string, string> = { ACIDO: "Prueba de ácido", PIEDRA_TOQUE: "Prueba de piedra de toque", DENSIDAD: "Prueba de densidad / peso específico", XRF: "Prueba electrónica (XRF)", OTRO: "Otros" };
export const money = (value?: string | null) => Number(value ?? 0).toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const gye = (date?: string | null) => (date ? new Date(date).toLocaleString("es-EC", { timeZone: "America/Guayaquil" }) : "");

/** Reduce una foto del celular a JPEG dentro del límite del servidor, conservando la legibilidad. */
export async function compressImage(file: File | undefined, { maxSide = 1280, maxChars = 420_000 } = {}): Promise<string | undefined> {
  if (!file) return undefined;
  if (!file.type.startsWith("image/")) throw new Error("Seleccione una imagen (foto JPG o PNG).");
  const bitmap = await createImageBitmap(file);
  let side = maxSide, quality = 0.82;
  for (let attempt = 0; attempt < 10; attempt++) {
    const scale = Math.min(1, side / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale); canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("El navegador no permite procesar la imagen.");
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const url = canvas.toDataURL("image/jpeg", quality);
    if (url.length <= maxChars) return url;
    if (quality > 0.5) quality -= 0.1; else side = Math.round(side * 0.8);
  }
  throw new Error("La imagen es demasiado grande incluso comprimida. Tome la foto más de cerca.");
}
