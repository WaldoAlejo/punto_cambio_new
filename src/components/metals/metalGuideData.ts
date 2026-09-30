// Datos y utilidades de la guía de reconocimiento, compartidos por los componentes de metales.
import { evaluateMetalLine, type Evaluacion, type Metal, type Metodo, type Veredicto } from "../../../server/utils/metalEvaluation";

export const ALLOYS: Record<string, { quilates: string; parts: { nombre: string; porcentaje: number; color: string }[] }[]> = {
  AMARILLO: [
    { quilates: "22K", parts: [{ nombre: "Oro", porcentaje: 91.7, color: "#d4a72c" }, { nombre: "Plata", porcentaje: 4.15, color: "#c7c9cc" }, { nombre: "Cobre", porcentaje: 4.15, color: "#b87333" }] },
    { quilates: "18K", parts: [{ nombre: "Oro", porcentaje: 75, color: "#d4a72c" }, { nombre: "Plata", porcentaje: 12.5, color: "#c7c9cc" }, { nombre: "Cobre", porcentaje: 12.5, color: "#b87333" }] },
  ],
  ROJO: [
    { quilates: "22K", parts: [{ nombre: "Oro", porcentaje: 91.7, color: "#d4a72c" }, { nombre: "Cobre", porcentaje: 8.3, color: "#b87333" }] },
    { quilates: "18K", parts: [{ nombre: "Oro", porcentaje: 75, color: "#d4a72c" }, { nombre: "Cobre", porcentaje: 25, color: "#b87333" }] },
  ],
  BLANCO: [
    { quilates: "22K", parts: [{ nombre: "Oro", porcentaje: 91.7, color: "#d4a72c" }, { nombre: "Paladio", porcentaje: 5.3, color: "#8f9aa6" }, { nombre: "Plata", porcentaje: 3, color: "#c7c9cc" }] },
    { quilates: "18K", parts: [{ nombre: "Oro", porcentaje: 75, color: "#d4a72c" }, { nombre: "Paladio", porcentaje: 16, color: "#8f9aa6" }, { nombre: "Plata", porcentaje: 9, color: "#c7c9cc" }] },
  ],
};

export type EvaluationDraft = Partial<Evaluacion>;
export const blankEvaluation = (metal: Metal): EvaluationDraft => (metal === "PLATA" ? { tipo_color: "PLATA", sello_con_lupa: false, uniones_revisadas: false } : { sello_con_lupa: false, uniones_revisadas: false });
const REQUIRED: [keyof Evaluacion, string][] = [["tipo_color", "color"], ["sello", "sello"], ["color_uniforme", "color uniforme"], ["iman", "imán"], ["piedra", "piedra o lija"], ["lima", "lima"], ["acido_usado", "ácido usado"], ["reaccion", "reacción"], ["intensidad", "intensidad"], ["material", "material"]];
export function pendingSteps(draft: EvaluationDraft) { return REQUIRED.filter(([key]) => draft[key] === undefined).map(([, label]) => label); }
export function verdictOf(metal: Metal, metodo: Metodo, pureza: string, draft: EvaluationDraft): Veredicto | null {
  if (pendingSteps(draft).length || !(Number(pureza) > 0)) return null;
  return evaluateMetalLine(metal, metodo, Number(pureza), draft as Evaluacion);
}
