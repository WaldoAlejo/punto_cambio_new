import React, { useEffect, useMemo, useState } from "react";
import {
  listarMovimientosServiciosExternos,
  anularMovimientoServicioExterno,
  ServicioExterno,
  TipoMovimiento,
} from "@/services/externalServicesService";
import { useAuth } from "@/hooks/useAuth";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type Row = {
  id: string;
  punto_atencion_id: string;
  servicio: ServicioExterno;
  tipo_movimiento: TipoMovimiento;
  moneda_id: string;
  monto: number;
  usuario_id: string;
  fecha: string;
  descripcion?: string;
  numero_referencia?: string;
  comprobante_url?: string;
  usuario?: { id: string; nombre: string };
};

const SERVICIOS: { value: "" | ServicioExterno; label: string }[] = [
  { value: "", label: "Todos" },
  { value: "YAGANASTE", label: "YaGanaste" },
  { value: "BANCO_GUAYAQUIL", label: "Banco Guayaquil" },
  { value: "WESTERN", label: "Western Union" },
  { value: "PRODUBANCO", label: "Produbanco" },
  { value: "BANCO_PACIFICO", label: "Banco del Pacífico" },
  { value: "INSUMOS_OFICINA", label: "Insumos de oficina" },
  { value: "INSUMOS_LIMPIEZA", label: "Insumos de limpieza" },
  { value: "OTROS", label: "Otros" },
];

const TIPOS: { value: "" | TipoMovimiento; label: string }[] = [
  { value: "", label: "Todos" },
  { value: "INGRESO", label: "Ingreso" },
  { value: "EGRESO", label: "Egreso" },
];

export default function ServiciosExternosHistory() {
  const { user } = useAuth();
  const pointId = user?.punto_atencion_id || null;

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  const [servicio, setServicio] = useState<"" | ServicioExterno>("");
  const [tipo, setTipo] = useState<"" | TipoMovimiento>("");
  const [desde, setDesde] = useState<string>("");
  const [hasta, setHasta] = useState<string>("");

  const [anulandoId, setAnulandoId] = useState<string | null>(null);
  const [motivoAnulacion, setMotivoAnulacion] = useState<string>("");

  const canQuery = useMemo(() => !!pointId, [pointId]);

  const fetchData = async () => {
    // ✅ Guard directo sobre pointId: TS estrecha a `string`
    if (!pointId) return;
    setLoading(true);
    try {
      const resp = await listarMovimientosServiciosExternos(pointId, {
        servicio: (servicio || undefined) as any,
        tipo_movimiento: (tipo || undefined) as any,
        desde: desde || undefined,
        hasta: hasta || undefined,
        limit: 100,
      });
      setRows(resp?.movimientos || []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [servicio, tipo, pointId]); // ✅ incluye pointId

  return (
    <div className="space-y-4">
      {!pointId && (
        <div className="text-sm text-red-600">
          Debes iniciar jornada para ver movimientos del punto.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
        <div>
          <label className="text-sm">Servicio/Categoría</label>
          <Select
            onValueChange={(v) => setServicio((v === "ALL" ? "" : v) as any)}
            defaultValue="ALL"
          >
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              {SERVICIOS.map((s) => (
                <SelectItem key={s.value || "ALL"} value={s.value || "ALL"}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-sm">Tipo</label>
          <Select
            onValueChange={(v) => setTipo((v === "ALL" ? "" : v) as any)}
            defaultValue="ALL"
          >
            <SelectTrigger className="mt-1">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              {TIPOS.map((t) => (
                <SelectItem key={t.value || "ALL"} value={t.value || "ALL"}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-sm">Desde</label>
          <Input
            type="date"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
          />
        </div>

        <div>
          <label className="text-sm">Hasta</label>
          <Input
            type="date"
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
          />
        </div>

        <div className="flex items-end">
          <Button
            onClick={fetchData}
            disabled={!canQuery || loading}
            className="w-full"
          >
            {loading ? "Cargando..." : "Filtrar"}
          </Button>
        </div>
      </div>

      <div className="rounded border overflow-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="p-2 text-left">Fecha</th>
              <th className="p-2 text-left">Servicio / Categoría</th>
              <th className="p-2 text-left">Tipo</th>
              <th className="p-2 text-right">Monto (USD)</th>
              <th className="p-2 text-left">Referencia</th>
              <th className="p-2 text-left">Descripción</th>
              <th className="p-2 text-left">Usuario</th>
              {(user?.rol === "ADMIN" || user?.rol === "SUPER_USUARIO") && (
                <th className="p-2 text-left">Acciones</th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((it) => (
              <tr key={it.id} className="border-t">
                <td className="p-2">
                  {new Date(it.fecha).toLocaleString(undefined, {
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </td>
                <td className="p-2">
                  {SERVICIOS.find((s) => s.value === (it.servicio as any))
                    ?.label || it.servicio}
                </td>
                <td className="p-2">{it.tipo_movimiento}</td>
                <td className="p-2 text-right">{it.monto.toFixed(2)}</td>
                <td className="p-2">
                  {it.numero_referencia?.trim() ? it.numero_referencia : "-"}
                </td>
                <td className="p-2">{it.descripcion || "-"}</td>
                <td className="p-2">{it.usuario?.nombre || "-"}</td>
                {(user?.rol === "ADMIN" || user?.rol === "SUPER_USUARIO") && (
                  <td className="p-2">
                    <div className="flex gap-2">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setAnulandoId(it.id)}
                      >
                        Anular
                      </Button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal simple para motivo */}
      {anulandoId && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow p-4 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-2">Anular movimiento</h3>
            <p className="text-sm text-gray-600 mb-3">
              Describe el motivo de anulación. Esta acción registrará un reverso
              contable.
            </p>
            <textarea
              className="w-full border rounded p-2 h-28"
              placeholder="Motivo de anulación"
              value={motivoAnulacion}
              onChange={(e) => setMotivoAnulacion(e.target.value)}
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setAnulandoId(null);
                  setMotivoAnulacion("");
                }}
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={async () => {
                  if (!motivoAnulacion.trim()) return;
                  try {
                    await anularMovimientoServicioExterno(
                      anulandoId,
                      motivoAnulacion.trim()
                    );
                    setAnulandoId(null);
                    setMotivoAnulacion("");
                    await fetchData();
                  } catch (e) {
                    // opcional: mostrar toast de error
                  }
                }}
              >
                Confirmar anulación
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
