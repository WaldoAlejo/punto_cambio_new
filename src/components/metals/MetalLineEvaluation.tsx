// Lista de verificación visual por pieza, paso a paso según la capacitación.
import { GOLD_COLORS, GOLD_KARATS, GOLD_REACTIONS, INTENSITIES, karatOf, MATERIALS, REACTIONS, SILVER_GRADES, SILVER_REACTIONS, type Metal, type Metodo } from "../../../server/utils/metalEvaluation";
import { pendingSteps, verdictOf, type EvaluationDraft } from "./metalGuideData";
import MetalPhotoExamples from "./MetalPhotoExamples";
import type { ExampleKey } from "./metalPhotos";
import { AlloyBar, FileTest, HallmarkStamp, MagnetTest, ReactionSwatch, Streak, WearCheck } from "./MetalIllustrations";
import { ALLOYS } from "./metalGuideData";

function Choice({ active, danger, onClick, children, label }: { active: boolean; danger?: boolean; onClick: () => void; children: React.ReactNode; label: string }) {
  return <button type="button" aria-pressed={active} aria-label={label} onClick={onClick}
    className={`flex flex-col items-center gap-1 rounded-lg border-2 p-2 text-center text-xs transition ${active ? (danger ? "border-red-500 bg-red-50" : "border-amber-500 bg-amber-50") : "border-slate-200 bg-white hover:border-slate-400"}`}>{children}</button>;
}
function Step({ n, title, hint, done, examples, children }: { n: number; title: string; hint?: string; done: boolean; examples?: ExampleKey; children: React.ReactNode }) {
  return <div className="rounded-lg border bg-slate-50 p-3"><div className="mb-2 flex items-center gap-2"><span className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white ${done ? "bg-green-600" : "bg-slate-400"}`}>{done ? "✓" : n}</span><h4 className="text-sm font-semibold">{title}</h4></div>{hint && <p className="mb-2 text-xs text-slate-600">{hint}</p>}{children}{examples && <MetalPhotoExamples step={examples} compact />}</div>;
}

export default function MetalLineEvaluation({ metal, metodo, pureza, value, onChange, onPurity }: { metal: Metal; metodo: Metodo; pureza: string; value: EvaluationDraft; onChange: (patch: EvaluationDraft) => void; onPurity: (p: string) => void }) {
  // Solo envía el cambio: el padre lo fusiona sobre el estado vigente (clics rápidos no se pisan).
  const set = (patch: EvaluationDraft) => onChange(patch);
  const acid = metodo === "ACIDO";
  const seals: { code: string; stamp: string }[] = metal === "ORO"
    ? [...GOLD_KARATS.map(k => ({ code: k.codigo, stamp: k.codigo })), { code: "750", stamp: "750" }, { code: "585", stamp: "585" }, { code: "417", stamp: "417" }, { code: "PLATA_925", stamp: "925" }]
    : SILVER_GRADES.map(g => ({ code: g.codigo, stamp: g.codigo }));
  const verdict = verdictOf(metal, metodo, pureza, value);
  const pending = pendingSteps(value);
  const purity = Number(pureza);
  return <div className="mt-4 space-y-3 rounded-lg border border-amber-200 bg-amber-50/40 p-3">
    <h3 className="font-semibold">Reconocimiento de la pieza <span className="text-xs font-normal text-slate-600">(capacitación «Reconocimiento de oro»)</span></h3>
    <div className="grid gap-3 lg:grid-cols-2">
      {metal === "ORO" && <Step n={1} title="Color del oro" hint="Identifique la aleación por su color." done={!!value.tipo_color}>
        <div className="grid grid-cols-3 gap-2">{GOLD_COLORS.map(c => <Choice key={c.codigo} label={c.nombre} active={value.tipo_color === c.codigo} onClick={() => set({ tipo_color: c.codigo })}>
          <span className="h-6 w-full rounded" style={{ background: c.codigo === "AMARILLO" ? "#e2b93b" : c.codigo === "ROJO" ? "#d8906a" : "#dfe2e6" }} /><strong>{c.nombre}</strong><div className="w-full text-left"><AlloyBar parts={ALLOYS[c.codigo][1].parts} /></div></Choice>)}</div>
      </Step>}
      <Step n={2} examples="sello" title="Sello con lupa" hint={metal === "ORO" ? "Cadenas: anilla junto al cierre. Mosquetones: émbolo o gatillo. Un sello no garantiza autenticidad." : "Busque 925 / Ag 925 en la pieza o en la placa junto al cierre."} done={!!value.sello && !!value.sello_con_lupa && !!value.uniones_revisadas}>
        <div className="flex flex-wrap gap-2">{seals.map(s => <Choice key={s.code} label={`Sello ${s.stamp}`} danger={s.code === "PLATA_925"} active={value.sello === s.code} onClick={() => set({ sello: s.code })}><HallmarkStamp text={s.stamp} className="h-8 w-14" /></Choice>)}
          {[["NINGUNO", "Sin sello"], ["ILEGIBLE", "Ilegible"]].map(([code, label]) => <Choice key={code} label={label} active={value.sello === code} onClick={() => set({ sello: code })}><span className="flex h-8 w-14 items-center justify-center rounded border border-dashed">{label}</span></Choice>)}</div>
        <label className="mt-2 flex gap-2 text-sm"><input type="checkbox" checked={!!value.sello_con_lupa} onChange={e => set({ sello_con_lupa: e.target.checked })} />Revisé el sello con la lupa</label>
        <label className="flex gap-2 text-sm"><input type="checkbox" checked={!!value.uniones_revisadas} onChange={e => set({ uniones_revisadas: e.target.checked })} />Revisé broche, uniones y soldaduras</label>
      </Step>
      <Step n={3} examples="color" title="Color uniforme" hint="Mire las zonas de más desgaste." done={value.color_uniforme !== undefined}>
        <div className="grid grid-cols-2 gap-2"><Choice label="Color uniforme" active={value.color_uniforme === true} onClick={() => set({ color_uniforme: true })}><WearCheck worn={false} /></Choice><Choice label="Otro color en el desgaste" danger active={value.color_uniforme === false} onClick={() => set({ color_uniforme: false })}><WearCheck worn /></Choice></div>
      </Step>
      <Step n={4} examples="iman" title="Imán de neodimio" done={!!value.iman}>
        <div className="grid grid-cols-2 gap-2"><Choice label="No atrae" active={value.iman === "NO_ATRAE"} onClick={() => set({ iman: "NO_ATRAE" })}><MagnetTest attracts={false} /></Choice><Choice label="Atrae" danger active={value.iman === "ATRAE"} onClick={() => set({ iman: "ATRAE" })}><MagnetTest attracts /></Choice></div>
      </Step>
      <Step n={5} examples="piedra" title="Piedra o lija (500)" hint="Frote para dejar la marca donde aplicará el ácido." done={!!value.piedra}>
        <div className="grid grid-cols-3 gap-2">
          <Choice label="Marca uniforme" active={value.piedra === "MARCA_UNIFORME"} onClick={() => set({ piedra: "MARCA_UNIFORME" })}><Streak metal={metal} />Marca del mismo color</Choice>
          <Choice label="Aparece otro metal" danger active={value.piedra === "OTRO_METAL"} onClick={() => set({ piedra: "OTRO_METAL" })}><FileTest plated caption={false} className="h-12 w-20" />Aparece otro metal</Choice>
          <Choice label="No realizada" active={value.piedra === "NO_REALIZADA"} onClick={() => set({ piedra: "NO_REALIZADA" })}><span className="flex h-12 items-center">No realizada</span>{acid && <em className="text-red-700">requerida con ácido</em>}</Choice>
        </div>
      </Step>
      <Step n={6} examples="lima" title="Lima (si hay dudas)" hint="No es necesaria en piezas marcadas 750 que ya pasaron la prueba previa. Obligatoria si no hay sello." done={!!value.lima}>
        <div className="grid grid-cols-3 gap-2">
          <Choice label="No necesaria" active={value.lima === "NO_NECESARIA"} onClick={() => set({ lima: "NO_NECESARIA" })}><span className="flex h-12 items-center">No necesaria</span></Choice>
          <Choice label="Mismo metal" active={value.lima === "MISMO_METAL"} onClick={() => set({ lima: "MISMO_METAL" })}><FileTest plated={false} caption={false} className="h-12 w-20" />Mismo metal</Choice>
          <Choice label="Otro metal debajo" danger active={value.lima === "OTRO_METAL"} onClick={() => set({ lima: "OTRO_METAL" })}><FileTest plated caption={false} className="h-12 w-20" />Otro metal debajo</Choice>
        </div>
      </Step>
    </div>
    <Step n={7} examples="acido" title="Prueba con ácido" hint="Ácido no vencido, mezclas exactas y guantes. Compare el color de la gota sobre la marca." done={!!value.acido_usado && !!value.reaccion && !!value.intensidad}>
      <div className="mb-2 flex flex-wrap gap-2 text-sm">Ácido usado:{(["10K", "14K", "18K", "NO_APLICA"] as const).map(a => <button key={a} type="button" aria-pressed={value.acido_usado === a} onClick={() => set({ acido_usado: a })} className={`rounded border px-3 py-1 ${value.acido_usado === a ? "border-amber-500 bg-amber-100" : "bg-white"}`}>{a === "NO_APLICA" ? "No aplica (XRF/otro)" : `Ácido ${a}`}</button>)}</div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">{(metal === "ORO" ? GOLD_REACTIONS : SILVER_REACTIONS).map(r => {
        const reaction = REACTIONS[r], bad = !!(metal === "ORO" ? reaction.rechazaOro : reaction.rechazaPlata);
        return <Choice key={r} label={reaction.nombre} danger={bad} active={value.reaccion === r} onClick={() => set({ reaccion: r })}><ReactionSwatch reaccion={r} metal={metal} className="h-12 w-20" /><strong>{reaction.nombre}</strong>
          <span className={bad ? "text-red-700" : "text-slate-600"}>{metal === "ORO" && reaction.oro && !bad ? (r === "NINGUNA" ? "18K–24K" : GOLD_KARATS.find(k => k.pureza === reaction.oro)?.codigo) : bad ? "No se compra" : r === "BLANCO_LECHOSO" ? "Plata" : ""}</span></Choice>;
      })}</div>
      <div className="mt-2 flex flex-wrap gap-2 text-sm">Intensidad:{INTENSITIES.map(i => <button key={i.codigo} type="button" title={i.descripcion} aria-pressed={value.intensidad === i.codigo} onClick={() => set({ intensidad: i.codigo })} className={`rounded border px-3 py-1 ${value.intensidad === i.codigo ? (i.codigo === "EFERVESCENCIA" ? "border-red-500 bg-red-50" : "border-amber-500 bg-amber-100") : "bg-white"}`}>{i.nombre}</button>)}</div>
    </Step>
    <Step n={8} examples="material" title="Material no comercial" hint="Acero (STEEL, no le entra la lima), titanio, níquel, gold filled o enchapado: no se compran." done={!!value.material}>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{MATERIALS.map(m => <Choice key={m.codigo} label={m.nombre} danger={m.codigo !== "NINGUNO"} active={value.material === m.codigo} onClick={() => set({ material: m.codigo })}><strong>{m.nombre}</strong><span className="text-slate-600">{m.descripcion.split(".")[0]}</span></Choice>)}</div>
    </Step>
    <div className="rounded-lg border bg-white p-3">
      <p className="mb-2 text-sm font-semibold">Pureza a pagar {metal === "ORO" && purity > 0 && <span className="font-normal text-slate-600">≈ {karatOf(purity).toFixed(1).replace(".", ",")} K</span>}</p>
      <div className="flex flex-wrap gap-2">{(metal === "ORO" ? GOLD_KARATS.map(k => ({ label: k.codigo, pureza: k.pureza })) : SILVER_GRADES.map(g => ({ label: g.codigo, pureza: g.pureza }))).map(o => <button key={o.label} type="button" aria-pressed={purity === o.pureza} onClick={() => onPurity(String(o.pureza))} className={`rounded border px-3 py-1 text-sm ${purity === o.pureza ? "border-amber-500 bg-amber-100 font-semibold" : "bg-white"}`}>{o.label}{metal === "ORO" && <span className="ml-1 text-xs text-slate-500">{o.pureza}</span>}</button>)}</div>
      {verdict?.pureza_sugerida && purity !== verdict.pureza_sugerida && <button type="button" className="mt-2 text-sm text-blue-700 underline" onClick={() => onPurity(String(verdict.pureza_sugerida))}>Usar pureza respaldada por las pruebas: {verdict.pureza_sugerida}</button>}
    </div>
    {pending.length > 0 ? <div className="rounded-lg border border-slate-300 bg-white p-3 text-sm"><strong>Pendiente:</strong> {pending.join(", ")}.</div>
      : verdict && <div role="status" className={`rounded-lg border-2 p-3 text-sm ${verdict.estado === "APTA" ? "border-green-500 bg-green-50" : verdict.estado === "JUSTIFICAR" ? "border-amber-500 bg-amber-50" : "border-red-500 bg-red-50"}`}>
        <p className="text-base font-bold">{verdict.estado === "APTA" ? "✓ Apta para compra" : verdict.estado === "JUSTIFICAR" ? "Requiere justificación" : "✕ No comprar"}{verdict.pureza_maxima && <span className="ml-2 text-sm font-normal">Pureza respaldada: hasta {verdict.pureza_maxima}</span>}</p>
        {verdict.motivos.map(m => <p key={m}>• {m}</p>)}{verdict.avisos.map(a => <p key={a} className="text-amber-800">⚠ {a}</p>)}
      </div>}
    {(verdict?.estado === "JUSTIFICAR" || value.justificacion) && <label className="block text-sm font-medium">Justificación de la pureza (mín. 15 caracteres)<textarea className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm" maxLength={500} value={value.justificacion || ""} onChange={e => set({ justificacion: e.target.value || undefined })} /></label>}
  </div>;
}
