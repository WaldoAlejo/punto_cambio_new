// Guía visual de reconocimiento de oro y plata, alineada a la capacitación
// «Reconocimiento de oro» (Rashell Silva) que recibió el personal de Punto Cambio.
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DENSITY_TABLE, GOLD_COLORS, GOLD_KARATS, MATERIALS, REACTIONS, SILVER_GRADES, STEPS, type Reaccion } from "../../../server/utils/metalEvaluation";
import { ALLOYS } from "./metalGuideData";
import { AlloyBar, FileTest, HallmarkStamp, MagnetTest, PurityBar, ReactionSwatch, SealLocation, WearCheck } from "./MetalIllustrations";
import MetalPhotoExamples from "./MetalPhotoExamples";
import { EXAMPLES, PHOTOS, type ExampleKey, type PhotoKey } from "./metalPhotos";

function Photo({ id, caption = true }: { id: PhotoKey; caption?: boolean }) {
  const p = PHOTOS[id];
  return <figure className="overflow-hidden rounded-lg border bg-white"><img src={`/metal-guide/${p.src}`} alt={p.alt} loading="lazy" className="h-36 w-full object-cover" />{caption && <figcaption className="p-2 text-xs text-slate-600">{p.caption}</figcaption>}</figure>;
}
const STEP_EXAMPLE: Partial<Record<number, ExampleKey>> = { 2: "color", 3: "sello", 4: "iman", 5: "piedra", 6: "lima", 7: "acido" };
const verdictClass = { ok: "border-green-300 bg-green-50", warn: "border-amber-300 bg-amber-50", no: "border-red-300 bg-red-50" };

const STEP_VISUAL: Record<number, React.ReactNode> = {
  1: <Photo id="acidos" caption={false} />,
  2: <div className="flex justify-around rounded-lg border bg-white p-2"><WearCheck worn={false} /><WearCheck worn /></div>,
  3: <div className="rounded-lg border bg-white p-2"><SealLocation /></div>,
  4: <div className="flex justify-around rounded-lg border bg-white p-2"><MagnetTest attracts={false} /><MagnetTest attracts /></div>,
  5: <Photo id="piedra-toque" caption={false} />,
  6: <div className="flex justify-around rounded-lg border bg-white p-2"><FileTest plated={false} /><FileTest plated /></div>,
  7: <div className="flex flex-wrap justify-around gap-2 rounded-lg border bg-white p-2">{(["NINGUNA", "CAFE", "VERDE"] as Reaccion[]).map(r => <div key={r} className="text-center text-xs"><ReactionSwatch reaccion={r} /><p>{REACTIONS[r].nombre}</p></div>)}</div>,
};

export function KaratTable({ selected, onSelect }: { selected?: number; onSelect?: (pureza: number) => void }) {
  return <div className="overflow-auto"><table className="w-full min-w-[640px] text-left text-sm">
    <thead><tr className="text-slate-600">{["Quilates", "Sello", "Pureza", "% oro fino", "Reacción al ácido", ""].map((h, i) => <th key={i} className="p-2">{h}</th>)}</tr></thead>
    <tbody>{GOLD_KARATS.map(k => <tr key={k.codigo} className={`border-t ${selected === k.pureza ? "bg-amber-50" : ""}`}>
      <td className="p-2 text-base font-semibold">{k.codigo}</td>
      <td className="p-2"><div className="flex gap-1"><HallmarkStamp text={k.codigo} className="h-8 w-14" /><HallmarkStamp text={String(k.pureza)} className="h-8 w-14" /></div></td>
      <td className="p-2">{k.pureza}</td>
      <td className="w-32 p-2"><PurityBar pureza={k.pureza} /><span className="text-xs">{(k.pureza / 10).toFixed(1).replace(".", ",")}%</span></td>
      <td className="p-2"><div className="flex items-center gap-2"><ReactionSwatch reaccion={k.reaccion} className="h-10 w-16" /><span>{REACTIONS[k.reaccion].nombre}</span></div></td>
      <td className="p-2">{onSelect && <button type="button" className="rounded border px-2 py-1 text-xs hover:bg-slate-50" onClick={() => onSelect(k.pureza)}>Usar {k.pureza}</button>}</td>
    </tr>)}</tbody></table></div>;
}

export function RejectReactions() {
  return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{(["VERDE", "BLANCO", "DORADO", "AMARILLENTA"] as Reaccion[]).map(r => <div key={r} className={`rounded-lg border p-3 ${verdictClass.no}`}>
    <ReactionSwatch reaccion={r} bubbles={r === "VERDE" ? "EFERVESCENCIA" : undefined} className="h-16 w-24" /><p className="mt-1 font-semibold">{REACTIONS[r].nombre}</p><p className="text-xs">{REACTIONS[r].descripcion}</p><p className="mt-1 text-xs font-semibold text-red-700">No se compra</p></div>)}</div>;
}

export default function MetalGuide() {
  return <Tabs defaultValue="proceso" className="w-full">
    <TabsList className="flex h-auto flex-wrap justify-start">
      {[["proceso", "Proceso"], ["resultados", "Bueno vs malo (fotos)"], ["herramientas", "Herramientas"], ["quilates", "Quilates y ácido"], ["tipos", "Tipos de oro"], ["plata", "Plata"], ["no", "No comprar"], ["creditos", "Créditos"]].map(([v, l]) => <TabsTrigger key={v} value={v}>{l}</TabsTrigger>)}
    </TabsList>
    <TabsContent value="proceso" className="space-y-3">
      <p className="text-sm text-slate-600">Siga los pasos en orden. Registre cada resultado en la pieza; el sistema no permite confirmar una compra si una prueba indica que no es oro o plata.</p>
      <div className="grid gap-3 md:grid-cols-2">{STEPS.map(s => <div key={s.paso} className="rounded-lg border bg-slate-50 p-3"><div className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-500 text-sm font-bold text-white">{s.paso}</span><h3 className="font-semibold">{s.titulo}</h3></div><p className="my-2 text-sm">{s.texto}</p>{STEP_VISUAL[s.paso]}{(() => { const example = STEP_EXAMPLE[s.paso]; return example && <MetalPhotoExamples step={example} compact />; })()}</div>)}</div>
      <div className={`rounded-lg border p-3 text-sm ${verdictClass.warn}`}><strong>Seguridad:</strong> use ácido no vencido, con las mezclas exactas, y siempre con guantes para evitar lesiones.</div>
    </TabsContent>
    <TabsContent value="resultados" className="space-y-5">
      <p className="text-sm text-slate-600">Para cada prueba: cómo se hace, cómo se ve un resultado bueno y cómo se ve uno malo. Toque una foto para ampliarla.</p>
      {(Object.keys(EXAMPLES) as ExampleKey[]).map((k, i) => <section key={k}><h3 className="mb-2 font-semibold">{i + 1}. {EXAMPLES[k].titulo}</h3><MetalPhotoExamples step={k} /></section>)}
    </TabsContent>
    <TabsContent value="herramientas">
      <p className="mb-3 text-sm text-slate-600">Herramientas adecuadas para una prueba eficaz.</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {(["piedra-toque-juego", "acidos", "acidos-joyero", "guantes-nitrilo", "piedra", "lija", "lijas-numeradas", "limas", "limas-joyero", "lupa", "lupa-en-mano", "iman-neodimio", "balanza"] as PhotoKey[]).map(id => <Photo key={id} id={id} />)}
      </div>
    </TabsContent>
    <TabsContent value="quilates" className="space-y-4">
      <h3 className="font-semibold">Clasificación del oro según su pureza</h3><KaratTable />
      <h3 className="font-semibold">Reacciones de rechazo</h3><RejectReactions />
      <h3 className="font-semibold">Prueba de densidad / peso específico</h3>
      <div className="grid gap-3 rounded-lg border bg-slate-50 p-3 text-sm md:grid-cols-2"><div><p><strong>Densidad = peso en el aire ÷ (peso en el aire − peso sumergido).</strong></p><p className="mt-1">Pese la pieza seca. Luego cuélguela de un hilo dentro de un vaso con agua sobre la balanza, sin tocar fondo ni paredes, y anote el peso sumergido. Confiable desde 5 g; no sirve para piezas huecas o con piedras.</p></div><table className="w-full text-left"><tbody>{DENSITY_TABLE.map(r => <tr key={r.material} className="border-t"><td className="py-0.5">{r.material}</td><td className="text-right font-mono">{r.rango} g/cm³</td></tr>)}</tbody></table></div>
      <h3 className="font-semibold">Fotos reales de la capacitación</h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(["reaccion-18k", "reaccion-oro-blanco", "oro-intacto-cobre-disuelto", "reaccion-14k", "reaccion-14k-lamina", "reaccion-10k", "intensidad", "cobre-reaccion-verde", "cobre-disuelto-azul"] as PhotoKey[]).map(id => <Photo key={id} id={id} />)}
      </div>
    </TabsContent>
    <TabsContent value="tipos" className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">{GOLD_COLORS.map(c => <div key={c.codigo} className="rounded-lg border p-3"><h3 className="font-semibold">{c.nombre}</h3><p className="mb-2 text-xs text-slate-600">{c.descripcion}</p>{ALLOYS[c.codigo].map(a => <div key={a.quilates} className="mb-2"><p className="text-sm font-medium">{a.quilates}</p><AlloyBar parts={a.parts} /></div>)}</div>)}</div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{(["anillos-oro", "oro-fino-24k", "oro-blanco-750", "oro-blanco-rodinado", "metales-de-aleacion", "plata-y-cobre"] as PhotoKey[]).map(id => <Photo key={id} id={id} />)}</div>
      <div className="rounded-lg border p-3 text-sm"><h3 className="font-semibold">Materiales comerciales</h3><p><strong>Platino:</strong> blando, dúctil, blanco grisáceo. <strong>Rodio:</strong> duro, blanco plateado; se aplica como baño (galvanoplastia). <strong>Paladio:</strong> blanco plateado; fundamental para producir oro blanco.</p><p className="mt-1 text-xs text-slate-600">Este módulo registra compras de oro y plata. El rodio suele ser solo el baño del oro blanco; la ley se evalúa sobre el oro.</p></div>
    </TabsContent>
    <TabsContent value="plata" className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <Photo id="sello-plata-925" />
        <div className="space-y-2 rounded-lg border p-3 text-sm"><p><strong>Plata:</strong> color blanco, blanda, sello 925 y reacción blanco lechoso.</p>
          <p className="rounded bg-amber-50 p-2">La capacitación ubica la plata entre los <strong>materiales no comerciales para la compra de oro</strong>: una pieza de plata (aunque esté bañada en oro o tenga color dorado) <strong>nunca se paga como oro</strong>. Punto Cambio la compra solo como <strong>plata</strong>, con su propia ley y precio por gramo.</p>
          <div className="flex items-center gap-3"><ReactionSwatch reaccion="BLANCO_LECHOSO" metal="PLATA" /><span>Reacción esperada: <strong>blanco lechoso</strong></span></div>
          <div className="flex items-center gap-3"><ReactionSwatch reaccion="NINGUNA" metal="PLATA" /><span className="text-red-700">Sin reacción y blanco opaco: posible <strong>acero</strong>. No se compra.</span></div>
          <table className="w-full text-left"><tbody>{SILVER_GRADES.map(g => <tr key={g.codigo} className="border-t"><td className="py-1"><HallmarkStamp text={g.codigo} className="h-7 w-12" /></td><td>{g.nombre}</td><td className="w-24"><PurityBar pureza={g.pureza} metal="PLATA" /></td></tr>)}</tbody></table></div>
      </div>
    </TabsContent>
    <TabsContent value="no" className="space-y-3">
      <p className="text-sm text-slate-600">Materiales no comerciales: el sistema bloquea la compra cuando se registran. La plata también es no comercial <strong>como oro</strong>: se registra y se paga solo como plata.</p>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">{MATERIALS.filter(m => m.codigo !== "NINGUNO").map(m => <div key={m.codigo} className={`rounded-lg border p-3 ${verdictClass.no}`}><h3 className="font-semibold">{m.nombre}</h3><p className="text-sm">{m.descripcion}</p></div>)}</div>
      <div className="grid gap-3 sm:grid-cols-3"><div className={`rounded-lg border p-2 text-center ${verdictClass.no}`}><MagnetTest attracts /></div><div className={`rounded-lg border p-2 text-center ${verdictClass.no}`}><FileTest plated /></div><div className={`rounded-lg border p-2 text-center ${verdictClass.no}`}><WearCheck worn /></div></div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{(["laton-joyas", "laton-banado", "banado-desgastado", "hierro-oxidado", "iman-atrae", "cobre-reaccion-verde"] as PhotoKey[]).map(id => <Photo key={id} id={id} />)}</div>
    </TabsContent>
    <TabsContent value="creditos" className="text-sm">
      <p className="mb-2">Contenido basado en la capacitación «Reconocimiento de oro — Pasos para reconocer el oro» (Rashell Silva). Las fotos de reacciones y herramientas provienen de ese material. Las ilustraciones de la guía son propias.</p>
      <p className="font-semibold">Fotografías con licencia abierta (Wikimedia Commons, Flickr, Museums Victoria)</p>
      <ul className="list-disc space-y-0.5 pl-5">{Object.values(PHOTOS).filter(p => p.credit.url).map(p => <li key={p.src}>«{p.credit.titulo}» — {p.credit.autor}, {p.credit.licencia}. <a className="text-blue-700 underline" href={p.credit.url} target="_blank" rel="noreferrer">Fuente</a></li>)}</ul>
      <p className="mt-2 text-xs text-slate-600">Imágenes reducidas para la web; se mantiene la atribución que exigen sus licencias.</p>
    </TabsContent>
  </Tabs>;
}
