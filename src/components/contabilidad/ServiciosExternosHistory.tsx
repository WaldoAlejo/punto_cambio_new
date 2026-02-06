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

const extractErrorMessage = (err: unknown): string => {
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object") {
    const rec = err as Record<string, unknown>;
    const friendly = rec.friendlyMessage;
    if (typeof friendly === "string" && friendly.trim()) return friendly;
    const msg = rec.message;
    if (typeof msg === "string" && msg.trim()) return msg;
  }
  return "";
};

const isServicioExterno = (v: string): v is ServicioExterno =>
  SERVICIOS.some((s) => s.value !== "" && s.value === v);

const isTipoMovimiento = (v: string): v is TipoMovimiento =>
  v === "INGRESO" || v === "EGRESO";

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
      const servicioParam: ServicioExterno | undefined = servicio || undefined;
      const tipoParam: TipoMovimiento | undefined = tipo || undefined;
      const resp = await listarMovimientosServiciosExternos(pointId, {
        servicio: servicioParam,
        tipo_movimiento: tipoParam,
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 md:gap-3">
        <div>
          <label className="text-xs md:text-sm font-medium">Servicio/Categoría</label>
          <Select
            onValueChange={(v) => {
              if (v === "ALL") return setServicio("");
              if (isServicioExterno(v)) return setServicio(v);
              setServicio("");
            }}
            defaultValue="ALL"
          >
            <SelectTrigger className="mt-1 h-9">
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
          <label className="text-xs md:text-sm font-medium">Tipo</label>
          <Select
            onValueChange={(v) => {
              if (v === "ALL") return setTipo("");
              if (isTipoMovimiento(v)) return setTipo(v);
              setTipo("");
            }}
            defaultValue="ALL"
          >
            <SelectTrigger className="mt-1 h-9">
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
          <label className="text-xs md:text-sm font-medium">Desde</label>
          <Input
            type="date"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
            className="mt-1 h-9"
          />
        </div>

        <div>
          <label className="text-xs md:text-sm font-medium">Hasta</label>
          <Input
            type="date"
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
            className="mt-1 h-9"
          />
        </div>

        <div className="flex items-end">
          <Button
            onClick={fetchData}
            disabled={!canQuery || loading}
            className="w-full h-9"
            size="sm"
          >
            {loading ? "⏳ Cargando..." : "🔍 Filtrar"}
          </Button>
        </div>
      </div>

      <div className="rounded border overflow-x-auto">
        <table className="min-w-full text-xs md:text-sm">
          <thead className="bg-muted/50 sticky top-0">
            <tr>
              <th className="p-2 text-left whitespace-nowrap">Fecha</th>
              <th className="p-2 text-left whitespace-nowrap">Servicio / Categoría</th>
              <th className="p-2 text-left whitespace-nowrap">Tipo</th>
              <th className="p-2 text-right whitespace-nowrap">Monto (USD)</th>
              <th className="p-2 text-left whitespace-nowrap">Referencia</th>
              <th className="p-2 text-left whitespace-nowrap">Descripción</th>
              <th className="p-2 text-left whitespace-nowrap">Usuario</th>
              <th className="p-2 text-right whitespace-nowrap">Acciones</th>
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
                  {SERVICIOS.find((s) => s.value === it.servicio)
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
                            } catch (e: unknown) {
                              toast.error(
                                extractErrorMessage(e) || "Error de conexión"
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
