import { useCallback, useEffect, useRef, useState } from "react";
import { apiService } from "@/services/apiService";
import { Button } from "@/components/ui/button";
import type { User, PuntoAtencion } from "@/types";

type Line = { metal: "ORO" | "PLATA"; descripcion: string; piezas: number; peso_bruto: string; deducciones: string; pureza_declarada: string; pureza: string; metodo: "ACIDO" | "XRF" | "OTRO"; observaciones: string; resultado_concluyente: true; precio_gramo: string; foto?: string };
type Seller = { nombre: string; documento: string; telefono: string; procedencia: string };
type Payload = { moneda_id: string; vendedor: Seller; detalles: Line[]; medio_pago: "EFECTIVO" | "TRANSFERENCIA"; billetes?: string; monedas?: string; banco?: string; referencia?: string; comprobante?: string };
type Quote = { total: string; detalles: (Line & { peso_neto: string; gramos_finos: string; subtotal: string })[] };
type Purchase = { id: string; numero: string; fecha: string; punto_nombre: string; operador_nombre: string; moneda_codigo: string; estado: string; total: string; medio_pago: string; vendedor: Seller; billetes: string; monedas: string; banco?: string; referencia?: string; comprobante?: string; detalles: (Quote["detalles"][number] & { codigo_pieza: string })[]; eventos: { id: string; accion: string; fecha: string; usuario_id: string; evidencia: Record<string, unknown> }[] };
type Row = Pick<Purchase, "id" | "numero" | "fecha" | "punto_nombre" | "operador_nombre" | "moneda_codigo" | "estado" | "total" | "medio_pago">;
type Point = { id: string; nombre: string; activo: boolean; configuracionMetales: { habilitado: boolean } | null };
type Summary = { moneda_codigo: string; medio_pago: string; estado: string; _sum: { total: string }; _count: number };
const blankLine = (): Line => ({ metal: "ORO", descripcion: "", piezas: 1, peso_bruto: "", deducciones: "0", pureza_declarada: "", pureza: "750", metodo: "ACIDO", observaciones: "", resultado_concluyente: true, precio_gramo: "" });
const emptySeller = (): Seller => ({ nombre: "", documento: "", telefono: "", procedencia: "" });
const inputClass = "mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-100";
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block text-sm font-medium text-slate-700">{label}{children}</label>; }
const money = (value: string) => Number(value).toLocaleString("es-EC", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
async function readPhoto(file?: File): Promise<string | undefined> {
  if (!file) return undefined;
  if (!["image/jpeg", "image/png"].includes(file.type) || file.size > 200000) throw new Error("Use una imagen JPG o PNG de hasta 200 KB.");
  return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error("No se pudo leer la imagen.")); reader.readAsDataURL(file); });
}
export default function MetalPurchases({ user, selectedPoint }: { user: User; selectedPoint: PuntoAtencion | null }) {
  const operator = user.rol === "OPERADOR", admin = ["ADMIN", "SUPER_USUARIO"].includes(user.rol);
  const [enabled, setEnabled] = useState(false), [currencies, setCurrencies] = useState<{ id: string; codigo: string }[]>([]);
  const [currency, setCurrency] = useState(""), [seller, setSeller] = useState<Seller>(emptySeller), [lines, setLines] = useState<Line[]>([blankLine()]);
  const [method, setMethod] = useState<"EFECTIVO" | "TRANSFERENCIA">("EFECTIVO");
  const [bills, setBills] = useState(""), [coins, setCoins] = useState("0"), [bank, setBank] = useState(""), [reference, setReference] = useState(""), [proof, setProof] = useState<string>();
  const [review, setReview] = useState<{ payload: Payload; quote: Quote } | null>(null);
  const [calculated, setCalculated] = useState<Quote | null>(null);
  const [receipt, setReceipt] = useState<Purchase | null>(null), [rows, setRows] = useState<Row[]>([]), [summaries, setSummaries] = useState<Summary[]>([]);
  const [page, setPage] = useState(1), [count, setCount] = useState(0), [from, setFrom] = useState(""), [to, setTo] = useState(""), [pointFilter, setPointFilter] = useState("");
  const [operatorFilter, setOperatorFilter] = useState("");
  const [metalTotals, setMetalTotals] = useState<{ metal: string; pureza: string; _sum: { peso_neto: string; gramos_finos: string; piezas: number } }[]>([]);
  const [points, setPoints] = useState<Point[]>([]), [configPoint, setConfigPoint] = useState(""), [reason, setReason] = useState("");
  const [error, setError] = useState(""), [busy, setBusy] = useState(false), [uncertain, setUncertain] = useState(false);
  const attempt = useRef<{ key: string; payload: Payload } | null>(null), running = useRef(false);
  const retryKey = useRef<string | null>(null);
  const storageKey = `pc_metal_attempt:${user.id}:${selectedPoint?.id || "none"}`;
  const [reversal, setReversal] = useState(false), [reversalReason, setReversalReason] = useState(""), [piecesEvidence, setPiecesEvidence] = useState(""), [moneyEvidence, setMoneyEvidence] = useState(""), [returnBills, setReturnBills] = useState(""), [returnCoins, setReturnCoins] = useState("0");
  const reportRequest = useRef(0);
  const refresh = useCallback(async () => {
    const request = ++reportRequest.current;
    const query = new URLSearchParams({ pagina: String(page), ...(from ? { desde: from } : {}), ...(to ? { hasta: to } : {}), ...(pointFilter ? { punto_id: pointFilter } : {}), ...(operatorFilter ? { operador: operatorFilter } : {}) });
    const data = await apiService.get<{ compras: Row[]; cantidad: number; totales: Summary[]; metales: typeof metalTotals }>(`/metal-purchases?${query}`);
    if (request === reportRequest.current) { setRows(data.compras); setCount(data.cantidad); setSummaries(data.totales); setMetalTotals(data.metales); }
  }, [page, from, to, pointFilter, operatorFilter]);
  useEffect(() => { void refresh().catch(e => setError(e.message)); }, [refresh]);
  useEffect(() => {
    let active = true;
    void apiService.get<{ habilitado: boolean; monedas: { id: string; codigo: string }[] }>("/metal-purchases/contexto").then(data => {
      if (!active) return; setEnabled(data.habilitado); setCurrencies(data.monedas); setCurrency(data.monedas.find(c => c.codigo === "USD")?.id || data.monedas[0]?.id || "");
    }).catch(e => active && setError(e.message));
    if (admin) void apiService.get<{ puntos: Point[] }>("/metal-purchases/configuracion").then(d => active && setPoints(d.puntos)).catch(e => active && setError(e.message));
    // Keep the exact request and key across a reload after an ambiguous response.
    try {
      const saved = sessionStorage.getItem(storageKey);
      if (saved) { const pending = JSON.parse(saved) as { key: string; payload: Payload }; attempt.current = pending; setUncertain(true);
        setSeller(pending.payload.vendedor); setLines(pending.payload.detalles); setMethod(pending.payload.medio_pago); setBills(pending.payload.billetes || ""); setCoins(pending.payload.monedas || "0"); setBank(pending.payload.banco || ""); setReference(pending.payload.referencia || ""); setProof(pending.payload.comprobante);
        void apiService.post<Quote>("/metal-purchases/cotizar", { detalles: pending.payload.detalles }).then(quote => active && setReview({ payload: pending.payload, quote })).catch(e => active && setError(e.message)); }
    } catch { setError("No se pudo recuperar el intento pendiente. Consulte el historial antes de registrar otra compra."); setUncertain(true); }
    return () => { active = false; };
  }, [storageKey, admin]);
  async function work(fn: () => Promise<void>) {
    if (running.current) return; running.current = true; setBusy(true); setError("");
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : "No se pudo completar la operación."); }
    finally { running.current = false; setBusy(false); }
  }
  function setLine(i: number, data: Partial<Line>) { setCalculated(null); setLines(current => current.map((line, n) => n === i ? { ...line, ...data } : line)); }
  function changeMethod(value: "EFECTIVO" | "TRANSFERENCIA") { setMethod(value); setBills(""); setCoins("0"); setBank(""); setReference(""); setProof(undefined); }
  async function prepare() {
    const payload: Payload = { moneda_id: currency, vendedor: seller, detalles: lines, medio_pago: method,
      ...(method === "EFECTIVO" ? { billetes: bills, monedas: coins } : { banco: bank, referencia: reference, ...(proof ? { comprobante: proof } : {}) }) };
    const quote = await apiService.post<Quote>("/metal-purchases/preparar", payload);
    setReview({ payload, quote });
  }
  async function confirm() {
    if (!review) return;
    const pending = attempt.current || { key: retryKey.current || crypto.randomUUID(), payload: review.payload };
    sessionStorage.setItem(storageKey, JSON.stringify(pending));
    attempt.current = pending;
    setUncertain(true);
    const result = await apiService.post<{ compra: Purchase }>("/metal-purchases", attempt.current.payload, attempt.current.key);
    setReceipt(result.compra); setReview(null); setUncertain(false); attempt.current = null; retryKey.current = null; sessionStorage.removeItem(storageKey);
    setSeller(emptySeller()); setLines([blankLine()]); setCalculated(null); changeMethod("EFECTIVO");
    await refresh();
  }
  return <div className="space-y-6 p-4 md:p-6">
    <div className="metal-no-print"><h1 className="text-2xl font-semibold">Compra de oro y plata</h1><p className="text-sm text-slate-600">Registre piezas recibidas y el pago negociado. {selectedPoint?.nombre}</p></div>
    {error && <div role="alert" className="metal-no-print rounded border border-red-300 bg-red-50 p-3 text-red-800">{error}</div>}
    {operator && !enabled && <p className="metal-no-print rounded bg-amber-50 p-4">La compra de metales no está habilitada en este punto. La administración debe habilitarlo expresamente.</p>}
    {uncertain && <div className="metal-no-print rounded border border-amber-400 bg-amber-50 p-4">Hay un intento pendiente de confirmación. Use «Confirmar / recuperar compra» para completar ese mismo intento. No registre un nuevo pago.
      <Button className="ml-3" variant="outline" disabled={busy || !attempt.current} onClick={() => void work(async () => {
        const pending = attempt.current;
        if (!pending) throw new Error("No hay intento pendiente recuperable.");
        const data = await apiService.get<{ compra: Purchase | null }>(`/metal-purchases/intento/${pending.key}`);
        if (data.compra) { setReceipt(data.compra); setSeller(emptySeller()); setLines([blankLine()]); setCalculated(null); changeMethod("EFECTIVO"); retryKey.current = null; sessionStorage.removeItem(storageKey); }
        else if (review) { setSeller(review.payload.vendedor); setLines(review.payload.detalles); setCurrency(review.payload.moneda_id); setMethod(review.payload.medio_pago); setBills(review.payload.billetes || ""); setCoins(review.payload.monedas || "0"); setBank(review.payload.banco || ""); setReference(review.payload.referencia || ""); setProof(review.payload.comprobante); }
        // If an earlier request has not reached its transaction yet, an edited retry
        // must still use the SAME key. A late original can then never pay twice.
        if (!data.compra) retryKey.current = pending.key;
        setReview(null); setUncertain(false); attempt.current = null; await refresh();
      })}>Consultar resultado antes de corregir</Button></div>}
    {operator && enabled && !review && !uncertain && <form className="metal-no-print space-y-5" onSubmit={e => { e.preventDefault(); void work(prepare); }}>
      <fieldset disabled={busy} className="space-y-5">
        <section className="rounded-lg border bg-white p-4"><h2 className="mb-3 font-semibold">Vendedor y procedencia</h2><div className="grid gap-3 md:grid-cols-3">
          {([['nombre', 'Nombre completo', 200], ['documento', 'Documento de identidad', 40], ['telefono', 'Teléfono', 40]] as const).map(([key, label, max]) => <Field key={key} label={label}><input className={inputClass} required maxLength={max} value={seller[key]} onChange={e => setSeller({ ...seller, [key]: e.target.value })} /></Field>)}
        </div><Field label="Procedencia declarada de las piezas"><textarea className={inputClass} required maxLength={1000} value={seller.procedencia} onChange={e => setSeller({ ...seller, procedencia: e.target.value })} /></Field></section>
        {lines.map((line, i) => <section key={i} className="rounded-lg border bg-white p-4"><div className="flex justify-between"><h2 className="font-semibold">Pieza / sobre {i + 1}</h2>{lines.length > 1 && <Button type="button" variant="ghost" onClick={() => { setCalculated(null); setLines(lines.filter((_, n) => n !== i)); }}>Quitar</Button>}</div>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <Field label="Metal"><select className={inputClass} value={line.metal} onChange={e => setLine(i, { metal: e.target.value as Line['metal'], pureza: e.target.value === "ORO" ? "750" : "925" })}><option>ORO</option><option>PLATA</option></select></Field>
            <Field label="Descripción"><input className={inputClass} required maxLength={300} value={line.descripcion} onChange={e => setLine(i, { descripcion: e.target.value })} /></Field>
            <Field label="Cantidad de piezas homogéneas"><input className={inputClass} type="number" min="1" max="1000" required value={line.piezas} onChange={e => setLine(i, { piezas: Number(e.target.value) })} /></Field>
            {([['peso_bruto', 'Peso bruto (g)', '0.001'], ['deducciones', 'Deducciones: piedras y otros (g)', '0'], ['precio_gramo', 'Precio negociado por gramo de esta pieza', '0.000001']] as const).map(([key, label, min]) => <Field key={key} label={label}><input className={inputClass} type="number" min={min} max="9999999999" step={key === "precio_gramo" ? "0.000001" : "0.001"} required value={line[key]} onChange={e => setLine(i, { [key]: e.target.value })} /></Field>)}
            <Field label="Pureza declarada (opcional)"><input className={inputClass} maxLength={80} placeholder="Ej. sello 18 K / 750" value={line.pureza_declarada} onChange={e => setLine(i, { pureza_declarada: e.target.value })} /></Field>
            <Field label="Pureza evaluada (milésimas)"><input className={inputClass} type="number" min="0.001" max="1000" step="0.001" required value={line.pureza} onChange={e => setLine(i, { pureza: e.target.value })} />{line.metal === "ORO" && <small>Equivalencia aproximada: {(Number(line.pureza) * 24 / 1000).toFixed(2)} K</small>}</Field>
            <Field label="Método de evaluación"><select className={inputClass} value={line.metodo} onChange={e => setLine(i, { metodo: e.target.value as Line['metodo'] })}><option value="ACIDO">Ácido</option><option value="XRF">XRF</option><option value="OTRO">Otro</option></select></Field>
            <Field label="Resultado y observaciones de la evaluación"><textarea className={inputClass} required maxLength={500} value={line.observaciones} onChange={e => setLine(i, { observaciones: e.target.value })} /></Field>
            <Field label="Foto opcional (JPG/PNG, hasta 200 KB)"><input className={inputClass} type="file" accept="image/jpeg,image/png" onChange={e => { const file = e.target.files?.[0]; void work(async () => setLine(i, { foto: await readPhoto(file) })); }} /></Field>
          </div><label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" required /> La evaluación permite confirmar esta compra; registro su resultado estimado.</label>
        </section>)}
        {lines.length < 20 && <Button type="button" variant="outline" onClick={() => { setCalculated(null); setLines([...lines, blankLine()]); }}>Agregar pieza / pureza diferente</Button>}
        <div className="rounded bg-slate-50 p-4"><Button type="button" variant="outline" onClick={() => void work(async () => setCalculated(await apiService.post<Quote>("/metal-purchases/cotizar", { detalles: lines })))}>Calcular total</Button>{calculated && <div className="mt-3"><strong>Total: {currencies.find(c => c.id === currency)?.codigo} {money(calculated.total)}</strong>{calculated.detalles.map((l, i) => <p className="text-sm" key={i}>Pieza {i + 1}: {l.peso_neto} g netos × {l.precio_gramo} = {money(l.subtotal)}</p>)}</div>}</div>
        <section className="rounded-lg border bg-white p-4"><h2 className="mb-3 font-semibold">Pago</h2><div className="grid gap-3 md:grid-cols-3">
          <Field label="Moneda de pago"><select className={inputClass} value={currency} required onChange={e => setCurrency(e.target.value)}>{currencies.map(c => <option key={c.id} value={c.id}>{c.codigo}</option>)}</select></Field>
          <Field label="Medio de pago"><select className={inputClass} value={method} onChange={e => changeMethod(e.target.value as typeof method)}><option value="EFECTIVO">Efectivo</option><option value="TRANSFERENCIA">Transferencia bancaria</option></select></Field>
          {method === "EFECTIVO" ? <><Field label="Billetes entregados"><input className={inputClass} required type="number" min="0" step="0.01" value={bills} onChange={e => setBills(e.target.value)} /></Field><Field label="Monedas físicas entregadas"><input className={inputClass} required type="number" min="0" step="0.01" value={coins} onChange={e => setCoins(e.target.value)} /></Field></> : <>
            <Field label="Banco"><input className={inputClass} required maxLength={120} value={bank} onChange={e => setBank(e.target.value)} /></Field><Field label="Referencia de transferencia realizada"><input className={inputClass} required maxLength={150} value={reference} onChange={e => setReference(e.target.value)} /></Field>
            <Field label="Comprobante opcional (JPG/PNG, hasta 200 KB)"><input className={inputClass} type="file" accept="image/jpeg,image/png" onChange={e => { const file = e.target.files?.[0]; void work(async () => setProof(await readPhoto(file))); }} /></Field><p className="text-sm text-slate-600">Registre una transferencia realizada por fuera de la aplicación. Este formulario no ejecuta pagos bancarios.</p>
          </>}
        </div></section><p className="text-sm text-slate-600">Total = peso neto × precio negociado por gramo. La pureza no se descuenta nuevamente. Cada línea se redondea a centavos.</p>
        <Button type="submit" disabled={busy}>Revisar compra</Button>
      </fieldset>
    </form>}
    {review && <section className="metal-no-print rounded-lg border border-blue-200 bg-blue-50 p-5"><h2 className="text-xl font-semibold">Confirmar piezas recibidas y pago</h2><p>{review.payload.vendedor.nombre} · {review.payload.vendedor.documento}</p>
      <div className="my-3 overflow-auto"><table className="w-full text-left text-sm"><thead><tr>{['Pieza', 'Metal / ley', 'Neto g', 'Precio/g', 'Subtotal'].map(h => <th className="p-2" key={h}>{h}</th>)}</tr></thead><tbody>{review.quote.detalles.map((l, i) => <tr key={i}><td className="p-2">{l.descripcion}</td><td>{l.metal} / {l.pureza}</td><td>{l.peso_neto}</td><td>{l.precio_gramo}</td><td>{money(l.subtotal)}</td></tr>)}</tbody></table></div>
      <p className="text-xl font-bold">{currencies.find(c => c.id === review.payload.moneda_id)?.codigo} {money(review.quote.total)} · {review.payload.medio_pago}</p>
      <p className="my-2 text-sm">{review.payload.medio_pago === "EFECTIVO" ? `Billetes: ${review.payload.billetes}; monedas: ${review.payload.monedas}` : `${review.payload.banco} · Referencia: ${review.payload.referencia}`}</p>
      <div className="flex gap-3"><Button disabled={busy} onClick={() => void work(confirm)}>Confirmar / recuperar compra</Button>{!uncertain && <Button variant="outline" disabled={busy} onClick={() => setReview(null)}>Volver y corregir</Button>}</div>
    </section>}
    {admin && <section className="metal-no-print rounded-lg border bg-white p-4"><h2 className="font-semibold">Puntos habilitados para comprar metales</h2><p className="mb-3 text-sm">Habilite únicamente los puntos directos definidos por la empresa.</p><div className="grid gap-3 md:grid-cols-2"><Field label="Punto"><select className={inputClass} value={configPoint} onChange={e => setConfigPoint(e.target.value)}><option value="">Seleccione un punto</option>{points.map(p => <option key={p.id} value={p.id}>{p.nombre} · {p.configuracionMetales?.habilitado ? "Habilitado" : "Deshabilitado"}{!p.activo ? " (inactivo)" : ""}</option>)}</select></Field><Field label="Motivo de configuración"><input className={inputClass} minLength={5} maxLength={500} value={reason} onChange={e => setReason(e.target.value)} /></Field></div><Button className="mt-3" disabled={busy || !configPoint || reason.trim().length < 5} onClick={() => void work(async () => { await apiService.put(`/metal-purchases/configuracion/${configPoint}`, { habilitado: !points.find(p => p.id === configPoint)?.configuracionMetales?.habilitado, motivo: reason }); setPoints((await apiService.get<{ puntos: Point[] }>("/metal-purchases/configuracion")).puntos); setReason(""); })}>Cambiar habilitación del punto seleccionado</Button></section>}
    <section className="metal-no-print rounded-lg border bg-white p-4"><h2 className="font-semibold">Historial de compras</h2><div className="my-3 flex flex-wrap gap-3"><Field label="Desde"><input className={inputClass} type="date" value={from} onChange={e => { setFrom(e.target.value); setPage(1); }} /></Field><Field label="Hasta"><input className={inputClass} type="date" value={to} onChange={e => { setTo(e.target.value); setPage(1); }} /></Field>{admin && <Field label="Punto"><select className={inputClass} value={pointFilter} onChange={e => { setPointFilter(e.target.value); setPage(1); }}><option value="">Todos</option>{points.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></Field>}<Button variant="outline" disabled={busy} onClick={() => void work(refresh)}>Actualizar</Button></div>
      {!operator && <Field label="Filtrar por nombre del operador"><input className={inputClass} maxLength={200} value={operatorFilter} onChange={e => { setOperatorFilter(e.target.value); setPage(1); }} /></Field>}
      <div className="my-3 flex flex-wrap gap-3">{summaries.map(s => <div key={`${s.moneda_codigo}-${s.medio_pago}-${s.estado}`} className="rounded bg-slate-50 p-3 text-sm">{s.moneda_codigo} · {s.medio_pago} · {s.estado}<br /><strong>{money(s._sum.total)} · {s._count} compras</strong></div>)}</div>
      {metalTotals.length > 0 && <div className="my-3 rounded bg-amber-50 p-3 text-sm"><strong>Piezas de compras vigentes en este filtro</strong>{metalTotals.map(m => <p key={`${m.metal}-${m.pureza}`}>{m.metal} / ley {m.pureza}: {m._sum.piezas} piezas · {m._sum.peso_neto} g netos · {m._sum.gramos_finos} g finos estimados</p>)}</div>}
      <div className="overflow-auto"><table className="w-full text-left text-sm"><thead><tr>{['Fecha', 'Punto / operador', 'Pago', 'Total', 'Estado', ''].map((h, i) => <th className="p-2" key={i}>{h}</th>)}</tr></thead><tbody>{rows.map(row => <tr className="border-t" key={row.id}><td className="p-2">{new Date(row.fecha).toLocaleString("es-EC", { timeZone: "America/Guayaquil" })}</td><td>{row.punto_nombre}<br />{row.operador_nombre}</td><td>{row.medio_pago}</td><td>{row.moneda_codigo} {money(row.total)}</td><td>{row.estado}</td><td><Button variant="ghost" disabled={busy} onClick={() => void work(async () => { setReceipt((await apiService.get<{ compra: Purchase }>(`/metal-purchases/${row.id}`)).compra); setReversal(false); })}>Ver recibo</Button></td></tr>)}</tbody></table></div>
      {!rows.length && <p className="p-3 text-sm">No hay compras en este filtro.</p>}<div className="mt-3 flex items-center gap-3"><Button variant="outline" disabled={page === 1} onClick={() => setPage(page - 1)}>Anterior</Button><span>Página {page} · {count} compras</span><Button variant="outline" disabled={page * 25 >= count} onClick={() => setPage(page + 1)}>Siguiente</Button></div>
    </section>
    {receipt && <section id="metal-receipt" className="rounded-lg border bg-white p-5"><h2 className="text-xl font-semibold">Comprobante interno de compra de metales</h2><p className="break-all text-sm">{receipt.numero}</p><p>{receipt.estado} · {new Date(receipt.fecha).toLocaleString("es-EC", { timeZone: "America/Guayaquil" })}</p><p>Punto: {receipt.punto_nombre} · Operador/evaluador: {receipt.operador_nombre}</p><p>Vendedor: {receipt.vendedor.nombre} · Documento: {receipt.vendedor.documento} · Tel.: {receipt.vendedor.telefono}</p><p>Procedencia declarada: {receipt.vendedor.procedencia}</p>
      {receipt.detalles.map(l => <div className="my-3 break-inside-avoid border-t pt-3 text-sm" key={l.codigo_pieza}><strong>{l.descripcion} · {l.metal} · {l.piezas} pieza(s)</strong><p className="break-all">Sobre: {l.codigo_pieza} · Ubicación inicial: {receipt.punto_nombre}</p><p>Bruto {l.peso_bruto} g − deducciones {l.deducciones} g = neto {l.peso_neto} g</p><p>Pureza declarada: {l.pureza_declarada || "No indicada"} · Evaluada: {l.pureza} milésimas · Finos estimados: {l.gramos_finos} g</p><p>Método: {l.metodo} · Evaluación: {l.observaciones}</p><p>Precio por gramo: {l.precio_gramo} · Subtotal: {receipt.moneda_codigo} {money(l.subtotal)}</p>{l.foto && <img src={l.foto} alt={`Pieza ${l.descripcion}`} className="mt-2 max-h-36" />}</div>)}
      <p className="text-lg font-bold">Total: {receipt.moneda_codigo} {money(receipt.total)} · {receipt.medio_pago}</p><p>{receipt.medio_pago === "EFECTIVO" ? `Billetes ${receipt.billetes} · Monedas ${receipt.monedas}` : `Banco: ${receipt.banco} · Referencia: ${receipt.referencia}`}</p>{receipt.comprobante && <img src={receipt.comprobante} alt="Comprobante de transferencia" className="max-h-48" />}
      <p className="mt-3 text-xs">Comprobante interno. No constituye documento tributario autorizado ni certificación de pureza.</p>
      {receipt.eventos.map(e => <div key={e.id} className="mt-2 text-xs">{e.accion} · {new Date(e.fecha).toLocaleString("es-EC", { timeZone: "America/Guayaquil" })}{e.accion === "REVERSO" && <p>Motivo: {String(e.evidencia.motivo)} · Devolución: {String(e.evidencia.evidencia_devolucion)} · Dinero: {String(e.evidencia.evidencia_dinero)}</p>}</div>)}
      <div className="metal-no-print mt-4 flex gap-3"><Button onClick={() => window.print()}>Imprimir / reimprimir</Button><Button variant="outline" onClick={() => { setReceipt(null); setReversal(false); }}>Cerrar recibo</Button>{admin && receipt.estado === "PAGADA" && <Button variant="outline" onClick={() => { setReversal(true); setReversalReason(""); setPiecesEvidence(""); setMoneyEvidence(""); setReturnBills(""); setReturnCoins("0"); }}>Registrar devolución y reverso</Button>}</div>
      {reversal && <form className="metal-no-print mt-4 space-y-3 rounded border border-amber-300 p-4" onSubmit={e => { e.preventDefault(); void work(async () => { const result = await apiService.post<{ compra: Purchase }>(`/metal-purchases/${receipt.id}/reversar`, { motivo: reversalReason, piezas_devueltas: true, evidencia_devolucion: piecesEvidence, evidencia_dinero: moneyEvidence, ...(receipt.medio_pago === "EFECTIVO" ? { billetes: returnBills, monedas: returnCoins } : {}) }); setReceipt(result.compra); setReversal(false); await refresh(); }); }}><p className="text-sm">Solo durante la jornada original abierta. Registre el dinero realmente recuperado y las piezas efectivamente devueltas.</p>
        {([["Motivo", reversalReason, setReversalReason], ["Evidencia de devolución de piezas (identificadores y constancia)", piecesEvidence, setPiecesEvidence], ["Evidencia de dinero recuperado (constancia / referencia)", moneyEvidence, setMoneyEvidence]] as const).map(([label, value, set]) => <Field key={label} label={label}><textarea className={inputClass} required minLength={10} maxLength={1000} value={value} onChange={e => set(e.target.value)} /></Field>)}
        {receipt.medio_pago === "EFECTIVO" && <div className="grid gap-3 md:grid-cols-2"><Field label="Billetes recuperados"><input className={inputClass} type="number" min="0" step="0.01" required value={returnBills} onChange={e => setReturnBills(e.target.value)} /></Field><Field label="Monedas recuperadas"><input className={inputClass} type="number" min="0" step="0.01" required value={returnCoins} onChange={e => setReturnCoins(e.target.value)} /></Field></div>}
        <label className="flex gap-2 text-sm"><input type="checkbox" required /> Confirmo la devolución de todas las piezas y la recuperación del importe completo.</label><Button type="submit" disabled={busy}>Confirmar reverso documentado</Button>
      </form>}
    </section>}
    {receipt && <style>{`@media print { body * { visibility: hidden; } #metal-receipt, #metal-receipt * { visibility: visible; } #metal-receipt { position: absolute; left: 0; top: 0; width: 100%; border: 0; } #metal-receipt .metal-no-print, .metal-no-print { display: none !important; } }`}</style>}
  </div>;
}
