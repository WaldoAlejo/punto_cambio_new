// Formato imprimible de la «Orden de trabajo – Evaluación de oro» de Punto Cambio.
import { karatOf } from "../../../server/utils/metalEvaluation";
import { gye, jewelTypeLabel, money, PROCESS_LABELS, type Order } from "./metalOrderTypes";

const Y = "#f5c518";
function Line({ label, value, wide }: { label: string; value?: string | number | null; wide?: boolean }) {
  return <div className={`flex items-end gap-1 text-[11px] ${wide ? "col-span-2" : ""}`}><span className="whitespace-nowrap font-semibold uppercase">{label}:</span><span className="min-h-[16px] flex-1 border-b border-slate-500 px-1">{value ?? ""}</span></div>;
}
function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return <section className="break-inside-avoid border-b border-amber-300 py-1"><h3 className="mb-1 flex items-center gap-2 text-[12px] font-bold uppercase"><span className="flex h-5 w-5 items-center justify-center rounded-full bg-black text-[11px] text-white">{n}</span>{title}</h3>{children}</section>;
}
const Box = ({ checked }: { checked: boolean }) => <span className="inline-flex h-3.5 w-3.5 items-center justify-center border border-slate-600 text-[10px] leading-none">{checked ? "✓" : ""}</span>;

export default function MetalOrderPrint({ order }: { order: Order }) {
  const c = order.cliente, evaluated = !!order.evaluada_en, authorized = new Set(order.procesos?.autorizados ?? []), done = new Set(order.procesos?.realizados ?? []);
  const after = order.joyas.some(j => j.foto_despues);
  const date = new Date(order.fecha);
  const [d, m, y] = new Intl.DateTimeFormat("es-EC", { timeZone: "America/Guayaquil", day: "2-digit", month: "2-digit", year: "numeric" }).format(date).split("/");
  return <div id="metal-order-print" className="mx-auto max-w-[800px] bg-white p-5 text-black print:p-0" style={{ fontFamily: "Arial, sans-serif" }}>
    <header className="flex items-start justify-between gap-4 border-b-4 pb-2" style={{ borderColor: Y }}>
      <img src="/metal-guide/logo-punto-cambio.png" alt="Punto Cambio - Pagos & Cambios" className="h-16 object-contain" />
      <div className="w-72 space-y-1.5">
        <div className="flex items-center gap-2 text-[11px]"><span className="w-24 font-bold">Nº DE ORDEN:</span><span className="flex-1 rounded border border-slate-500 px-2 py-0.5 text-sm font-bold">{order.numero}</span></div>
        <Line label="Fecha" value={`${d} / ${m} / ${y}`} /><Line label="Agencia" value={order.punto_nombre} /><Line label="Asesor(a)" value={order.asesor_nombre} />
      </div>
    </header>
    <div className="my-2 inline-flex items-center gap-3 rounded-r-full px-4 py-2" style={{ background: Y }}>
      <span className="text-2xl">📋</span><div><p className="text-lg font-extrabold leading-tight">ORDEN DE TRABAJO</p><p className="text-sm font-bold leading-tight">EVALUACIÓN DE ORO Y PLATA</p></div>
    </div>
    <Section n={1} title="Datos del cliente"><div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
      <Line label="Nombre completo" value={c.nombre} /><Line label="C.I. / Pasaporte" value={c.documento} />
      <Line label="Teléfono" value={c.telefono} /><Line label="Dirección" value={c.direccion} />
      <Line label="Procedencia declarada" value={c.procedencia} wide />
    </div></Section>
    <Section n={2} title="Datos de la joya"><table className="w-full border-collapse text-[10.5px]">
      <thead><tr className="text-left" style={{ background: "#fff5cc" }}>{["#", "Tipo de joya", "Descripción", "Piezas", "Peso recibido", "Color", "Estado de conservación", "Piedras / elementos adicionales"].map(h => <th key={h} className="border border-slate-400 px-1 py-0.5">{h}</th>)}</tr></thead>
      <tbody>{order.joyas.map(j => <tr key={j.id}><td className="border border-slate-400 px-1">{j.posicion}</td><td className="border border-slate-400 px-1">{jewelTypeLabel(j.tipo)}</td><td className="border border-slate-400 px-1">{j.descripcion}</td><td className="border border-slate-400 px-1 text-center">{j.piezas}</td><td className="border border-slate-400 px-1 text-right">{j.peso_recibido} g</td><td className="border border-slate-400 px-1">{j.color}</td><td className="border border-slate-400 px-1">{j.estado_conservacion}</td><td className="border border-slate-400 px-1">{j.piedras || "Ninguno"}</td></tr>)}</tbody>
    </table></Section>
    <Section n={3} title="Autorización y aceptación del cliente"><div className="space-y-1 text-[10.5px] leading-snug">
      <p>Yo, <strong className="border-b border-slate-500 px-1">{c.nombre}</strong>, con C.I. <strong className="border-b border-slate-500 px-1">{c.documento}</strong>, autorizo expresamente a <strong>PUNTO CAMBIO</strong> y a su personal autorizado a realizar las pruebas y procedimientos que sean necesarios para verificar la autenticidad, pureza, composición y valor de la joya descrita en esta orden.</p>
      <p>Entiendo que dichos procedimientos pueden incluir pruebas químicas, físicas y técnicas que, dependiendo del método utilizado, podrían producir marcas, rayas o alteraciones menores en la pieza.</p>
      <p>Declaro que la información proporcionada es verdadera y que soy el propietario o cuento con la autorización legal para disponer de la joya entregada.</p>
      <p>Acepto estas condiciones y autorizo la realización de las pruebas antes descritas, dejando constancia de mi aprobación antes de iniciar cualquier procedimiento.</p>
      <div className="mt-1 rounded-md border-2 p-1.5" style={{ borderColor: Y }}><p className="font-bold uppercase">Observaciones del cliente sobre la joya:</p><p className="min-h-[20px] border-b border-slate-400">{order.observaciones_cliente}</p></div>
    </div></Section>
    <div className="grid grid-cols-2 gap-4">
      <Section n={4} title="Procesos a realizar"><div className="space-y-0.5 text-[11px]">
        {(["ACIDO", "PIEDRA_TOQUE", "DENSIDAD", "XRF"] as const).map(p => <p key={p} className="flex items-center gap-2"><Box checked={authorized.has(p)} />{PROCESS_LABELS[p]}{evaluated && done.has(p) && <span className="text-[9px] text-slate-500">(realizada)</span>}</p>)}
        <p className="flex items-center gap-2"><Box checked={authorized.has("OTRO")} />Otros: <span className="flex-1 border-b border-slate-500">{order.procesos?.otros}</span></p>
      </div></Section>
      <Section n={5} title="Registro fotográfico"><div className="space-y-1.5 text-[11px]">
        <p className="flex items-center gap-2">📷 Foto antes de la evaluación <span className="ml-auto flex gap-2">SÍ <Box checked /> NO <Box checked={false} /></span></p>
        <p className="flex items-center gap-2">📷 Foto después de la evaluación <span className="ml-auto flex gap-2">SÍ <Box checked={evaluated && after} /> NO <Box checked={evaluated && !after} /></span></p>
      </div></Section>
    </div>
    <div className="grid grid-cols-[1fr_220px] gap-4">
      <Section n={6} title="Resultado de la evaluación"><div className="space-y-1 text-[11px]">
        {order.joyas.map(j => <p key={j.id}><strong>#{j.posicion}</strong> Pureza estimada: <span className="border-b border-slate-500 px-1">{j.pureza ? `${j.metal} ${Number(j.pureza)}${j.metal === "ORO" ? ` (${Math.round(karatOf(Number(j.pureza)))}K)` : ""}` : ""}</span> · Peso final registrado: <span className="border-b border-slate-500 px-1">{j.peso_final ? `${j.peso_final} g` : ""}</span></p>)}
        <Line label="Observaciones / resultado" value={order.resultado_observaciones} />
      </div></Section>
      <div className="mt-2 self-start rounded-md border-2 p-2" style={{ borderColor: Y }}><p className="rounded px-1 text-center text-[11px] font-bold" style={{ background: Y }}>VALORACIÓN / PRECIO OFRECIDO</p><p className="mt-2 border-b border-slate-500 text-xl font-bold">{order.moneda?.codigo === "USD" || !order.moneda ? "$" : order.moneda.codigo} {order.oferta_total ? money(order.oferta_total) : ""}</p></div>
    </div>
    <Section n={7} title="Firmas"><div className="grid grid-cols-2 gap-4">
      {[["Cliente", [["Nombre", c.nombre], ["C.I.", c.documento], ["Firma", ""], ["Fecha y hora", ""]]], ["Responsable Punto Cambio", [["Nombre", order.asesor_nombre], ["Cargo", "Asesor(a)"], ["Firma", ""], ["Fecha y hora", ""]]]].map(([title, rows]) => <div key={title as string} className="rounded-md border-2 p-2" style={{ borderColor: Y }}><p className="mb-1 text-center text-[11px] font-bold uppercase">{title as string}</p><div className="space-y-1.5">{(rows as string[][]).map(([l, v]) => <Line key={l} label={l} value={v} />)}</div></div>)}
    </div></Section>
    <p className="mt-2 rounded-full px-4 py-1 text-center text-[10px] font-semibold" style={{ background: Y }}>🛡 La joya será manipulada con el cuidado correspondiente y bajo los procedimientos establecidos por la empresa. Este documento deberá ser firmado antes de iniciar cualquier procedimiento.</p>
    <p className="mt-1 text-center text-sm italic">¡Gracias por confiar en Punto Cambio!</p>
    {order.autorizada_en && <p className="mt-1 text-center text-[9px] text-slate-500">Autorización registrada: {gye(order.autorizada_en)}{order.evaluada_en ? ` · Evaluación: ${gye(order.evaluada_en)}` : ""}</p>}
  </div>;
}
