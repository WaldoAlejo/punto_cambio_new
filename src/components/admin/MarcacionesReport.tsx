import { FormEvent, useCallback, useEffect, useState } from "react";
import { MapPin, LocateFixed, Search, Loader2, ExternalLink, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getMarcaciones, fechaMarcacion, tiposMarcacion, MarcacionEvent, MarcacionesData, MarcacionesFilters } from "@/services/marcacionesService";
import MarcacionesMap from "./MarcacionesMap";

function initialFilters(): MarcacionesFilters {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Guayaquil", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const start = new Date(`${today}T12:00:00Z`);
  start.setUTCDate(start.getUTCDate() - 29);
  return { from: start.toISOString().slice(0, 10), to: today, usuario_id: "", punto_atencion_id: "", tipo: "", ubicacion: "todas" };
}
const selectClass = "h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring";

export default function MarcacionesReport() {
  const [filters, setFilters] = useState(initialFilters);
  const [query, setQuery] = useState(() => ({ filters, page: 1, revision: 0 }));
  const [data, setData] = useState<MarcacionesData | null>(null);
  const [options, setOptions] = useState<Pick<MarcacionesData, "users" | "points">>({ users: [], points: [] });
  const [selected, setSelected] = useState<MarcacionEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const selectEvent = useCallback((event: MarcacionEvent) => setSelected(event), []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(""); setData(null); setSelected(null);
    getMarcaciones(query.filters, query.page, controller.signal).then(result => {
      if (controller.signal.aborted) return;
      setData(result); setOptions({ users: result.users, points: result.points });
    }).catch((err: unknown) => {
      if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "No se pudo cargar el informe.");
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [query]);
  const update = (field: keyof MarcacionesFilters, value: string) => setFilters(previous => ({ ...previous, [field]: value }));
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (filters.from > filters.to) return;
    setData(null); setSelected(null); setLoading(true);
    setQuery(previous => ({ filters: { ...filters }, page: 1, revision: previous.revision + 1 }));
  };
  const changePage = (page: number) => {
    setData(null); setSelected(null); setLoading(true);
    setQuery(previous => ({ ...previous, page }));
  };
  const dirty = JSON.stringify(filters) !== JSON.stringify(query.filters);
  return <section className="mx-auto max-w-[1500px] space-y-5 p-3 sm:p-6">
    <header className="flex items-start gap-3">
      <span className="rounded-lg bg-blue-100 p-3 text-blue-800"><MapPin className="h-6 w-6" /></span>
      <div><p className="text-xs font-semibold uppercase tracking-widest text-blue-700">Usuarios y horarios</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Marcaciones y ubicación</h1>
        <p className="mt-1 text-sm text-slate-600">Revise cuándo y desde dónde se registró cada timbrada. Horario de Ecuador (UTC−5).</p>
      </div>
    </header>
    <form onSubmit={submit} className="space-y-4 rounded-lg border bg-white p-4 shadow-sm">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <label className="space-y-1 text-sm font-medium">Desde<Input type="date" required value={filters.from} onChange={event => update("from", event.target.value)} /></label>
        <label className="space-y-1 text-sm font-medium">Hasta<Input type="date" required min={filters.from} value={filters.to} onChange={event => update("to", event.target.value)} /></label>
        <label className="space-y-1 text-sm font-medium">Usuario<select className={selectClass} value={filters.usuario_id} onChange={event => update("usuario_id", event.target.value)}><option value="">Todos los usuarios</option>{options.users.map(user => <option key={user.id} value={user.id}>{user.nombre} (@{user.username}){!user.activo ? " · Inactivo" : ""}</option>)}</select></label>
        <label className="space-y-1 text-sm font-medium">Punto asociado<select className={selectClass} value={filters.punto_atencion_id} onChange={event => update("punto_atencion_id", event.target.value)}><option value="">Todos los puntos</option>{options.points.map(point => <option key={point.id} value={point.id}>{point.nombre}</option>)}</select></label>
        <label className="space-y-1 text-sm font-medium">Tipo de marcación<select className={selectClass} value={filters.tipo} onChange={event => update("tipo", event.target.value)}><option value="">Todos los tipos</option>{Object.entries(tiposMarcacion).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="space-y-1 text-sm font-medium">Ubicación<select className={selectClass} value={filters.ubicacion} onChange={event => update("ubicacion", event.target.value)}><option value="todas">Con y sin ubicación</option><option value="con">Con ubicación</option><option value="sin">Sin ubicación</option></select></label>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-slate-600">{dirty ? "Hay filtros pendientes de aplicar. Pulse Consultar." : "Período inicial: últimos 30 días, incluido hoy."}</p><Button type="submit" disabled={loading || filters.from > filters.to} className="gap-2 bg-blue-700 hover:bg-blue-800"><Search className="h-4 w-4" />Consultar</Button></div>
    </form>
    <p className="flex items-start gap-2 rounded-md border border-blue-100 bg-blue-50 p-3 text-sm text-blue-950"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />La ubicación es la reportada por el dispositivo y puede ser imprecisa; por sí sola no prueba presencia física. El punto asociado es la oficina asignada, no el lugar desde donde se timbró.</p>
    {loading && <div role="status" className="flex min-h-64 items-center justify-center gap-3 rounded-lg border bg-white text-slate-600"><Loader2 className="h-5 w-5 animate-spin" />Consultando marcaciones…</div>}
    {!loading && error && <div role="alert" className="space-y-3 rounded-lg border border-red-200 bg-red-50 p-5 text-red-900"><p>No se pudo cargar el informe: {error}</p><Button variant="outline" onClick={() => setQuery(previous => ({ ...previous, revision: previous.revision + 1 }))}>Reintentar</Button></div>}
    {!loading && data && <>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600"><p>Consulta aplicada: <strong>{data.from}</strong> al <strong>{data.to}</strong></p><span>Todos los totales corresponden a los filtros aplicados</span></div>
      <dl className="grid grid-cols-2 divide-x rounded-lg border bg-white sm:grid-cols-4">{[["Marcaciones", data.summary.total], ["Con ubicación", data.summary.conUbicacion], ["Sin ubicación", data.summary.sinUbicacion], ["Usuarios", data.summary.usuarios]].map(([label, count]) => <div key={label} className="p-4"><dt className="text-xs font-medium text-slate-600">{label}</dt><dd className={`mt-1 text-2xl font-semibold tabular-nums ${label === "Sin ubicación" ? "text-amber-700" : "text-slate-900"}`}>{count.toLocaleString("es-EC")}</dd></div>)}</dl>
      {data.total === 0 ? <div className="rounded-lg border bg-white px-5 py-16 text-center"><Search className="mx-auto mb-3 h-7 w-7 text-slate-400" /><h2 className="font-semibold">No hay marcaciones en esta consulta</h2><p className="mt-1 text-sm text-slate-600">Pruebe otro período o ajuste los filtros.</p></div> : <>
        <div className="overflow-hidden rounded-lg border bg-white">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3"><h2 className="flex items-center gap-2 font-semibold"><LocateFixed className="h-4 w-4 text-blue-700" />Ubicaciones registradas</h2><span className="text-xs text-slate-600">{data.markers.length} de {data.markersTotal} marcaciones con ubicación</span></div>
          {data.markersTotal > data.markersLimit && <p className="border-b bg-amber-50 px-4 py-2 text-sm text-amber-900">El mapa muestra como máximo {data.markersLimit} puntos. Reduzca el período o filtre por usuario para ver más detalle. Las filas seleccionadas se muestran también.</p>}
          <div className="grid lg:grid-cols-[minmax(0,1fr)_300px]">
            {data.markers.length > 0 || selected?.ubicacion ? <MarcacionesMap events={data.markers} selected={selected} onSelect={selectEvent} /> : <div className="flex min-h-64 flex-col items-center justify-center gap-2 bg-slate-50 p-6 text-center"><MapPin className="h-8 w-8 text-amber-600" /><p className="font-medium">No hay coordenadas para mostrar</p><p className="max-w-sm text-sm text-slate-600">Las marcaciones sin ubicación siguen disponibles en la tabla.</p></div>}
            <aside className="min-w-0 space-y-4 border-t p-5 lg:border-l lg:border-t-0" aria-live="polite">
              <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-500">Detalle de marcación</h3>
              {!selected ? <p className="text-sm leading-6 text-slate-600">Seleccione un punto del mapa o pulse «Ver detalle» en la tabla. Si varias marcaciones coinciden en el mapa, use la tabla para consultar cada una.</p> : <>
                <div><p className="break-words text-lg font-semibold">{selected.nombre}</p><p className="break-words text-sm text-slate-500">@{selected.username}</p></div>
                <dl className="space-y-3 text-sm">{[["Marcación", tiposMarcacion[selected.tipo] || selected.tipo], ["Fecha y hora", fechaMarcacion(selected.fecha)], ["Punto asociado", selected.punto || "Sin punto"], ["Estado del registro", selected.estado], ["Dispositivo", selected.dispositivo || "No registrado"]].map(([label, value]) => <div key={label}><dt className="text-xs text-slate-500">{label}</dt><dd className="break-words font-medium">{value}</dd></div>)}</dl>
                {selected.ubicacion ? <div className="space-y-2 rounded-md bg-blue-50 p-3 text-sm text-blue-950"><p className="font-semibold">Coordenadas registradas</p><p className="font-mono text-xs">{selected.ubicacion.lat.toFixed(6)}, {selected.ubicacion.lng.toFixed(6)}</p><p className="text-xs">{selected.ubicacion.accuracy !== null ? `Precisión reportada: ±${Math.round(selected.ubicacion.accuracy)} m` : "Precisión no registrada"}</p>{selected.ubicacion.direccion && <p className="break-words text-xs">{selected.ubicacion.direccion}</p>}<a className="inline-flex items-center gap-1 font-medium underline" target="_blank" rel="noopener noreferrer" href={`https://www.openstreetmap.org/?mlat=${selected.ubicacion.lat}&mlon=${selected.ubicacion.lng}#map=17/${selected.ubicacion.lat}/${selected.ubicacion.lng}`}>Abrir mapa <ExternalLink className="h-3 w-3" /></a></div> : <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">{selected.motivoSinGps || "Esta marcación no tiene ubicación registrada."}</p>}
                {selected.observaciones && <p className="break-words text-sm text-slate-600">{selected.observaciones}</p>}
              </>}
            </aside>
          </div>
        </div>
        <div className="overflow-hidden rounded-lg border bg-white">
          <div className="border-b px-4 py-3"><h2 className="font-semibold">Historial de marcaciones</h2><p className="mt-1 text-xs text-slate-500">Incluye entradas, almuerzos, salidas y pausas registradas.</p></div>
          <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-600"><tr>{["Usuario", "Fecha y hora", "Marcación", "Punto asociado", "Ubicación", "Detalle"].map(title => <th key={title} scope="col" className="whitespace-nowrap px-4 py-3 font-medium">{title}</th>)}</tr></thead><tbody className="divide-y">{data.events.map(event => <tr key={event.id} className={selected?.id === event.id ? "bg-blue-50" : "hover:bg-slate-50"}><td className="px-4 py-3"><p className="min-w-32 font-medium">{event.nombre}</p><p className="text-xs text-slate-500">@{event.username}</p></td><td className="whitespace-nowrap px-4 py-3 tabular-nums">{fechaMarcacion(event.fecha)}</td><td className="px-4 py-3">{tiposMarcacion[event.tipo] || event.tipo}</td><td className="px-4 py-3">{event.punto || "Sin punto"}</td><td className="px-4 py-3"><span className={`whitespace-nowrap rounded px-2 py-1 text-xs font-medium ${event.ubicacion ? "bg-blue-50 text-blue-800" : "bg-amber-50 text-amber-800"}`}>{event.ubicacion ? "Con ubicación" : "Sin ubicación"}</span></td><td className="px-4 py-3"><Button variant="outline" size="sm" aria-pressed={selected?.id === event.id} aria-label={`Ver detalle: ${event.nombre}, ${tiposMarcacion[event.tipo] || event.tipo}, ${fechaMarcacion(event.fecha)}`} onClick={() => selectEvent(event)}>Ver detalle</Button></td></tr>)}</tbody></table></div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-sm"><span className="text-slate-600">Página {data.page} de {Math.max(1, Math.ceil(data.total / data.pageSize))} · {data.total} registros</span><div className="flex gap-2"><Button variant="outline" size="sm" disabled={data.page <= 1} onClick={() => changePage(data.page - 1)}>Anterior</Button><Button variant="outline" size="sm" disabled={data.page * data.pageSize >= data.total} onClick={() => changePage(data.page + 1)}>Siguiente</Button></div></div>
        </div>
      </>}
    </>}
  </section>;
}
