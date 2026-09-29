import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MarcacionEvent, fechaMarcacion, tiposMarcacion } from "@/services/marcacionesService";

interface Props { events: MarcacionEvent[]; selected: MarcacionEvent | null; onSelect: (event: MarcacionEvent) => void }
export default function MarcacionesMap({ events, selected, onSelect }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const [tileError, setTileError] = useState(false);
  useEffect(() => {
    if (!container.current) return;
    const instance = L.map(container.current).setView([-1.83, -78.18], 6);
    map.current = instance;
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>', maxZoom: 19,
    }).on("tileerror", () => setTileError(true)).addTo(instance);
    layer.current = L.layerGroup().addTo(instance);
    const observer = new ResizeObserver(() => instance.invalidateSize());
    observer.observe(container.current);
    return () => { observer.disconnect(); instance.remove(); map.current = null; layer.current = null; };
  }, []);
  useEffect(() => {
    const instance = map.current;
    if (!instance) return;
    const points = events.flatMap(event => event.ubicacion ? [[event.ubicacion.lat, event.ubicacion.lng] as L.LatLngTuple] : []);
    if (points.length) instance.fitBounds(L.latLngBounds(points), { padding: [35, 35], maxZoom: 16 });
  }, [events]);
  useEffect(() => {
    const instance = map.current;
    const group = layer.current;
    if (!instance || !group) return;
    group.clearLayers();
    let activeMarker: L.CircleMarker | undefined;
    const visible = selected?.ubicacion && !events.some(event => event.id === selected.id) ? [...events, selected] : events;
    visible.forEach(event => {
      if (!event.ubicacion) return;
      const active = event.id === selected?.id;
      const marker = L.circleMarker([event.ubicacion.lat, event.ubicacion.lng], {
        radius: active ? 10 : 7, color: active ? "#0f172a" : "#fff", weight: 2,
        fillColor: active ? "#f59e0b" : "#2563eb", fillOpacity: 0.9,
      });
      const label = document.createElement("span");
      label.textContent = `${event.nombre} · ${tiposMarcacion[event.tipo] || event.tipo} · ${fechaMarcacion(event.fecha)}`;
      marker.bindTooltip(label).on("click", () => onSelect(event)).addTo(group);
      if (active) activeMarker = marker;
    });
    activeMarker?.bringToFront();
    if (selected?.ubicacion) instance.setView([selected.ubicacion.lat, selected.ubicacion.lng], Math.max(instance.getZoom(), 16));
  }, [events, selected, onSelect]);
  return <div className="relative isolate">
    <div ref={container} className="h-[340px] w-full sm:h-[420px]" role="region" aria-label="Mapa de ubicaciones registradas; seleccione una marcación en la tabla para consultar su detalle" />
    {tileError && <p role="status" className="border-t bg-amber-50 p-3 text-sm text-amber-900">No se pudo cargar parte del mapa. Puede abrir la ubicación seleccionada en el mapa externo.</p>}
  </div>;
}
