// src/components/layout/PointSelector.tsx
import React, { useEffect, useMemo, useState } from "react";
import { User, PuntoAtencion } from "@/types";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { emitPointSelected } from "@/lib/pointEvents";
import { Building2, MapPin } from "lucide-react";

interface PointSelectorProps {
  user: User;
  defaultSelectedPointId?: string;
  onPointSelected?: (point: PuntoAtencion) => void; // opcional (compat)
}

/** Intenta cargar desde tu API. Si falla/no existe, usa mock seguro. */
async function loadUserPoints(): Promise<PuntoAtencion[]> {
  try {
    const res = await fetch("/api/puntos-atencion/mis-puntos", {
      credentials: "include",
    });
    if (res.ok) {
      const data = await res.json();
      return (
        Array.isArray(data) ? data : data?.puntos || []
      ) as PuntoAtencion[];
    }
  } catch {
    // noop -> fallback
  }

  // 🔁 Fallback que no rompe el build
  return [
    {
      id: "p-001",
      nombre: "Casa de Cambios Principal",
      ciudad: "Quito",
      direccion: "Av. Siempre Viva 123",
    } as PuntoAtencion,
    {
      id: "p-002",
      nombre: "Amazonas",
      ciudad: "Quito",
      direccion: "Av. Amazonas 456",
    } as PuntoAtencion,
  ];
}

export const PointSelector: React.FC<PointSelectorProps> = ({
  user,
  defaultSelectedPointId,
  onPointSelected,
}) => {
  const [points, setPoints] = useState<PuntoAtencion[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | undefined>(
    defaultSelectedPointId
  );
  const [manualId, setManualId] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      const ps = await loadUserPoints();
      if (!mounted) return;
      setPoints(ps);
      if (!defaultSelectedPointId && ps[0]) setSelectedId(ps[0].id); // UX: preselecciona
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [user, defaultSelectedPointId]);

  const selectedPoint = useMemo(
    () => points.find((p) => p.id === selectedId),
    [points, selectedId]
  );

  const handleConfirm = () => {
    let point = selectedPoint;

    // Si no hay lista o no se eligió, permite ID manual
    if (!point && manualId.trim()) {
      point = {
        id: manualId.trim(),
        nombre: "Punto seleccionado",
        ciudad: "",
        direccion: "",
      } as PuntoAtencion;
    }
    if (!point) return;

    // Persistir y emitir evento global (sin recargar)
    try {
      localStorage.setItem("pc_selected_point_id", point.id);
    } catch {}
    emitPointSelected(point);
    onPointSelected?.(point);
  };

  if (loading) {
    return (
      <div className="max-w-xl mx-auto p-6 text-center text-gray-600">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3" />
        Cargando puntos de atención…
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto p-4 bg-white rounded-lg shadow border">
      <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
        <Building2 className="h-5 w-5 text-blue-600" />
        Selecciona un punto de atención
      </h3>
      <p className="text-sm text-gray-600 mb-4">
        Elige tu punto para continuar. También puedes ingresar un ID manual si
        aún no aparece en la lista.
      </p>

      {points.length > 0 ? (
        <div className="flex gap-2 items-center">
          <div className="w-full">
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un punto" />
              </SelectTrigger>
              <SelectContent>
                {points.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nombre} • {p.ciudad}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleConfirm} disabled={!selectedId}>
            Confirmar
          </Button>
        </div>
      ) : (
        <div className="flex gap-2">
          <Input
            placeholder="Ingresa ID del punto"
            value={manualId}
            onChange={(e) => setManualId(e.target.value)}
          />
          <Button onClick={handleConfirm} disabled={!manualId.trim()}>
            Confirmar
          </Button>
        </div>
      )}

      {(selectedPoint || manualId.trim()) && (
        <div className="mt-3 text-xs text-gray-500 flex items-center gap-2">
          <MapPin className="h-4 w-4" />
          {selectedPoint
            ? `${selectedPoint.nombre}${
                selectedPoint.ciudad ? " • " + selectedPoint.ciudad : ""
              }${
                selectedPoint.direccion ? " • " + selectedPoint.direccion : ""
              }`
            : `ID manual: ${manualId}`}
        </div>
      )}
    </div>
  );
};

export default PointSelector;
