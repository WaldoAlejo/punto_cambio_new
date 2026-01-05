import React, { useEffect, useMemo, useState } from "react";
import {
  listarMovimientosServiciosExternos,
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
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { eliminarMovimientoServicioExterno } from "@/services/externalServicesService";
import { useConfirmationDialog } from "@/components/ui/confirmation-dialog";

type Row = {
  id: string;
  punto_atencion_id: string;
  servicio: ServicioExterno;
  tipo_movimiento: TipoMovimiento;
  moneda_id: string;
  monto: number | null;
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
  const { showConfirmation, ConfirmationDialog } = useConfirmationDialog();

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  const [servicio, setServicio] = useState<"" | ServicioExterno>("");
  const [tipo, setTipo] = useState<"" | TipoMovimiento>("");
  const [desde, setDesde] = useState<string>("");
  const [hasta, setHasta] = useState<string>("");

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
              <th className="p-2 text-right">Acciones</th>
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
                <td className="p-2 text-right">{(Number(it.monto) || 0).toFixed(2)}</td>
                <td className="p-2">
                  {it.numero_referencia?.trim() ? it.numero_referencia : "-"}
                </td>
                <td className="p-2">{it.descripcion || "-"}</td>
                <td className="p-2">{it.usuario?.nombre || "-"}</td>
                <td className="p-2 text-right">
                  {user?.rol === "ADMIN" || user?.rol === "SUPER_USUARIO" ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => {
                        showConfirmation(
                          "Eliminar movimiento",
                          "¿Eliminar este movimiento? Esto revertirá el saldo con un ajuste.",
                          async () => {
                            try {
                              const resp =
                                await eliminarMovimientoServicioExterno(it.id);
                              if (resp?.success) {
                                toast.success("Movimiento eliminado");
                                setRows((prev) =>
                                  prev.filter((r) => r.id !== it.id)
                                );
                              } else {
                                toast.error(
                                  resp?.error || "No se pudo eliminar"
                                );
                              }
                            } catch (e: any) {
                              toast.error(
                                e?.friendlyMessage ||
                                  e?.message ||
                                  "Error de conexión"
                              );
                            }
                          },
                          "destructive"
                        );
                      }}
                      title="Eliminar movimiento"
                      aria-label="Eliminar movimiento"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ConfirmationDialog />
    </div>
  );
}
