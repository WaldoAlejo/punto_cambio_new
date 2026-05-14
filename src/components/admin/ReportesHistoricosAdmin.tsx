import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, FileSpreadsheet, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const API_URL = import.meta.env.VITE_API_URL || "";

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

  const handleDownload = async (key: string, url: string, filename: string) => {
    if (downloading[key]) return;

    setDownloading((prev) => ({ ...prev, [key]: true }));
    try {
      await downloadFile(url, filename);
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

  const reports = [
    {
      key: "cambios-divisa",
      title: "Cambios de Divisa + Asignaciones",
      description:
        "Todo el historial de cambios de divisa (moneda origen, destino, tasa, montos, punto, operador) y asignaciones de saldo desde el inicio de la aplicación.",
      url: "/reportes/cambios-divisa-historico",
      filename: `reporte_cambios_divisa_historico_${today}.xlsx`,
      icon: <FileSpreadsheet className="h-8 w-8 text-emerald-600" />,
      color: "bg-emerald-50 border-emerald-200",
    },
    {
      key: "servicios-externos",
      title: "Servicios Externos",
      description:
        "Todo el historial de movimientos (ingresos/egresos por punto y servicio) y asignaciones de servicios externos con saldos desde el inicio de la aplicación.",
      url: "/reportes/servicios-externos-historico",
      filename: `reporte_servicios_externos_historico_${today}.xlsx`,
      icon: <FileSpreadsheet className="h-8 w-8 text-blue-600" />,
      color: "bg-blue-50 border-blue-200",
    },
    {
      key: "servientrega-guias",
      title: "Guías Servientrega",
      description:
        "Todo el historial de guías Servientrega generadas en todos los puntos (número de guía, origen, destino, valor, costo, punto de generación, operador).",
      url: "/reportes/servientrega-guias-historico",
      filename: `reporte_servientrega_guias_historico_${today}.xlsx`,
      icon: <FileSpreadsheet className="h-8 w-8 text-purple-600" />,
      color: "bg-purple-50 border-purple-200",
    },
    {
      key: "asignaciones-transferencias",
      title: "Asignaciones y Transferencias",
      description:
        "Todo el historial de asignaciones de saldo (inicial y recarga por punto/divisa/operador) y transferencias entre puntos con trazabilidad completa (solicitud, aprobación, envío, aceptación, rechazo).",
      url: "/reportes/asignaciones-transferencias-historico",
      filename: `reporte_asignaciones_transferencias_historico_${today}.xlsx`,
      icon: <FileSpreadsheet className="h-8 w-8 text-amber-600" />,
      color: "bg-amber-50 border-amber-200",
    },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">📊 Reportes Históricos Completos</h1>
      <p className="text-gray-600 mb-8">
        Descarga informes históricos desde el inicio de la aplicación hasta hoy.
        Estos archivos pueden tardar varios segundos en generarse dependiendo del volumen de datos.
      </p>

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
