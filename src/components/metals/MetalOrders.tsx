// Órdenes de trabajo «Evaluación de oro»: recepción, autorización firmada, evaluación, oferta y cierre.
import { useCallback, useEffect, useRef, useState } from "react";
import { apiService } from "@/services/apiService";
import { Button } from "@/components/ui/button";
import type { User } from "@/types";
import { DENSITY_MIN_WEIGHT, DENSITY_TABLE, densityOf, densityReading, type Metal } from "../../../server/utils/metalEvaluation";
import MetalLineEvaluation from "./MetalLineEvaluation";
import MetalOrderPrint from "./MetalOrderPrint";
import { blankEvaluation, pendingSteps, verdictOf, type EvaluationDraft } from "./metalGuideData";
import { compressImage, gye, JEWEL_TYPES, jewelTypeLabel, money, PROCESS_LABELS, STATE_LABEL, type Client, type Order, type OrderJewel, type OrderRow, type Safety } from "./metalOrderTypes";

const inputClass = "mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-100";
function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) { return <label className={`block text-sm font-medium text-slate-700 ${className}`}>{label}{children}</label>; }
const Badge = ({ estado }: { estado: Order["estado"] }) => <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATE_LABEL[estado].clase}`}>{STATE_LABEL[estado].texto}</span>;
const CONSERVATION = ["Bueno", "Regular", "Desgastado", "Deteriorado", "Roto / incompleto"];
const COLORS = ["Amarillo", "Blanco", "Rosado / rojo", "Plateado", "Bicolor", "Tricolor"];
type Work = (fn: () => Promise<void>) => Promise<void>;
type Props = { user: User; enabled: boolean; currencies: { id: string; codigo: string }[]; work: Work; busy: boolean; onPay: (order: Order) => void; onViewPurchase: (id: string) => void; reloadToken: number };

export default function MetalOrders({ user, enabled, currencies, work, busy, onPay, onViewPurchase, reloadToken }: Props) {
  const operator = user.rol === "OPERADOR";
  const [rows, setRows] = useState<OrderRow[]>([]), [count, setCount] = useState(0), [page, setPage] = useState(1);
  const [estado, setEstado] = useState(operator ? "ABIERTAS" : ""), [search, setSearch] = useState("");
  const [view, setView] = useState<"lista" | "nueva" | "detalle">("lista"), [order, setOrder] = useState<Order | null>(null);
  const request = useRef(0);
  const load = useCallback(async () => {
    const n = ++request.current;
    const q = new URLSearchParams({ pagina: String(page), ...(estado ? { estado } : {}), ...(search.trim() ? { buscar: search.trim() } : {}) });
    const data = await apiService.get<{ ordenes: OrderRow[]; cantidad: number }>(`/metal-purchases/ordenes?${q}`);
    if (n === request.current) { setRows(data.ordenes); setCount(data.cantidad); }
  }, [page, estado, search]);
  useEffect(() => { void load().catch(() => undefined); }, [load, reloadToken]);
  const open = (id: string) => work(async () => { setOrder((await apiService.get<{ orden: Order }>(`/metal-purchases/ordenes/${id}`)).orden); setView("detalle"); });
  const updated = (o: Order) => { setOrder(o); void load(); };

  if (view === "nueva") return <NewOrder work={work} busy={busy} onCancel={() => setView("lista")} onCreated={o => { updated(o); setView("detalle"); }} />;
  if (view === "detalle" && order) return <OrderDetail order={order} operator={operator} currencies={currencies} work={work} busy={busy} onBack={() => { setView("lista"); setOrder(null); void load(); }} onUpdated={updated} onPay={onPay} onViewPurchase={onViewPurchase} />;
  return <section className="metal-no-print rounded-lg border bg-white p-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">Órdenes de trabajo – Evaluación de oro</h2><p className="text-sm text-slate-600">Toda compra empieza con una orden firmada por el cliente antes de cualquier prueba.</p></div>
      {operator && enabled && <Button onClick={() => setView("nueva")}>+ Nueva orden de evaluación</Button>}</div>
    <div className="my-3 flex flex-wrap items-end gap-3">
      <Field label="Estado"><select className={inputClass} value={estado} onChange={e => { setEstado(e.target.value); setPage(1); }}><option value="ABIERTAS">Abiertas (en curso)</option><option value="">Todas</option>{Object.entries(STATE_LABEL).map(([k, v]) => <option key={k} value={k}>{v.texto}</option>)}</select></Field>
      <Field label="Buscar Nº de orden, nombre o C.I."><input className={inputClass} maxLength={100} value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} /></Field>
      <Button variant="outline" disabled={busy} onClick={() => void work(load)}>Actualizar</Button>
    </div>
    <div className="overflow-auto"><table className="w-full text-left text-sm"><thead><tr className="text-slate-600">{["Nº de orden", "Fecha", "Cliente", "Joyas", "Estado", "Oferta", ""].map((h, i) => <th key={i} className="p-2">{h}</th>)}</tr></thead>
      <tbody>{rows.map(r => <tr key={r.id} className="border-t"><td className="p-2 font-semibold">{r.numero}</td><td className="p-2">{gye(r.fecha)}<br /><span className="text-xs text-slate-500">{r.punto_nombre} · {r.asesor_nombre}</span></td><td className="p-2">{r.cliente.nombre}<br /><span className="text-xs text-slate-500">{r.cliente.documento}</span></td><td className="p-2">{r._count.joyas}</td><td className="p-2"><Badge estado={r.estado} /></td><td className="p-2">{r.oferta_total ? `${r.moneda?.codigo ?? ""} ${money(r.oferta_total)}` : "—"}</td><td className="p-2"><Button variant="outline" size="sm" disabled={busy} onClick={() => void open(r.id)}>Abrir</Button></td></tr>)}</tbody></table></div>
    {!rows.length && <p className="p-3 text-sm text-slate-600">No hay órdenes en este filtro.</p>}
    <div className="mt-3 flex items-center gap-3"><Button variant="outline" disabled={page === 1} onClick={() => setPage(page - 1)}>Anterior</Button><span className="text-sm">Página {page} · {count} órdenes</span><Button variant="outline" disabled={page * 25 >= count} onClick={() => setPage(page + 1)}>Siguiente</Button></div>
  </section>;
}

// ===== 1. Recepción: datos del cliente y de las joyas, foto antes =====
type JewelDraft = { tipo: string; descripcion: string; piezas: number; peso_recibido: string; color: string; estado_conservacion: string; piedras: string; foto_antes?: string };
const blankJewel = (): JewelDraft => ({ tipo: "ANILLO", descripcion: "", piezas: 1, peso_recibido: "", color: "Amarillo", estado_conservacion: "Bueno", piedras: "" });
function NewOrder({ work, busy, onCancel, onCreated }: { work: Work; busy: boolean; onCancel: () => void; onCreated: (o: Order) => void }) {
  const [client, setClient] = useState<Client>({ nombre: "", documento: "", telefono: "", direccion: "", procedencia: "" });
  const [jewels, setJewels] = useState<JewelDraft[]>([blankJewel()]), [notes, setNotes] = useState("");
  const [processes, setProcesses] = useState<string[]>(["ACIDO", "PIEDRA_TOQUE"]), [otherProcess, setOtherProcess] = useState("");
  const key = useRef(crypto.randomUUID());
  const setJewel = (i: number, patch: Partial<JewelDraft>) => setJewels(list => list.map((j, n) => n === i ? { ...j, ...patch } : j));
  const submit = () => work(async () => {
    jewels.forEach((j, i) => { if (!j.foto_antes) throw new Error(`Joya ${i + 1}: tome la foto antes de la evaluación.`); });
    if (!processes.length) throw new Error("Marque los procesos a realizar que el cliente autorizará.");
    if (processes.includes("OTRO") && !otherProcess.trim()) throw new Error("Describa el proceso marcado como «Otros».");
    const result = await apiService.post<{ orden: Order }>("/metal-purchases/ordenes", { cliente: client, observaciones_cliente: notes, procesos: processes, otros_procesos: otherProcess, joyas: jewels }, key.current);
    key.current = crypto.randomUUID(); onCreated(result.orden);
  });
  return <form className="metal-no-print space-y-4" onSubmit={e => { e.preventDefault(); void submit(); }}><fieldset disabled={busy} className="space-y-4">
    <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Nueva orden de trabajo – Evaluación</h2><Button type="button" variant="ghost" onClick={onCancel}>← Volver a órdenes</Button></div>
    <section className="rounded-lg border bg-white p-4"><h3 className="mb-2 font-semibold">1. Datos del cliente</h3><div className="grid gap-3 md:grid-cols-2">
      {([["nombre", "Nombre completo", 200], ["documento", "C.I. / Pasaporte", 40], ["telefono", "Teléfono", 40], ["direccion", "Dirección", 300]] as const).map(([k, l, max]) => <Field key={k} label={l}><input className={inputClass} required maxLength={max} value={client[k]} onChange={e => setClient({ ...client, [k]: e.target.value })} /></Field>)}
      <Field label="Procedencia declarada de las joyas" className="md:col-span-2"><textarea className={inputClass} required maxLength={1000} value={client.procedencia} onChange={e => setClient({ ...client, procedencia: e.target.value })} /></Field>
    </div></section>
    {jewels.map((j, i) => <section key={i} className="rounded-lg border bg-white p-4"><div className="flex justify-between"><h3 className="font-semibold">2. Datos de la joya {i + 1}</h3>{jewels.length > 1 && <Button type="button" variant="ghost" onClick={() => setJewels(jewels.filter((_, n) => n !== i))}>Quitar</Button>}</div>
      <div className="mt-2 grid gap-3 md:grid-cols-3">
        <Field label="Tipo de joya"><select className={inputClass} value={j.tipo} onChange={e => setJewel(i, { tipo: e.target.value })}>{JEWEL_TYPES.map(([c, l]) => <option key={c} value={c}>{l}</option>)}</select></Field>
        <Field label="Descripción" className="md:col-span-2"><input className={inputClass} required maxLength={300} placeholder="Ej. anillo liso con grabado interior" value={j.descripcion} onChange={e => setJewel(i, { descripcion: e.target.value })} /></Field>
        <Field label="Peso recibido (g)"><input className={inputClass} type="number" required min="0.001" step="0.001" value={j.peso_recibido} onChange={e => setJewel(i, { peso_recibido: e.target.value })} /></Field>
        <Field label="Cantidad de piezas"><input className={inputClass} type="number" required min="1" max="1000" value={j.piezas} onChange={e => setJewel(i, { piezas: Number(e.target.value) })} /></Field>
        <Field label="Color"><input className={inputClass} required maxLength={60} list="metal-colors" value={j.color} onChange={e => setJewel(i, { color: e.target.value })} /></Field>
        <Field label="Estado de conservación"><input className={inputClass} required maxLength={200} list="metal-conservation" value={j.estado_conservacion} onChange={e => setJewel(i, { estado_conservacion: e.target.value })} /></Field>
        <Field label="Piedras / elementos adicionales" className="md:col-span-2"><input className={inputClass} maxLength={300} placeholder="Ninguno, o describa piedras, resortes, partes no metálicas…" value={j.piedras} onChange={e => setJewel(i, { piedras: e.target.value })} /></Field>
        <Field label="Foto antes de la evaluación (obligatoria)" className="md:col-span-2"><input className={inputClass} type="file" accept="image/*" capture="environment" onChange={e => { const file = e.target.files?.[0]; void work(async () => setJewel(i, { foto_antes: await compressImage(file) })); }} /></Field>
        {j.foto_antes && <img src={j.foto_antes} alt={`Joya ${i + 1} antes de la evaluación`} className="h-28 rounded border object-cover" />}
      </div>
    </section>)}
    <datalist id="metal-colors">{COLORS.map(c => <option key={c} value={c} />)}</datalist><datalist id="metal-conservation">{CONSERVATION.map(c => <option key={c} value={c} />)}</datalist>
    {jewels.length < 20 && <Button type="button" variant="outline" onClick={() => setJewels([...jewels, blankJewel()])}>+ Agregar otra joya</Button>}
    <section className="rounded-lg border bg-white p-4"><h3 className="mb-2 font-semibold">3. Observaciones del cliente sobre la joya</h3><textarea className={inputClass} maxLength={1000} value={notes} onChange={e => setNotes(e.target.value)} /></section>
    <section className="rounded-lg border bg-white p-4"><h3 className="font-semibold">4. Procesos a realizar</h3><p className="mb-2 text-sm text-slate-600">Marque las pruebas que hará. Saldrán marcadas en la orden que firma el cliente; después no podrá hacer pruebas que no estén autorizadas.</p>
      <div className="grid gap-2 md:grid-cols-2">{Object.entries(PROCESS_LABELS).map(([code, label]) => <label key={code} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={processes.includes(code)} onChange={e => setProcesses(list => e.target.checked ? [...list, code] : list.filter(p => p !== code))} />{label}</label>)}</div>
      {processes.includes("OTRO") && <Field label="Describa «Otros»"><input className={inputClass} maxLength={200} value={otherProcess} onChange={e => setOtherProcess(e.target.value)} /></Field>}</section>
    <p className="rounded bg-amber-50 p-3 text-sm">Al guardar se genera el <strong>Nº de orden</strong>. Imprímala y haga firmar la autorización al cliente <strong>antes de cualquier prueba</strong>.</p>
    <Button type="submit" disabled={busy}>Guardar y generar orden</Button>
  </fieldset></form>;
}

// ===== Detalle y acciones por estado =====
function OrderDetail({ order, operator, currencies, work, busy, onBack, onUpdated, onPay, onViewPurchase }: { order: Order; operator: boolean; currencies: { id: string; codigo: string }[]; work: Work; busy: boolean; onBack: () => void; onUpdated: (o: Order) => void; onPay: (o: Order) => void; onViewPurchase: (id: string) => void }) {
  const [printing, setPrinting] = useState(false), [editEval, setEditEval] = useState(order.estado === "AUTORIZADA");
  useEffect(() => setEditEval(order.estado === "AUTORIZADA"), [order.estado]);
  const act = (path: string, body: unknown) => work(async () => onUpdated((await apiService.post<{ orden: Order }>(`/metal-purchases/ordenes/${order.id}/${path}`, body)).orden));
  if (printing) return <div><div className="metal-no-print mb-3 flex gap-3"><Button onClick={() => window.print()}>Imprimir</Button><Button variant="outline" onClick={() => setPrinting(false)}>Volver a la orden</Button></div><MetalOrderPrint order={order} />
    <style>{`@media print { body * { visibility: hidden; } #metal-order-print, #metal-order-print * { visibility: visible; } #metal-order-print { position: absolute; left: 0; top: 0; width: 100%; padding: 0; } .metal-no-print { display: none !important; } @page { size: A4; margin: 8mm; } }`}</style></div>;
  const c = order.cliente;
  return <div className="metal-no-print space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><Button variant="ghost" onClick={onBack}>← Volver a órdenes</Button><Button variant="outline" onClick={() => setPrinting(true)}>🖨 Ver / imprimir orden</Button></div>
    <section className="rounded-lg border bg-white p-4">
      <div className="flex flex-wrap items-center gap-3"><h2 className="text-xl font-bold">{order.numero}</h2><Badge estado={order.estado} /></div>
      <p className="text-sm text-slate-600">{gye(order.fecha)} · {order.punto_nombre} · Asesor(a): {order.asesor_nombre}</p>
      <div className="mt-3 grid gap-2 text-sm md:grid-cols-2"><p><strong>Cliente:</strong> {c.nombre} · C.I. {c.documento}</p><p><strong>Teléfono:</strong> {c.telefono}</p><p><strong>Dirección:</strong> {c.direccion}</p><p><strong>Procedencia:</strong> {c.procedencia}</p>{order.observaciones_cliente && <p className="md:col-span-2"><strong>Observaciones del cliente:</strong> {order.observaciones_cliente}</p>}</div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">{order.joyas.map(j => <div key={j.id} className="flex gap-3 rounded border p-2 text-sm"><img src={j.foto_antes} alt={`Joya ${j.posicion} antes`} className="h-20 w-20 rounded object-cover" />{j.foto_despues && <img src={j.foto_despues} alt={`Joya ${j.posicion} después`} className="h-20 w-20 rounded object-cover" />}<div><p className="font-semibold">#{j.posicion} {jewelTypeLabel(j.tipo)} · {j.descripcion}</p><p>{j.peso_recibido} g recibidos · {j.piezas} pieza(s) · {j.color}</p><p>Estado: {j.estado_conservacion}{j.piedras ? ` · Piedras: ${j.piedras}` : ""}</p>{j.subtotal && <p className="font-semibold">{j.metal} {j.pureza} · {j.peso_final} g × {j.precio_gramo} = {money(j.subtotal)}</p>}</div></div>)}</div>
    </section>

    {order.estado === "PENDIENTE_AUTORIZACION" && operator && <Authorize work={work} busy={busy} onPrint={() => setPrinting(true)} act={act} />}
    {order.autorizacion_foto && <details className="rounded-lg border bg-white p-3 text-sm"><summary className="cursor-pointer font-semibold">✓ Autorización firmada registrada {gye(order.autorizada_en)}</summary><img src={order.autorizacion_foto} alt="Orden firmada por el cliente" className="mt-2 max-h-[480px] rounded border" /></details>}

    {order.estado === "EVALUADA" && !editEval && <section className="rounded-lg border-2 border-violet-300 bg-violet-50 p-4">
      <p className="text-sm font-semibold uppercase text-violet-900">Valoración / precio ofrecido</p><p className="text-3xl font-bold">{order.moneda?.codigo} {money(order.oferta_total)}</p>
      {order.resultado_observaciones && <p className="mt-1 text-sm">{order.resultado_observaciones}</p>}
      {operator && <><div className="mt-3 flex flex-wrap gap-3"><Button disabled={busy} onClick={() => onPay(order)}>✓ Cliente acepta: registrar pago</Button><Button variant="outline" disabled={busy} onClick={() => setEditEval(true)}>Corregir evaluación u oferta</Button></div>
        <ReturnJewels act={act} busy={busy} /></>}
    </section>}
    {(order.estado === "AUTORIZADA" || (order.estado === "EVALUADA" && editEval)) && operator && <Evaluate order={order} currencies={currencies} busy={busy} act={act} onCancel={order.estado === "EVALUADA" ? () => setEditEval(false) : undefined} />}
    {order.estado === "AUTORIZADA" && operator && <section className="rounded-lg border bg-white p-4"><ReturnJewels act={act} busy={busy} /></section>}

    {order.estado === "COMPRADA" && order.compra && <section className="rounded-lg border border-green-300 bg-green-50 p-4 text-sm"><p className="font-semibold">Compra registrada: {order.compra.numero} ({order.compra.estado})</p><Button className="mt-2" variant="outline" onClick={() => order.compra && onViewPurchase(order.compra.id)}>Ver recibo de compra</Button></section>}
    {(order.estado === "DEVUELTA" || order.estado === "ANULADA") && <section className="rounded-lg border bg-slate-50 p-4 text-sm"><p className="font-semibold">{order.estado === "DEVUELTA" ? "Joyas devueltas al cliente" : "Orden anulada"} · {gye(order.cerrada_en)}</p><p>Motivo: {order.cierre?.motivo}</p>{order.cierre?.foto && <img src={order.cierre.foto} alt="Constancia de devolución" className="mt-2 max-h-72 rounded border" />}</section>}
  </div>;
}

function Authorize({ work, busy, onPrint, act }: { work: Work; busy: boolean; onPrint: () => void; act: (path: string, body: unknown) => Promise<void> }) {
  const [photo, setPhoto] = useState<string>(), [signed, setSigned] = useState(false), [reason, setReason] = useState("");
  return <section className="rounded-lg border-2 border-amber-400 bg-amber-50 p-4 space-y-3">
    <h3 className="font-semibold">Autorización del cliente (obligatoria antes de las pruebas)</h3>
    <ol className="list-decimal space-y-1 pl-5 text-sm"><li>Imprima la orden y léale al cliente la sección 3 (autorización).</li><li>Cliente y responsable firman la sección 7.</li><li>Tome una foto nítida de la orden firmada completa y regístrela aquí.</li></ol>
    <Button type="button" variant="outline" onClick={onPrint}>🖨 Imprimir orden para firma</Button>
    <Field label="Foto de la orden firmada"><input className={inputClass} type="file" accept="image/*" capture="environment" onChange={e => { const file = e.target.files?.[0]; void work(async () => setPhoto(await compressImage(file, { maxSide: 1800, maxChars: 650_000 }))); }} /></Field>
    {photo && <img src={photo} alt="Vista previa de la orden firmada" className="max-h-72 rounded border" />}
    <label className="flex gap-2 text-sm"><input type="checkbox" checked={signed} onChange={e => setSigned(e.target.checked)} />Verifiqué que la orden fotografiada tiene la firma del cliente y la del responsable.</label>
    <Button disabled={busy || !photo || !signed} onClick={() => void act("autorizar", { foto_autorizacion: photo, firmada: true })}>Registrar autorización e iniciar evaluación</Button>
    <details className="text-sm"><summary className="cursor-pointer text-red-800">El cliente no firmó: anular orden</summary><div className="mt-2 flex flex-wrap items-end gap-2"><Field label="Motivo"><input className={inputClass} maxLength={500} value={reason} onChange={e => setReason(e.target.value)} /></Field><Button variant="outline" disabled={busy || reason.trim().length < 3} onClick={() => void act("anular", { motivo: reason })}>Anular orden</Button></div></details>
  </section>;
}

function ReturnJewels({ act, busy }: { act: (path: string, body: unknown) => Promise<void>; busy: boolean }) {
  const [reason, setReason] = useState(""), [returned, setReturned] = useState(false), [photo, setPhoto] = useState<string>();
  return <details className="mt-3 text-sm"><summary className="cursor-pointer font-semibold text-slate-700">✕ Cliente no acepta: devolver joyas y cerrar la orden</summary><div className="mt-2 space-y-2">
    <Field label="Motivo"><input className={inputClass} maxLength={500} placeholder="Ej. no aceptó el precio ofrecido" value={reason} onChange={e => setReason(e.target.value)} /></Field>
    <Field label="Foto de constancia de devolución (opcional)"><input className={inputClass} type="file" accept="image/*" capture="environment" onChange={e => { const file = e.target.files?.[0]; void compressImage(file, { maxSide: 1800, maxChars: 650_000 }).then(setPhoto).catch(() => setPhoto(undefined)); }} /></Field>
    <label className="flex gap-2"><input type="checkbox" checked={returned} onChange={e => setReturned(e.target.checked)} />Entregué todas las joyas al cliente en el estado registrado.</label>
    <Button variant="outline" disabled={busy || !returned || reason.trim().length < 3} onClick={() => void act("devolver", { motivo: reason, joyas_devueltas: true, ...(photo ? { foto: photo } : {}) })}>Registrar devolución</Button>
  </div></details>;
}

// ===== 4–6. Pruebas, resultado y oferta =====
type EvalDraft = { metal: Metal; metodo: "ACIDO" | "XRF" | "OTRO"; pureza: string; pureza_declarada: string; deducciones: string; precio_gramo: string; observaciones: string; foto_despues?: string; evaluacion: EvaluationDraft; densidad: boolean; aire: string; agua: string };
function draftFrom(j: OrderJewel): EvalDraft {
  const e = j.evaluacion ?? undefined, metal = j.metal ?? "ORO";
  const { resultado: _r, avisos: _a, pureza_maxima: _p, seguridad: _s, densidad, ...evaluacion } = e ?? {};
  return { metal, metodo: j.metodo ?? "ACIDO", pureza: j.pureza ?? (metal === "ORO" ? "750" : "925"), pureza_declarada: j.pureza_declarada, deducciones: j.deducciones ?? "0", precio_gramo: j.precio_gramo ?? "", observaciones: j.observaciones, foto_despues: j.foto_despues ?? undefined,
    evaluacion: e ? evaluacion : blankEvaluation(metal), densidad: !!densidad, aire: densidad?.peso_aire ?? j.peso_recibido, agua: densidad?.peso_agua ?? "" };
}
function Evaluate({ order, currencies, busy, act, onCancel }: { order: Order; currencies: { id: string; codigo: string }[]; busy: boolean; act: (path: string, body: unknown) => Promise<void>; onCancel?: () => void }) {
  const [drafts, setDrafts] = useState<EvalDraft[]>(() => order.joyas.map(draftFrom));
  const [currency, setCurrency] = useState(order.moneda?.id ?? currencies.find(c => c.codigo === "USD")?.id ?? currencies[0]?.id ?? "");
  const [safety, setSafety] = useState<Safety>(order.seguridad ?? { acido_vigente: false, guantes: false });
  const [others, setOthers] = useState(order.procesos?.otros ?? ""), [result, setResult] = useState(order.resultado_observaciones);
  const [error, setError] = useState("");
  const set = (i: number, patch: Partial<EvalDraft>) => setDrafts(list => list.map((d, n) => n === i ? { ...d, ...patch } : d));
  const patchEval = (i: number, patch: EvaluationDraft) => setDrafts(list => list.map((d, n) => n === i ? { ...d, evaluacion: { ...d.evaluacion, ...patch } } : d));
  const withDensity = (d: EvalDraft): EvaluationDraft => ({ ...d.evaluacion, ...(d.densidad ? { densidad: { peso_aire: d.aire, peso_agua: d.agua } } : { densidad: undefined }) });
  const usesAcid = drafts.some(d => d.metodo === "ACIDO");
  const authorized = order.procesos?.autorizados ?? [];
  const performed = (d: EvalDraft) => [d.metodo === "ACIDO" || (d.evaluacion.reaccion && d.evaluacion.reaccion !== "NO_REALIZADA") ? "ACIDO" : "", d.evaluacion.piedra && d.evaluacion.piedra !== "NO_REALIZADA" ? "PIEDRA_TOQUE" : "", d.densidad ? "DENSIDAD" : "", d.metodo === "XRF" ? "XRF" : "", d.metodo === "OTRO" ? "OTRO" : ""].filter(Boolean);
  const net = (j: OrderJewel, d: EvalDraft) => Math.max(0, Number(j.peso_recibido) - Number(d.deducciones || 0));
  const total = order.joyas.reduce((s, j, i) => s + Math.round(net(j, drafts[i]) * Number(drafts[i].precio_gramo || 0) * 100) / 100, 0);
  const save = () => {
    setError("");
    try {
      drafts.forEach((d, i) => {
        const pending = pendingSteps(d.evaluacion); if (pending.length) throw new Error(`Joya ${i + 1}: complete el reconocimiento (${pending.join(", ")}).`);
        const v = verdictOf(d.metal, d.metodo, d.pureza, withDensity(d)); if (v && v.estado !== "APTA") throw new Error(`Joya ${i + 1}: ${v.motivos.join(" ")}`);
        if (!(Number(d.precio_gramo) > 0)) throw new Error(`Joya ${i + 1}: indique el precio ofrecido por gramo.`);
      });
      const missing = [...new Set([...drafts.flatMap(performed), ...(others.trim() ? ["OTRO"] : [])])].filter(p => !authorized.includes(p));
      if (missing.length) throw new Error(`El cliente no autorizó: ${missing.map(p => PROCESS_LABELS[p]).join(", ")}. Solo puede hacer las pruebas marcadas en la orden firmada.`);
      if (usesAcid && !(safety.acido_vigente && safety.guantes)) throw new Error("Confirme que el ácido no está vencido y que usó guantes.");
    } catch (e) { setError((e as Error).message); return; }
    void act("evaluar", { moneda_id: currency, ...(usesAcid ? { seguridad: safety } : {}), otros_procesos: others, resultado_observaciones: result,
      joyas: order.joyas.map((j, i) => { const d = drafts[i]; return { id: j.id, metal: d.metal, metodo: d.metodo, pureza: d.pureza, pureza_declarada: d.pureza_declarada, deducciones: d.deducciones || "0", precio_gramo: d.precio_gramo, observaciones: d.observaciones, ...(d.foto_despues ? { foto_despues: d.foto_despues } : {}), evaluacion: withDensity(d) }; }) });
  };
  return <section className="space-y-4">
    <h3 className="text-lg font-semibold">4–6. Pruebas, resultado y oferta</h3>
    <p className="rounded bg-blue-50 p-3 text-sm"><strong>Procesos autorizados por el cliente:</strong> {authorized.map(p => PROCESS_LABELS[p] ?? p).join(" · ")}{order.procesos?.otros ? ` (${order.procesos.otros})` : ""}</p>
    {order.joyas.map((j, i) => { const d = drafts[i];
      const dens = d.densidad ? densityOf(Number(d.aire), Number(d.agua)) : null;
      return <div key={j.id} className="rounded-lg border bg-white p-4">
        <div className="flex gap-3"><img src={j.foto_antes} alt="" className="h-16 w-16 rounded object-cover" /><div><p className="font-semibold">Joya {j.posicion}: {jewelTypeLabel(j.tipo)} · {j.descripcion}</p><p className="text-sm text-slate-600">{j.peso_recibido} g recibidos · {j.color} · Piedras: {j.piedras || "ninguna"}</p></div></div>
        <div className="mt-3 grid gap-3 md:grid-cols-4">
          <Field label="Metal"><select className={inputClass} value={d.metal} onChange={e => { const metal = e.target.value as Metal; set(i, { metal, pureza: metal === "ORO" ? "750" : "925", evaluacion: blankEvaluation(metal) }); }}><option>ORO</option><option>PLATA</option></select></Field>
          <Field label="Método principal"><select className={inputClass} value={d.metodo} onChange={e => set(i, { metodo: e.target.value as EvalDraft["metodo"] })}><option value="ACIDO">Ácido / piedra de toque</option><option value="XRF">Electrónica (XRF)</option><option value="OTRO">Otro</option></select></Field>
          <Field label="Sello o ley declarada (opcional)"><input className={inputClass} maxLength={80} placeholder="Ej. 18K / 750" value={d.pureza_declarada} onChange={e => set(i, { pureza_declarada: e.target.value })} /></Field>
          <Field label="Deducciones: piedras y otros (g)"><input className={inputClass} type="number" min="0" step="0.001" value={d.deducciones} onChange={e => set(i, { deducciones: e.target.value })} /><small>Peso final: {net(j, d).toFixed(3)} g</small></Field>
        </div>
        <MetalLineEvaluation metal={d.metal} metodo={d.metodo} pureza={d.pureza} value={withDensity(d)} onChange={patch => patchEval(i, patch)} onPurity={pureza => set(i, { pureza })} />
        <div className="mt-3 rounded-lg border bg-slate-50 p-3">
          <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" disabled={!authorized.includes("DENSIDAD") && !d.densidad} checked={d.densidad} onChange={e => set(i, { densidad: e.target.checked })} />Prueba de densidad / peso específico{!authorized.includes("DENSIDAD") && <span className="font-normal text-slate-500">(no autorizada en esta orden)</span>}</label>
          {d.densidad && <div className="mt-2 grid gap-3 md:grid-cols-3">
            <Field label="Peso en el aire (g)"><input className={inputClass} type="number" min="0.001" step="0.001" value={d.aire} onChange={e => set(i, { aire: e.target.value })} /></Field>
            <Field label="Peso sumergido en agua (g)"><input className={inputClass} type="number" min="0.001" step="0.001" value={d.agua} onChange={e => set(i, { agua: e.target.value })} /></Field>
            <div className="text-sm">{dens ? <><p className="text-lg font-bold">{dens.toFixed(2)} g/cm³</p><p>{densityReading(d.metal, dens).texto}{Number(d.aire) < DENSITY_MIN_WEIGHT ? " (orientativa: menos de 5 g)" : ""}</p></> : <p className="text-slate-500">Ingrese ambos pesos.</p>}</div>
            <p className="text-xs text-slate-600 md:col-span-3">Cuelgue la pieza de un hilo dentro de un vaso con agua sobre la balanza, sin tocar el fondo ni las paredes. No use esta prueba en piezas huecas o con piedras. Referencia: {DENSITY_TABLE.map(r => `${r.material} ${r.rango}`).join(" · ")}.</p>
          </div>}
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <Field label="Precio ofrecido por gramo"><input className={inputClass} type="number" min="0.000001" step="0.000001" value={d.precio_gramo} onChange={e => set(i, { precio_gramo: e.target.value })} /><small>Subtotal: {money(String(Math.round(net(j, d) * Number(d.precio_gramo || 0) * 100) / 100))}</small></Field>
          <Field label="Observaciones de la joya"><input className={inputClass} maxLength={500} value={d.observaciones} onChange={e => set(i, { observaciones: e.target.value })} /></Field>
          <Field label="Foto después de la evaluación (opcional)"><input className={inputClass} type="file" accept="image/*" capture="environment" onChange={e => { const file = e.target.files?.[0]; void compressImage(file).then(foto => set(i, { foto_despues: foto })).catch(err => setError((err as Error).message)); }} />{d.foto_despues && <img src={d.foto_despues} alt="" className="mt-1 h-16 rounded object-cover" />}</Field>
        </div>
      </div>; })}
    {usesAcid && <section className="rounded-lg border border-amber-300 bg-amber-50 p-4"><h4 className="mb-2 font-semibold">Seguridad de la prueba con ácido</h4>
      <label className="flex gap-2 text-sm"><input type="checkbox" checked={safety.acido_vigente} onChange={e => setSafety({ ...safety, acido_vigente: e.target.checked })} />El ácido no está vencido y tiene las mezclas exactas</label>
      <label className="flex gap-2 text-sm"><input type="checkbox" checked={safety.guantes} onChange={e => setSafety({ ...safety, guantes: e.target.checked })} />Usé guantes durante la prueba</label></section>}
    <section className="grid gap-3 rounded-lg border bg-white p-4 md:grid-cols-3">
      <Field label="Moneda de la oferta"><select className={inputClass} value={currency} onChange={e => setCurrency(e.target.value)}>{currencies.map(c => <option key={c.id} value={c.id}>{c.codigo}</option>)}</select></Field>
      <Field label="Otros procesos realizados (opcional)"><input className={inputClass} maxLength={200} value={others} onChange={e => setOthers(e.target.value)} /></Field>
      <Field label="Observaciones / resultado"><input className={inputClass} maxLength={1000} value={result} onChange={e => setResult(e.target.value)} /></Field>
      <p className="text-2xl font-bold md:col-span-3">Precio a ofrecer: {currencies.find(c => c.id === currency)?.codigo} {money(String(total))}</p>
    </section>
    {error && <p role="alert" className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    <div className="flex gap-3"><Button disabled={busy} onClick={save}>Guardar resultado y oferta</Button>{onCancel && <Button variant="outline" onClick={onCancel}>Cancelar corrección</Button>}</div>
  </section>;
}
