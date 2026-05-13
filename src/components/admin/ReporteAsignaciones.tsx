import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { PuntoAtencion, Moneda } from "../../types";
import { pointService } from "../../services/pointService";
import { currencyService } from "../../services/currencyService";
import {
  reporteAsignacionesService,
  UnifiedAssignment,
  ReporteResumen,
} from "../../services/reporteAsignacionesService";
import { FileSpreadsheet, Search, RotateCcw } from "lucide-react";

const SERVICIOS_EXTERNOS = [
  { value: "YAGANASTE", label: "YaGanaste" },
  { value: "BANCO_GUAYAQUIL", label: "Banco Guayaquil" },
  { value: "WESTERN", label: "Western Union" },
  { value: "PRODUBANCO", label: "Produbanco" },
  { value: "BANCO_PACIFICO", label: "Banco Pacífico" },
  { value: "SERVIENTREGA", label: "Servientrega" },
  { value: "INSUMOS_OFICINA", label: "Insumos Oficina" },
  { value: "INSUMOS_LIMPIEZA", label: "Insumos Limpieza" },
  { value: "OTROS", label: "Otros" },
];

const ALL_OPTION_VALUE = "__ALL__";

const CATEGORIAS = [
  { value: ALL_OPTION_VALUE, label: "Todas las categorías" },
  { value: "GENERAL", label: "Saldos Generales" },
  { value: "SERVICIO_EXTERNO", label: "Servicios Externos" },
  { value: "SERVIENTREGA", label: "Servientrega" },
];

const TIPOS = [
  { value: ALL_OPTION_VALUE, label: "Todos los tipos" },
  { value: "INICIAL", label: "Inicial" },
  { value: "RECARGA", label: "Recarga" },
];

const ReporteAsignaciones = () => {
  const [points, setPoints] = useState<PuntoAtencion[]>([]);
  const [monedas, setMonedas] = useState<Moneda[]>([]);
  const [loadingCatalogs, setLoadingCatalogs] = useState(true);
  const [loading, setLoading] = useState(false);

  const [asignaciones, setAsignaciones] = useState<UnifiedAssignment[]>([]);
  const [resumen, setResumen] = useState<ReporteResumen | null>(null);

  const [filtros, setFiltros] = useState({
    punto_atencion_id: "",
    from: "",
    to: "",
    tipo: "",
    categoria: "",
    servicio: "",
    moneda_id: "",
  });

  useEffect(() => {
    loadCatalogs();
  }, []);

  const loadCatalogs = async () => {
    try {
      setLoadingCatalogs(true);
      const [pointsRes, currenciesRes] = await Promise.all([
        pointService.getAllPointsForAdmin(),
        currencyService.getAllCurrencies(),
      ]);
      setPoints(pointsRes.points || []);
      setMonedas(currenciesRes.currencies || []);
    } catch {
      toast.error("Error cargando catálogos");
    } finally {
      setLoadingCatalogs(false);
    }
  };

  const handleBuscar = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await reporteAsignacionesService.getReporte({
        punto_atencion_id: filtros.punto_atencion_id || undefined,
        from: filtros.from || undefined,
        to: filtros.to || undefined,
        tipo: (filtros.tipo as any) || undefined,
        categoria: (filtros.categoria as any) || undefined,
        servicio: filtros.servicio || undefined,
        moneda_id: filtros.moneda_id || undefined,
      });

      if (error || !data) {
        toast.error(error || "Error cargando reporte");
        setAsignaciones([]);
        setResumen(null);
        return;
      }

      setAsignaciones(data.asignaciones || []);
      setResumen(data.resumen || null);

      if (data.asignaciones.length === 0) {
        toast.info("No se encontraron asignaciones con los filtros seleccionados");
      }
    } catch {
      toast.error("Error inesperado cargando reporte");
    } finally {
      setLoading(false);
    }
  }, [filtros]);

  const handleExportarExcel = useCallback(() => {
    if (asignaciones.length === 0) {
      toast.warning("No hay datos para exportar");
      return;
    }

    const rows = asignaciones.map((a) => ({
      Fecha: new Date(a.fecha).toLocaleString("es-EC", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
      Categoría:
        a.categoria === "GENERAL"
          ? "Saldos Generales"
          : a.categoria === "SERVIENTREGA"
          ? "Servientrega"
          : "Servicios Externos",
      Servicio: a.servicio || "—",
      Punto: a.punto_atencion_nombre,
      Moneda: `${a.moneda_nombre} (${a.moneda_codigo})`,
      Tipo: a.tipo === "INICIAL" ? "Inicial" : "Recarga",
      "Saldo Anterior": a.saldo_anterior,
      "Cantidad Asignada": a.cantidad_asignada,
      "Saldo Nuevo": a.saldo_nuevo,
      "Asignado Por": a.asignado_por_nombre,
      Observaciones: a.observaciones || "",
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Asignaciones");

    const fechaStr = new Date().toISOString().split("T")[0];
    XLSX.writeFile(wb, `reporte_asignaciones_${fechaStr}.xlsx`);
    toast.success("Reporte exportado exitosamente");
  }, [asignaciones]);

  const handleReset = () => {
    setFiltros({
      punto_atencion_id: "",
      from: "",
      to: "",
      tipo: "",
      categoria: "",
      servicio: "",
      moneda_id: "",
    });
    setAsignaciones([]);
    setResumen(null);
  };

  const badgeCategoria = (cat: string) => {
    switch (cat) {
      case "GENERAL":
        return (
          <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
            Saldos Generales
          </span>
        );
      case "SERVICIO_EXTERNO":
        return (
          <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
            Servicio Externo
          </span>
        );
      case "SERVIENTREGA":
        return (
          <span className="px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700">
            Servientrega
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
            {cat}
          </span>
        );
    }
  };

  const showServicioFilter =
    filtros.categoria === "SERVICIO_EXTERNO" || filtros.categoria === "";

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-foreground">
            📊 Reporte Consolidado de Asignaciones
          </h2>
          <p className="text-sm text-muted-foreground">
            Visualice todas las asignaciones de saldo realizadas a puntos de atención,
            servicios externos y Servientrega.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleExportarExcel}
            disabled={asignaciones.length === 0}
            className="gap-2"
          >
            <FileSpreadsheet className="h-4 w-4" />
            Exportar Excel
          </Button>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label className="text-xs">Punto de Atención</Label>
              <Select
                value={filtros.punto_atencion_id || ALL_OPTION_VALUE}
                onValueChange={(v) =>
                  setFiltros((prev) => ({
                    ...prev,
                    punto_atencion_id: v === ALL_OPTION_VALUE ? "" : v,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos los puntos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_OPTION_VALUE}>Todos los puntos</SelectItem>
                  {points.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Categoría</Label>
              <Select
                value={filtros.categoria || ALL_OPTION_VALUE}
                onValueChange={(v) =>
                  setFiltros((prev) => ({
                    ...prev,
                    categoria: v === ALL_OPTION_VALUE ? "" : v,
                    servicio: "",
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIAS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Tipo</Label>
              <Select
                value={filtros.tipo || ALL_OPTION_VALUE}
                onValueChange={(v) =>
                  setFiltros((prev) => ({
                    ...prev,
                    tipo: v === ALL_OPTION_VALUE ? "" : v,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Moneda</Label>
              <Select
                value={filtros.moneda_id || ALL_OPTION_VALUE}
                onValueChange={(v) =>
                  setFiltros((prev) => ({
                    ...prev,
                    moneda_id: v === ALL_OPTION_VALUE ? "" : v,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todas las monedas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_OPTION_VALUE}>Todas las monedas</SelectItem>
                  {monedas.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.nombre} ({m.codigo})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Desde</Label>
              <Input
                type="date"
                value={filtros.from}
                onChange={(e) =>
                  setFiltros((prev) => ({ ...prev, from: e.target.value }))
                }
              />
            </div>

            <div>
              <Label className="text-xs">Hasta</Label>
              <Input
                type="date"
                value={filtros.to}
                onChange={(e) =>
                  setFiltros((prev) => ({ ...prev, to: e.target.value }))
                }
              />
            </div>

            {showServicioFilter && (
              <div>
                <Label className="text-xs">Servicio Específico</Label>
                <Select
                  value={filtros.servicio || ALL_OPTION_VALUE}
                  onValueChange={(v) =>
                    setFiltros((prev) => ({
                      ...prev,
                      servicio: v === ALL_OPTION_VALUE ? "" : v,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Todos los servicios" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_OPTION_VALUE}>Todos los servicios</SelectItem>
                    {SERVICIOS_EXTERNOS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>
                        {s.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex items-end gap-2">
              <Button
                onClick={handleBuscar}
                disabled={loading || loadingCatalogs}
                className="flex-1 gap-2"
              >
                <Search className="h-4 w-4" />
                {loading ? "Buscando..." : "Buscar"}
              </Button>
              <Button variant="outline" onClick={handleReset} className="gap-2">
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resumen */}
      {resumen && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="text-xs text-blue-600 font-medium">Saldos Generales</div>
            <div className="text-lg font-bold text-blue-800">
              ${resumen.total_general.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <div className="text-xs text-green-600 font-medium">Servicios Externos</div>
            <div className="text-lg font-bold text-green-800">
              ${resumen.total_servicios_externos.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
            <div className="text-xs text-orange-600 font-medium">Servientrega</div>
            <div className="text-lg font-bold text-orange-800">
              ${resumen.total_servientrega.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
            <div className="text-xs text-purple-600 font-medium">Asignaciones Iniciales</div>
            <div className="text-lg font-bold text-purple-800">
              ${resumen.total_inicial.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </div>
          <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
            <div className="text-xs text-indigo-600 font-medium">Recargas</div>
            <div className="text-lg font-bold text-indigo-800">
              ${resumen.total_recarga.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>
      )}

      {/* Tabla */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            📋 Asignaciones{" "}
            {asignaciones.length > 0 && (
              <span className="text-sm font-normal text-muted-foreground">
                ({asignaciones.length} registros)
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {asignaciones.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 border-b">
                  <tr>
                    <th className="px-3 py-2 text-left">Fecha</th>
                    <th className="px-3 py-2 text-left">Categoría</th>
                    <th className="px-3 py-2 text-left">Servicio</th>
                    <th className="px-3 py-2 text-left">Punto</th>
                    <th className="px-3 py-2 text-left">Moneda</th>
                    <th className="px-3 py-2 text-left">Tipo</th>
                    <th className="px-3 py-2 text-right">Saldo Ant.</th>
                    <th className="px-3 py-2 text-right">Asignado</th>
                    <th className="px-3 py-2 text-right">Saldo Nuevo</th>
                    <th className="px-3 py-2 text-left">Asignado Por</th>
                    <th className="px-3 py-2 text-left">Obs.</th>
                  </tr>
                </thead>
                <tbody>
                  {asignaciones.map((a) => (
                    <tr key={a.id} className="border-b hover:bg-gray-50">
                      <td className="px-3 py-2 whitespace-nowrap">
                        {new Date(a.fecha).toLocaleString("es-EC", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td className="px-3 py-2">{badgeCategoria(a.categoria)}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {a.servicio
                          ? SERVICIOS_EXTERNOS.find((s) => s.value === a.servicio)
                              ?.label || a.servicio
                          : "—"}
                      </td>
                      <td className="px-3 py-2">{a.punto_atencion_nombre}</td>
                      <td className="px-3 py-2">
                        {a.moneda_codigo} {a.moneda_simbolo}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-medium ${
                            a.tipo === "INICIAL"
                              ? "bg-green-100 text-green-700"
                              : "bg-blue-100 text-blue-700"
                          }`}
                        >
                          {a.tipo === "INICIAL" ? "🆕 Inicial" : "🔄 Recarga"}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-mono">
                        {a.saldo_anterior.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-semibold text-green-600">
                        +
                        {a.cantidad_asignada.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-medium">
                        {a.saldo_nuevo.toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                      <td className="px-3 py-2">{a.asignado_por_nombre}</td>
                      <td className="px-3 py-2 text-gray-500 max-w-[200px] truncate">
                        {a.observaciones || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-400">
              <div className="text-4xl mb-2">📊</div>
              <p className="font-medium">No hay asignaciones para mostrar</p>
              <p className="text-sm">Seleccione filtros y presione Buscar</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ReporteAsignaciones;
