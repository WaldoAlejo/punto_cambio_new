// Ilustraciones propias (SVG) de los resultados de cada prueba de la capacitación.
import { REACTIONS, type Reaccion } from "../../../server/utils/metalEvaluation";

const GOLD = "#d4a72c", SILVER = "#c7c9cc", STONE = "#1f2023";

/** Marca en la piedra de toque con la gota de ácido y el color que produce. */
export function ReactionSwatch({ reaccion, metal = "ORO", bubbles, className = "h-16 w-24" }: { reaccion: Reaccion; metal?: "ORO" | "PLATA"; bubbles?: "BURBUJA" | "BURBUJEO" | "EFERVESCENCIA" | "NINGUNA"; className?: string }) {
  const color = REACTIONS[reaccion].color;
  const clear = reaccion === "NINGUNA" || reaccion === "NO_REALIZADA";
  const milky = reaccion === "BLANCO_LECHOSO" || reaccion === "CAFE_LECHOSO";
  const count = bubbles === "EFERVESCENCIA" ? 14 : bubbles === "BURBUJEO" ? 7 : bubbles === "BURBUJA" ? 3 : 0;
  return <svg viewBox="0 0 120 80" className={className} role="img" aria-label={`Reacción: ${REACTIONS[reaccion].nombre}`}>
    <rect x="2" y="2" width="116" height="76" rx="8" fill={STONE} />
    <path d="M14 46 C34 38, 70 36, 106 30 L108 40 C72 46, 36 48, 16 56 Z" fill={metal === "ORO" ? GOLD : SILVER} opacity="0.9" />
    {reaccion !== "NO_REALIZADA" && <ellipse cx="60" cy="42" rx="24" ry="17" fill={clear ? "#ffffff" : color} opacity={clear ? 0.18 : 0.92} stroke="#ffffff" strokeOpacity="0.5" />}
    {milky && <ellipse cx="60" cy="42" rx="24" ry="17" fill="none" stroke="#f8f7f2" strokeWidth="5" opacity="0.85" />}
    {Array.from({ length: count }, (_, i) => <circle key={i} cx={44 + ((i * 11) % 32)} cy={32 + ((i * 7) % 20)} r={bubbles === "EFERVESCENCIA" ? 2.6 : 2} fill="none" stroke="#ffffff" strokeWidth="1" opacity="0.9" />)}
    {reaccion === "NO_REALIZADA" && <text x="60" y="24" textAnchor="middle" fontSize="10" fill="#e2e8f0">sin ácido</text>}
  </svg>;
}

/** Marca limpia en la piedra de toque, antes del ácido. */
export function Streak({ metal = "ORO", className = "h-12 w-20" }: { metal?: "ORO" | "PLATA"; className?: string }) {
  return <svg viewBox="0 0 120 80" className={className} role="img" aria-label="Marca en la piedra de toque">
    <rect x="2" y="2" width="116" height="76" rx="8" fill={STONE} />
    {[0, 1, 2].map(i => <path key={i} d={`M${14 + i * 8} ${58 - i * 12} C40 ${50 - i * 12}, 74 ${46 - i * 12}, ${104 - i * 4} ${40 - i * 12}`} stroke={metal === "ORO" ? GOLD : SILVER} strokeWidth="6" strokeLinecap="round" fill="none" />)}
  </svg>;
}

/** Sello o punzón grabado, como se ve con la lupa. */
export function HallmarkStamp({ text, className = "h-10 w-20" }: { text: string; className?: string }) {
  return <svg viewBox="0 0 100 50" className={className} role="img" aria-label={`Sello ${text}`}>
    <rect x="3" y="5" width="94" height="40" rx="18" fill="#e9d48f" stroke="#9c7a1c" strokeWidth="3" />
    <rect x="10" y="11" width="80" height="28" rx="12" fill="#d8bc62" stroke="#b08d2c" />
    <text x="50" y="32" textAnchor="middle" fontFamily="Arial" fontWeight="700" fontSize={text.length > 4 ? 15 : 19} fill="#5c4308">{text}</text>
  </svg>;
}

/** Prueba del imán: atrae (no es oro) o no atrae. */
export function MagnetTest({ attracts, className = "h-20 w-28" }: { attracts: boolean; className?: string }) {
  return <svg viewBox="0 0 150 100" className={className} role="img" aria-label={attracts ? "El imán atrae la pieza" : "El imán no atrae la pieza"}>
    <path d="M20 20 v34 a26 26 0 0 0 52 0 v-34 h-16 v34 a10 10 0 0 1 -20 0 v-34 z" fill="#b91c1c" />
    <rect x="20" y="14" width="16" height="10" fill="#e5e7eb" /><rect x="56" y="14" width="16" height="10" fill="#e5e7eb" />
    <circle cx={attracts ? 104 : 118} cy={attracts ? 58 : 70} r="13" fill="none" stroke={GOLD} strokeWidth="6" />
    {attracts ? <><path d="M78 52 h12 M78 60 h12 M78 68 h12" stroke="#475569" strokeWidth="2" /><text x="75" y="96" textAnchor="middle" fontSize="12" fill="#b91c1c" fontFamily="Arial">Atrae: NO es oro</text></>
      : <text x="75" y="96" textAnchor="middle" fontSize="12" fill="#15803d" fontFamily="Arial">No atrae: continúe</text>}
  </svg>;
}

/** Corte de la pieza tras la lima o la lija: mismo metal o metal base debajo. */
export function FileTest({ plated, caption = true, className = "h-20 w-28" }: { plated: boolean; caption?: boolean; className?: string }) {
  return <svg viewBox="0 0 140 90" className={className} role="img" aria-label={plated ? "Aparece otro metal debajo" : "El mismo metal en todo el corte"}>
    <rect x="10" y="20" width="120" height="40" rx="20" fill={GOLD} />
    {plated && <rect x="16" y="26" width="108" height="28" rx="14" fill="#8a8f98" />}
    <path d="M60 20 l10 18 l10 -18 z" fill={plated ? "#8a8f98" : "#e7c65a"} stroke="#ffffff" strokeWidth="1" />
    {caption && <text x="70" y="82" textAnchor="middle" fontSize="11" fontFamily="Arial" fill={plated ? "#b91c1c" : "#15803d"}>{plated ? "Otro metal debajo: bañada" : "Mismo metal: continúe"}</text>}
  </svg>;
}

/** Color uniforme frente a desgaste que deja ver otro metal. */
export function WearCheck({ worn, className = "h-20 w-28" }: { worn: boolean; className?: string }) {
  return <svg viewBox="0 0 140 90" className={className} role="img" aria-label={worn ? "Desgaste con otro color" : "Color uniforme"}>
    <circle cx="70" cy="38" r="28" fill="none" stroke={GOLD} strokeWidth="12" />
    {worn && <path d="M50 18 a28 28 0 0 1 22 -8" fill="none" stroke="#b87333" strokeWidth="12" />}
    <text x="70" y="84" textAnchor="middle" fontSize="11" fontFamily="Arial" fill={worn ? "#b91c1c" : "#15803d"}>{worn ? "Otro color en el desgaste" : "Color uniforme"}</text>
  </svg>;
}

/** Dónde buscar el sello en cadenas y cierres (anilla junto al cierre, émbolo del mosquetón). */
export function SealLocation({ className = "h-28 w-full" }: { className?: string }) {
  return <svg viewBox="0 0 320 120" className={className} role="img" aria-label="Ubicación del sello en cadenas y cierres">
    {[0, 1, 2, 3, 4].map(i => <ellipse key={i} cx={20 + i * 26} cy="60" rx="15" ry="9" fill="none" stroke={GOLD} strokeWidth="5" />)}
    <rect x="148" y="48" width="30" height="24" rx="4" fill="#e9d48f" stroke="#9c7a1c" strokeWidth="2" /><text x="163" y="64" textAnchor="middle" fontSize="9" fontWeight="700" fill="#5c4308">750</text>
    <path d="M182 42 h52 a18 18 0 0 1 0 36 h-52 z" fill="none" stroke={GOLD} strokeWidth="6" />
    <rect x="196" y="34" width="22" height="10" rx="2" fill="#e9d48f" stroke="#9c7a1c" /><text x="207" y="42" textAnchor="middle" fontSize="7" fontWeight="700" fill="#5c4308">750</text>
    <circle cx="163" cy="60" r="24" fill="none" stroke="#2563eb" strokeWidth="2" strokeDasharray="4 3" /><circle cx="207" cy="39" r="16" fill="none" stroke="#2563eb" strokeWidth="2" strokeDasharray="4 3" />
    <text x="130" y="108" textAnchor="middle" fontSize="11" fontFamily="Arial" fill="#1e3a8a">Anilla o asa plana junto al cierre</text>
    <text x="258" y="20" textAnchor="middle" fontSize="11" fontFamily="Arial" fill="#1e3a8a">Émbolo / gatillo</text>
  </svg>;
}

/** Barra de composición de una aleación. */
export function AlloyBar({ parts }: { parts: { nombre: string; porcentaje: number; color: string }[] }) {
  return <div><div className="flex h-5 overflow-hidden rounded border border-slate-300">{parts.map(p => <div key={p.nombre} style={{ width: `${p.porcentaje}%`, background: p.color }} title={`${p.nombre} ${p.porcentaje}%`} />)}</div>
    <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-slate-600">{parts.map(p => <span key={p.nombre} className="inline-flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: p.color }} />{p.nombre} {String(p.porcentaje).replace(".", ",")}%</span>)}</div></div>;
}

/** Proporción de metal fino según la pureza en milésimas. */
export function PurityBar({ pureza, metal = "ORO" }: { pureza: number; metal?: "ORO" | "PLATA" }) {
  return <div className="h-2.5 w-full overflow-hidden rounded bg-slate-200" title={`${pureza / 10}% de ${metal === "ORO" ? "oro" : "plata"} fino`}>
    <div className="h-full" style={{ width: `${Math.min(100, pureza / 10)}%`, background: metal === "ORO" ? GOLD : "#9ca3af" }} /></div>;
}
