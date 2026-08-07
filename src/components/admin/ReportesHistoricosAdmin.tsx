import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { pointService } from "@/services/pointService";
import type { PuntoAtencion } from "@/types";

const API_URL = import.meta.env.VITE_API_URL || "";
const ALL_POINTS = "__ALL__";

async function downloadFile(url: string, filename: string): Promise<void> {
  const token = localStorage.getItem("authToken");
  if (!token) {
    throw new Error("No hay token de autenticación");
  }

  const response = await fetch(`${API_URL}${url}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Error ${response.status}`);
  }

  const blob = await response.blob();
  const objectUrl = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(objectUrl);
}

const ReportesHistoricosAdmin: React.FC = () => {
  const [downloading, setDownloading] = useState<Record<string, boolean>>({});
  const [points, setPoints] = useState<PuntoAtencion[]>([]);
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [puntoAtencionId, setPuntoAtencionId] = useState<string>(ALL_POINTS);

  useEffect(() => {
    pointService.getAllPointsForAdmin().then((res) => {
      if (!res.error) setPoints(res.points || []);
    });
  }, []);

  const buildFilteredUrl = (baseUrl: string) => {
    const params = new URLSearchParams();
    if (desde) params.set("desde", desde);
    if (hasta) params.set("hasta", hasta);
    if (puntoAtencionId !== ALL_POINTS) params.set("punto_atencion_id", puntoAtencionId);
    const query = params.toString();
    return query ? `${baseUrl}?${query}` : baseUrl;
  };

  const handleDownload = async (key: string, url: string, filename: string) => {
    if (downloading[key]) return;

    setDownloading((prev) => ({ ...prev, [key]: true }));
    try {
      await downloadFile(buildFilteredUrl(url), filename);
      toast({
        title: "✅ Descarga completada",
        description: filename,
      });
    } catch (error) {
      toast({
        title: "❌ Error al descargar",
        description: error instanceof Error ? error.message : "Error desconocido",
        variant: "destructive",
      });
    } finally {
      setDownloading((prev) => ({ ...prev, [key]: false }));
    }
  };

  const today = new Date().toISOString().slice(0, 10);
  const rangoArchivo = desde || hasta ? `${desde || "inicio"}_a_${hasta || today}` : today;

  const reports = [
    {
      key: "cambios-divisa",
      title: "Cambios de Divisa + Asignaciones",
      description:
        "Historial de cambios de divisa (moneda origen, destino, tasa, montos, punto, operador) y asignaciones de saldo, filtrable por punto de atención y rango de fechas.",
      url: "/reportes/cambios-divisa-historico",
      filename: `reporte_cambios_divisa_historico_${rangoArchivo}.xlsx`,
      icon: <FileSpreadsheet className="h-8 w-8 text-emerald-600" />,
      color: "bg-emerald-50 border-emerald-200",
    },
    {
      key: "servicios-externos",
      title: "Servicios Externos",
      description:
        "Historial de movimientos (ingresos/egresos por punto y servicio) y asignaciones de servicios externos con saldos, filtrable por punto de atención y rango de fechas.",
      url: "/reportes/servicios-externos-historico",
      filename: `reporte_servicios_externos_historico_${rangoArchivo}.xlsx`,
      icon: <FileSpreadsheet className="h-8 w-8 text-blue-600" />,
      color: "bg-blue-50 border-blue-200",
    },
    {
      key: "servientrega-guias",
      title: "Guías Servientrega",
      description:
        "Historial de guías Servientrega generadas (número de guía, origen, destino, valor, costo, punto de generación, operador), filtrable por punto de atención y rango de fechas.",
      url: "/reportes/servientrega-guias-historico",
      filename: `reporte_servientrega_guias_historico_${rangoArchivo}.xlsx`,
      icon: <FileSpreadsheet className="h-8 w-8 text-purple-600" />,
      color: "bg-purple-50 border-purple-200",
    },
    {
      key: "asignaciones-transferencias",
      title: "Asignaciones y Transferencias",
      description:
        "Historial de asignaciones de saldo (inicial y recarga por punto/divisa/operador) y transferencias entre puntos con trazabilidad completa, filtrable por punto de atención y rango de fechas.",
      url: "/reportes/asignaciones-transferencias-historico",
      filename: `reporte_asignaciones_transferencias_historico_${rangoArchivo}.xlsx`,
      icon: <FileSpreadsheet className="h-8 w-8 text-amber-600" />,
      color: "bg-amber-50 border-amber-200",
    },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">📊 Reportes Históricos Completos</h1>
      <p className="text-gray-600 mb-8">
        Descarga informes históricos filtrando por punto de atención y rango de fechas.
        Si no seleccionas filtros, se descarga todo el historial desde el inicio de la aplicación.
        Estos archivos pueden tardar varios segundos en generarse dependiendo del volumen de datos.
      </p>

      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="reportes-historicos-desde">Desde</Label>
              <Input
                id="reportes-historicos-desde"
                type="date"
                value={desde}
                onChange={(e) => setDesde(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reportes-historicos-hasta">Hasta</Label>
              <Input
                id="reportes-historicos-hasta"
                type="date"
                value={hasta}
                onChange={(e) => setHasta(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Punto de Atención</Label>
              <Select value={puntoAtencionId} onValueChange={setPuntoAtencionId}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos los puntos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_POINTS}>Todos los puntos</SelectItem>
                  {points.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-3">
        {reports.map((report) => (
          <Card
            key={report.key}
            className={`${report.color} hover:shadow-md transition-shadow`}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                {report.icon}
                <CardTitle className="text-lg">{report.title}</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-gray-700">{report.description}</p>
              <Button
                onClick={() =>
                  handleDownload(report.key, report.url, report.filename)
                }
                disabled={downloading[report.key]}
                className="w-full"
              >
                {downloading[report.key] ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generando Excel...
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    Descargar Excel
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-8 p-4 bg-amber-50 border border-amber-200 rounded-lg">
        <p className="text-sm text-amber-800">
          <strong>⚠️ Nota:</strong> Estos reportes incluyen <strong>todo el historial</strong> de la aplicación.
          Si hay miles de registros, la descarga puede tardar entre 10 y 30 segundos.
          No cierres la pestaña durante la generación.
        </p>
      </div>
    </div>
  );
};

export default ReportesHistoricosAdmin;
