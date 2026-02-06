import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import type { PuntoAtencion, User } from "@/types";
import {
  abrirCierreServiciosExternos,
  cerrarCierreServiciosExternos,
  statusCierreServiciosExternos,
  type ServicioExterno,
} from "@/services/externalServicesService";

type DetalleItem = {
  servicio: string;
  moneda_id: string;
  monto_movimientos: number; // neto del día
  monto_validado: number; // input usuario
  diferencia: number; // calculado
  observaciones?: string;
};

interface ExternalServicesCloseProps {
  user: User;
  selectedPoint: PuntoAtencion | null;
}

export default function ExternalServicesClose({
  user: _user,
  selectedPoint,
}: ExternalServicesCloseProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [estado, setEstado] = useState<"SIN_APERTURA" | "ABIERTO" | "CERRADO">(
    "SIN_APERTURA"
  );
  const [cierreId, setCierreId] = useState<string | null>(null);
  const [detalles, setDetalles] = useState<DetalleItem[]>([]);
  const [observaciones, setObservaciones] = useState("");

  const pointId = selectedPoint?.id;

  const puedeEditar = useMemo(() => estado === "ABIERTO", [estado]);

  const totalNeto = useMemo(
    () => detalles.reduce((acc, d) => acc + (d.monto_movimientos || 0), 0),
    [detalles]
  );

  const totalValidado = useMemo(
    () => detalles.reduce((acc, d) => acc + (Number(d.monto_validado) || 0), 0),
    [detalles]
  );

  const totalDiff = useMemo(
    () => Math.abs(totalValidado - totalNeto),
    [totalValidado, totalNeto]
  );

  // Tolerancia global ±1.00 USD
  const dentroTolerancia = totalDiff <= 1.0 + 1e-9;

  const cargarStatus = async () => {
    if (!pointId) return;
    try {
      setLoading(true);
      const data = await statusCierreServiciosExternos({ pointId });
      if (!data.success) throw new Error("No se pudo obtener estado");

      const cierre = data.cierre;
      setEstado(
        cierre?.estado === "CERRADO"
          ? "CERRADO"
          : cierre
          ? "ABIERTO"
          : "SIN_APERTURA"
      );
      setCierreId(cierre?.id || null);

      // Normalizar detalles a estructura editable
      const items: DetalleItem[] = (data.detalles || []).map((d) => ({
        servicio: d.servicio,
        moneda_id: d.moneda_id,
        monto_movimientos: Number(d.monto_movimientos || 0),
        monto_validado: Number(d.monto_validado ?? d.monto_movimientos ?? 0),
        diferencia: Number(d.diferencia ?? 0),
        observaciones: d.observaciones || "",
      }));

      // Si backend no devuelve detalles pero hay resumen_movimientos, construir base
      if (items.length === 0 && Array.isArray(data.resumen_movimientos)) {
        data.resumen_movimientos.forEach((r) => {
          items.push({
            servicio: r.servicio,
            moneda_id: "USD",
            monto_movimientos: Number(r.neto || 0),
            monto_validado: Number(r.neto || 0),
            diferencia: 0,
            observaciones: "",
          });
        });
      }

      setDetalles(items);
      setObservaciones("");
    } catch (e) {
      console.error("Error status servicios externos:", e);
      toast({
        title: "Error",
        description: "No se pudo cargar el estado de servicios externos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pointId]);

  const abrirCierre = async () => {
    if (!pointId) return;
    try {
      setSaving(true);
      const res = await abrirCierreServiciosExternos({ pointId });
      if (!res.success) throw new Error("No se pudo abrir el cierre");
      toast({
        title: "Cierre abierto",
        description: "Ahora puede validar montos",
      });
      await cargarStatus();
    } catch (e) {
      console.error(e);
      toast({
        title: "Error",
        description: "No se pudo abrir el cierre de servicios externos",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const actualizarMonto = (idx: number, value: string) => {
    setDetalles((prev) => {
      const copy = [...prev];
      const v = Number(value || 0);
      const base = Number(copy[idx].monto_movimientos || 0);
      copy[idx] = {
        ...copy[idx],
        monto_validado: isNaN(v) ? 0 : v,
        diferencia: Number(((isNaN(v) ? 0 : v) - base).toFixed(2)),
      };
      return copy;
    });
  };

  const actualizarObs = (idx: number, value: string) => {
    setDetalles((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], observaciones: value };
      return copy;
    });
  };

  const cerrarCierre = async () => {
    if (!pointId) return;
    if (estado !== "ABIERTO") {
      toast({
        title: "No disponible",
        description: "Debe abrir el cierre primero",
      });
      return;
    }

    if (!dentroTolerancia) {
      toast({
        title: "Fuera de tolerancia",
        description: "La diferencia total excede ±1.00 USD",
        variant: "destructive",
      });
      return;
    }

    try {
      setSaving(true);
      const payload = {
        pointId,
        detalles: detalles.map((d) => ({
          servicio: d.servicio as ServicioExterno,
          monto_validado: Number(d.monto_validado || 0),
          observaciones: d.observaciones || undefined,
        })),
        observaciones: observaciones || undefined,
      };
      const res = await cerrarCierreServiciosExternos(payload);
      if (!res.success) throw new Error("No se pudo cerrar el día");
      toast({
        title: "Cierre de servicios externos",
        description: "Cerrado correctamente",
      });
      await cargarStatus();
    } catch (e) {
      console.error(e);
      toast({
        title: "Error",
        description: "No se pudo cerrar el día",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Servicios Externos (USD)</CardTitle>
            <p className="text-sm text-gray-500">
              Validación con tolerancia ±1.00 USD sobre el neto de movimientos
              del día
            </p>
          </div>
          <div>
            {estado === "CERRADO" ? (
              <Badge variant="default" className="bg-green-600">
                CERRADO
              </Badge>
            ) : estado === "ABIERTO" ? (
              <Badge variant="secondary">ABIERTO</Badge>
            ) : (
              <Badge variant="outline">SIN APERTURA</Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!pointId ? (
          <div className="text-gray-500">
            Seleccione un punto para continuar
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <Button
                onClick={cargarStatus}
                variant="outline"
                disabled={loading || saving}
              >
                Refrescar
              </Button>
              {estado === "SIN_APERTURA" && (
                <Button onClick={abrirCierre} disabled={saving || loading}>
                  Abrir cierre
                </Button>
              )}
              {estado === "ABIERTO" && (
                <Button
                  onClick={cerrarCierre}
                  disabled={saving || loading || !dentroTolerancia}
                >
                  Guardar y Cerrar
                </Button>
              )}
            </div>

            <div className="overflow-auto border rounded">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left">Servicio</th>
                    <th className="px-3 py-2 text-right">
                      Neto movimientos (USD)
                    </th>
                    <th className="px-3 py-2 text-right">
                      Monto validado (USD)
                    </th>
                    <th className="px-3 py-2 text-right">Diferencia</th>
                  </tr>
                </thead>
                <tbody>
                  {detalles.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-3 py-4 text-center text-gray-400"
                      >
                        {loading
                          ? "Cargando..."
                          : "No hay servicios registrados hoy"}
                      </td>
                    </tr>
                  ) : (
                    detalles.map((d, idx) => {
                      const diffAbs = Math.abs(
                        Number(d.monto_validado || 0) -
                          Number(d.monto_movimientos || 0)
                      );
                      const ok = diffAbs <= 1.0 + 1e-9;
                      return (
                        <tr key={`${d.servicio}-${idx}`} className="border-t">
                          <td className="px-3 py-2">{d.servicio}</td>
                          <td className="px-3 py-2 text-right">
                            {Number(d.monto_movimientos || 0).toFixed(2)}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <Input
                              type="number"
                              step="0.01"
                              inputMode="decimal"
                              value={String(d.monto_validado ?? "")}
                              disabled={!puedeEditar}
                              onChange={(e) =>
                                actualizarMonto(idx, e.target.value)
                              }
                              className="text-right"
                            />
                            <div className="mt-2">
                              <Label
                                htmlFor={`obs-${idx}`}
                                className="text-xs text-gray-500"
                              >
                                Observaciones
                              </Label>
                              <Input
                                id={`obs-${idx}`}
                                value={d.observaciones || ""}
                                disabled={!puedeEditar}
                                onChange={(e) =>
                                  actualizarObs(idx, e.target.value)
                                }
                              />
                            </div>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <span
                              className={ok ? "text-green-600" : "text-red-600"}
                            >
                              {(
                                Number(d.monto_validado || 0) -
                                Number(d.monto_movimientos || 0)
                              ).toFixed(2)}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                {detalles.length > 0 && (
                  <tfoot>
                    <tr className="border-t bg-gray-50">
                      <td className="px-3 py-2 font-medium">Totales</td>
                      <td className="px-3 py-2 text-right font-mono">
                        {totalNeto.toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono">
                        {totalValidado.toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Badge
                          variant={dentroTolerancia ? "default" : "destructive"}
                          className={
                            dentroTolerancia ? "bg-green-600" : undefined
                          }
                        >
                          ±{totalDiff.toFixed(2)}
                        </Badge>
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            <div>
              <Label className="mb-1 block">Observaciones generales</Label>
              <Input
                placeholder="Opcional"
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                disabled={!puedeEditar}
              />
            </div>

            {estado === "CERRADO" && (
              <div className="text-sm text-gray-500">Cierre ID: {cierreId}</div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
