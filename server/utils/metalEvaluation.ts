// Catálogo y reglas de reconocimiento de oro y plata según la capacitación
// «Reconocimiento de oro» (Rashell Silva). Archivo puro, sin imports: lo usan
// tanto el servidor (validación definitiva) como la pantalla (veredicto en vivo).

export type Metal = "ORO" | "PLATA";
export type Metodo = "ACIDO" | "XRF" | "OTRO";

export const GOLD_KARATS = [
  { codigo: "10K", quilates: 10, pureza: 417, reaccion: "BLANCO_LECHOSO" },
  { codigo: "12K", quilates: 12, pureza: 500, reaccion: "CAFE_LECHOSO" },
  { codigo: "14K", quilates: 14, pureza: 585, reaccion: "CAFE" },
  { codigo: "16K", quilates: 16, pureza: 667, reaccion: "POCO_CAFE" },
  { codigo: "18K", quilates: 18, pureza: 750, reaccion: "NINGUNA" },
  { codigo: "20K", quilates: 20, pureza: 833, reaccion: "NINGUNA" },
  { codigo: "22K", quilates: 22, pureza: 917, reaccion: "NINGUNA" },
  { codigo: "24K", quilates: 24, pureza: 999, reaccion: "NINGUNA" },
] as const;

export const SILVER_GRADES = [
  { codigo: "800", pureza: 800, nombre: "Plata 800" },
  { codigo: "900", pureza: 900, nombre: "Plata 900" },
  { codigo: "925", pureza: 925, nombre: "Plata de ley 925 (Sterling)" },
  { codigo: "950", pureza: 950, nombre: "Plata 950" },
  { codigo: "999", pureza: 999, nombre: "Plata fina 999" },
] as const;

type Option = { codigo: string; nombre: string; descripcion: string };

export const GOLD_COLORS = [
  { codigo: "AMARILLO", nombre: "Oro amarillo", descripcion: "Oro con plata y cobre en partes iguales. 18K: 75% oro, 12,5% plata, 12,5% cobre. 22K: 91,7% oro, 4,15% plata, 4,15% cobre." },
  { codigo: "ROJO", nombre: "Oro rojo / rosado", descripcion: "Oro con cobre, sin plata. 18K: 75% oro, 25% cobre. 22K: 91,7% oro, 8,3% cobre." },
  { codigo: "BLANCO", nombre: "Oro blanco", descripcion: "Oro con paladio y plata; a veces con baño de rodio (rodinado). 18K: 75% oro, 16% paladio, 9% plata. 22K: 91,7% oro, 5,3% paladio, 3% plata." },
] as const satisfies readonly Option[];

export type Reaccion = "NINGUNA" | "POCO_CAFE" | "CAFE" | "CAFE_LECHOSO" | "BLANCO_LECHOSO" | "VERDE" | "BLANCO" | "DORADO" | "AMARILLENTA" | "NO_REALIZADA";
export const REACTIONS: Record<Reaccion, { nombre: string; descripcion: string; color: string; oro?: number; rechazaOro?: string; rechazaPlata?: string }> = {
  NINGUNA: { nombre: "Sin reacción", descripcion: "La marca sigue dorada y la gota queda transparente. Oro 18K, 750, 20K, 22K o 24K.", color: "#f3f1e8", oro: 750, rechazaPlata: "La plata reacciona blanco lechoso. Sin reacción y color blanco indica posible acero: no se compra." },
  POCO_CAFE: { nombre: "Mancha poco café", descripcion: "Mancha café clara y leve. Oro 16K (667).", color: "#c49a5c", oro: 667, rechazaPlata: "Reacción que no corresponde a plata." },
  CAFE: { nombre: "Mancha café", descripcion: "Mancha café oscura, con burbuja ligera. Oro 14K (585).", color: "#7a4a1e", oro: 585, rechazaPlata: "Reacción que no corresponde a plata." },
  CAFE_LECHOSO: { nombre: "Mancha café y lechosa", descripcion: "Café con borde blanco lechoso. Oro 12K (500).", color: "#a58a6d", oro: 500, rechazaPlata: "Reacción que no corresponde a plata." },
  BLANCO_LECHOSO: { nombre: "Blanco lechoso", descripcion: "En oro: café oscuro que a los segundos burbujea verde-blanco (burbujeo), 10K (417). En plata 925 es la reacción esperada.", color: "#e9e6dc", oro: 417 },
  VERDE: { nombre: "Verde / efervescencia", descripcion: "Espuma verde intensa. Cobre, bronce o pieza solo bañada en oro.", color: "#2fa58a", rechazaOro: "Reacción verde: cobre, bronce o pieza bañada en oro. No se compra.", rechazaPlata: "Reacción verde: cobre, bronce o metal base. No se compra." },
  BLANCO: { nombre: "Blanco inmediato", descripcion: "La marca se vuelve blanca al instante. Plata de ley con baño de oro.", color: "#fbfbfb", rechazaOro: "Reacción blanca: plata con baño de oro. Regístrela como PLATA si corresponde, nunca como oro.", rechazaPlata: "Reacción que no corresponde a plata." },
  DORADO: { nombre: "Se torna dorado", descripcion: "La marca adquiere tono dorado. Latón con baño de oro.", color: "#d9aa2b", rechazaOro: "Reacción dorada: latón bañado en oro. No se compra.", rechazaPlata: "Reacción dorada: latón. No se compra." },
  AMARILLENTA: { nombre: "Amarillenta", descripcion: "Reacción amarillenta. Níquel.", color: "#e6d56a", rechazaOro: "Reacción amarillenta: níquel. No se compra.", rechazaPlata: "Reacción amarillenta: níquel. No se compra." },
  NO_REALIZADA: { nombre: "No realizada", descripcion: "Solo si la pureza se evaluó con XRF u otro método.", color: "#cbd5e1" },
};
export const GOLD_REACTIONS: Reaccion[] = ["NINGUNA", "POCO_CAFE", "CAFE", "CAFE_LECHOSO", "BLANCO_LECHOSO", "VERDE", "BLANCO", "DORADO", "AMARILLENTA", "NO_REALIZADA"];
export const SILVER_REACTIONS: Reaccion[] = ["BLANCO_LECHOSO", "NINGUNA", "VERDE", "DORADO", "AMARILLENTA", "NO_REALIZADA"];

export const INTENSITIES = [
  { codigo: "NINGUNA", nombre: "Sin burbujas", descripcion: "Oro de alta ley (18K o más)." },
  { codigo: "BURBUJA", nombre: "Burbuja", descripcion: "Pocas burbujas pequeñas. Frecuente en 14K." },
  { codigo: "BURBUJEO", nombre: "Burbujeo", descripcion: "Burbujas constantes. Frecuente en 10K." },
  { codigo: "EFERVESCENCIA", nombre: "Efervescencia", descripcion: "Espuma abundante, normalmente verde. Cobre: no es oro." },
] as const satisfies readonly Option[];

export const MATERIALS = [
  { codigo: "NINGUNO", nombre: "Ninguno detectado", descripcion: "No hay señales de material no comercial." },
  { codigo: "ACERO", nombre: "Acero", descripcion: "Blanco más opaco que la plata, duro: no le entra la lima. Sello STEEL. No reacciona. Marcas como TOUS o BVLGARI." },
  { codigo: "TITANIO", nombre: "Titanio", descripcion: "Gris, muy liviano y duro." },
  { codigo: "NIQUEL", nombre: "Níquel", descripcion: "Reacción amarillenta con el ácido. Se usaba para blanquear metales." },
  { codigo: "GOLD_FILLED", nombre: "Gold filled / laminado", descripcion: "Capa de oro unida a un metal base. Sellos GF, 1/20, 12K GF, RGP." },
  { codigo: "ENCHAPADO", nombre: "Enchapado / bañado / revestido", descripcion: "Joyas enchapadas o bañadas, como ROMMANEL o ESIKA. Al lijar o limar aparece otro metal." },
] as const satisfies readonly Option[];

export const STEPS = [
  { paso: 1, titulo: "Herramientas listas", texto: "Piedra de toque o lija (500 a 1200), limas, lupa, imán de neodimio y ácidos 10K, 14K y 18K no vencidos. Use guantes." },
  { paso: 2, titulo: "Observar la pieza", texto: "Busque el sello de pureza o quilates. Un sello no garantiza que sea auténtica. El color debe ser uniforme, sin otro metal en las zonas de desgaste." },
  { paso: 3, titulo: "Sello con lupa", texto: "En cadenas, la anilla o asa plana junto al cierre; en resortes y mosquetones, el émbolo o gatillo. Revise también broche, uniones y soldaduras." },
  { paso: 4, titulo: "Imán", texto: "El oro y la plata no son magnéticos. Si el imán de neodimio atrae la pieza, no es oro real." },
  { paso: 5, titulo: "Piedra o lija", texto: "Frote la pieza en la piedra o lija de 500 para dejar una marca. Si aparece otro color debajo, es una pieza bañada." },
  { paso: 6, titulo: "Lima (si hay dudas)", texto: "Solo para despejar dudas y sin dañar la joya. No es necesaria si la pieza está marcada 750 y ya pasó la prueba previa." },
  { paso: 7, titulo: "Ácido", texto: "Aplique el ácido sobre la marca. Ácido no vencido y con las mezclas exactas; siempre con guantes. Compare el color con la tabla de quilates." },
] as const;

export type Evaluacion = {
  tipo_color: "AMARILLO" | "ROJO" | "BLANCO" | "PLATA";
  sello: string; sello_con_lupa: boolean; uniones_revisadas: boolean; color_uniforme: boolean;
  iman: "NO_ATRAE" | "ATRAE";
  piedra: "MARCA_UNIFORME" | "OTRO_METAL" | "NO_REALIZADA";
  lima: "NO_NECESARIA" | "MISMO_METAL" | "OTRO_METAL";
  acido_usado: "10K" | "14K" | "18K" | "NO_APLICA";
  reaccion: Reaccion;
  intensidad: (typeof INTENSITIES)[number]["codigo"];
  material: (typeof MATERIALS)[number]["codigo"];
  justificacion?: string;
};
export const SEAL_NONE = ["NINGUNO", "ILEGIBLE"] as const;
export const goldSeals = (): string[] => [...SEAL_NONE, ...GOLD_KARATS.map(k => k.codigo), "750", "585", "417", "PLATA_925"];
export const silverSeals = (): string[] => [...SEAL_NONE, ...SILVER_GRADES.map(g => g.codigo)];
// Sellos numéricos de oro: 750 = 18K, 585 = 14K, 417 = 10K.
function sealPurity(metal: Metal, seal: string): number | undefined {
  if (metal === "ORO") return GOLD_KARATS.find(k => k.codigo === seal || String(k.pureza) === seal)?.pureza;
  return SILVER_GRADES.find(g => g.codigo === seal)?.pureza;
}
export const karatOf = (purity: number) => (purity * 24) / 1000;

export type Veredicto = { estado: "APTA" | "JUSTIFICAR" | "RECHAZAR"; motivos: string[]; avisos: string[]; pureza_sugerida?: number; pureza_maxima?: number };

export function evaluateMetalLine(metal: Metal, metodo: Metodo, pureza: number, ev: Evaluacion): Veredicto {
  const motivos: string[] = [], avisos: string[] = [];
  const acid = metodo === "ACIDO";
  const reaction = REACTIONS[ev.reaccion];
  if (metal === "ORO" && ev.tipo_color === "PLATA") motivos.push("Seleccione el color del oro: amarillo, rojo o blanco.");
  if (metal === "PLATA" && ev.tipo_color !== "PLATA") motivos.push("Una pieza de plata debe registrarse con color plata.");
  if (!(metal === "ORO" ? goldSeals() : silverSeals()).includes(ev.sello)) motivos.push("Sello no válido para este metal.");
  if (!ev.sello_con_lupa) motivos.push("Paso 3: revise el sello con la lupa antes de comprar.");
  if (!ev.uniones_revisadas) motivos.push("Paso 3: revise broche, uniones y soldaduras.");
  if (!ev.color_uniforme) motivos.push("Color no uniforme o aparece otro metal en zonas de desgaste: posible pieza bañada. No se compra.");
  if (ev.iman === "ATRAE") motivos.push("El imán atrae la pieza: no es oro ni plata real. No se compra.");
  if (ev.piedra === "OTRO_METAL") motivos.push("La piedra o lija dejó ver otro metal: pieza bañada. No se compra.");
  if (ev.lima === "OTRO_METAL") motivos.push("La lima dejó ver otro metal debajo: pieza bañada o enchapada. No se compra.");
  if (ev.material !== "NINGUNO") motivos.push(`${MATERIALS.find(m => m.codigo === ev.material)?.nombre ?? "Material no comercial"}: material no comercial. No se compra.`);
  if (ev.intensidad === "EFERVESCENCIA") motivos.push("Efervescencia: reacción de cobre. No es oro. No se compra.");
  if (acid) {
    if (ev.piedra === "NO_REALIZADA") motivos.push("Paso 5: haga la marca en la piedra o lija antes del ácido.");
    if (ev.acido_usado === "NO_APLICA") motivos.push("Indique el ácido utilizado (10K, 14K o 18K).");
    if (ev.reaccion === "NO_REALIZADA") motivos.push("Con método ácido debe registrar la reacción observada.");
  }
  const allowed = metal === "ORO" ? GOLD_REACTIONS : SILVER_REACTIONS;
  if (!allowed.includes(ev.reaccion)) motivos.push("Reacción no válida para este metal.");
  const rejection = metal === "ORO" ? reaction.rechazaOro : reaction.rechazaPlata;
  if (rejection) motivos.push(rejection);
  const seal = sealPurity(metal, ev.sello);
  const noSeal = (SEAL_NONE as readonly string[]).includes(ev.sello);
  if (metal === "ORO" && ev.sello === "PLATA_925") motivos.push("Sello 925 en pieza dorada: plata con baño de oro. Regístrela como PLATA, nunca como oro.");
  if (noSeal) {
    avisos.push("Sin sello legible: puede estar desgastado o ser una pieza falsa.");
    if (ev.lima === "NO_NECESARIA") motivos.push("Paso 6: sin sello visible, use la lima para despejar dudas.");
  }
  // Pureza máxima respaldada por las pruebas: nunca se paga más ley de la que muestran sello y reacción.
  let max: number | undefined, suggested: number | undefined;
  if (metal === "ORO") {
    const byReaction = ev.reaccion === "NO_REALIZADA" ? undefined : reaction.oro;
    if (ev.reaccion === "NINGUNA") max = seal && seal >= 750 ? seal : 750;
    else max = byReaction;
    if (seal !== undefined && max !== undefined && seal < max) { avisos.push("El sello indica menos ley que la reacción: se toma el valor más bajo."); max = seal; }
    if (seal !== undefined && byReaction !== undefined && ev.reaccion !== "NINGUNA" && seal > byReaction) avisos.push(`El sello (${ev.sello}) indica más ley que la reacción al ácido: podría ser falso.`);
    if (max === undefined) max = seal;
    suggested = max;
  } else {
    max = seal ?? 925;
    suggested = max;
  }
  if (ev.lima === "NO_NECESARIA" && seal !== undefined && seal < 750 && metal === "ORO") avisos.push("La lima solo se omite en piezas marcadas 750 que ya pasaron la prueba previa.");
  if (!acid && ev.reaccion === "NO_REALIZADA") avisos.push(`Pureza evaluada por ${metodo === "XRF" ? "XRF" : "otro método"}; conserve el resultado.`);
  if (motivos.length) return { estado: "RECHAZAR", motivos, avisos, pureza_sugerida: suggested, pureza_maxima: max };
  if (max !== undefined && pureza > max) {
    const text = `La pureza evaluada (${pureza}) supera la respaldada por sello y reacción (${max}).`;
    if (!ev.justificacion || ev.justificacion.trim().length < 15) return { estado: "JUSTIFICAR", motivos: [`${text} Justifique con al menos 15 caracteres o corrija la pureza.`], avisos, pureza_sugerida: suggested, pureza_maxima: max };
    avisos.push(`${text} Justificación registrada.`);
  }
  return { estado: "APTA", motivos, avisos, pureza_sugerida: suggested, pureza_maxima: max };
}
