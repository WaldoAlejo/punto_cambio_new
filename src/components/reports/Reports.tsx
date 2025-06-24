import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FileText, Download, TrendingUp } from "lucide-react";
import { User, PuntoAtencion } from "../../types";
import { reportService } from "../../services/reportService";
import { exportToExcel } from "../../utils/exportToExcel";
import { useToast } from "@/hooks/use-toast";
import ReportTable from "./ReportTable";
import ReportChart from "./ReportChart";
import ReportFilters from "./ReportFilters";

interface ReportsProps {
  user: User;
  selectedPoint: PuntoAtencion | null;
}

interface ReportItem {
  point: string;
  user?: string;
  exchanges?: number;
  amount?: number;
  transfers?: number;
  balance?: number;
}

interface ReportData {
  exchanges: ReportItem[];
  transfers: ReportItem[];
  summary: {
    totalExchanges: number;
    totalTransfers: number;
    totalVolume: number;
    averageTransaction: number;
  };
}

type ReportType = "exchanges" | "transfers" | "balances" | "users" | "summary";

const Reports = ({ user, selectedPoint }: ReportsProps) => {
  const [reportType, setReportType] = useState<ReportType>("summary");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    setDateFrom(firstDay.toISOString().split("T")[0]);
    setDateTo(lastDay.toISOString().split("T")[0]);
  }, []);

  const generateReport = async () => {
    if (!dateFrom || !dateTo) {
      toast({
        title: "Error",
        description: "Por favor seleccione las fechas del reporte",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const filters = {
        dateFrom,
        dateTo,
        pointId: selectedPoint?.id,
        userId: user.rol === "OPERADOR" ? user.id : undefined,
      };

      const data = await reportService.generateReport(reportType, filters);
      setReportData(data as ReportData);

      toast({
        title: "Reporte generado",
        description: "El reporte se ha generado exitosamente",
      });
    } catch (error) {
      console.error("Error generating report:", error);
      toast({
        title: "Error",
        description: "Error al generar el reporte",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const exportReport = async () => {
    if (!reportData) {
      toast({
        title: "Error",
        description: "No hay datos para exportar",
        variant: "destructive",
      });
      return;
    }

    try {
      const dataToExport =
        reportType === "exchanges"
          ? reportData.exchanges
          : reportData.transfers;

      const formatted = dataToExport.map((item) => ({
        Punto: item.point,
        Usuario: item.user || "",
        Transacciones: item.exchanges || item.transfers || 0,
        Monto: item.amount || 0,
      }));

      await exportToExcel(
        formatted,
        `reporte_${reportType}_${dateFrom}_${dateTo}`
      );

      toast({
        title: "Exportación exitosa",
        description: "El reporte se ha exportado a Excel",
      });
    } catch (error) {
      console.error("Error exporting report:", error);
      toast({
        title: "Error",
        description: "Error al exportar el reporte",
        variant: "destructive",
      });
    }
  };

  if (user.rol !== "ADMIN" && user.rol !== "SUPER_USUARIO") {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-red-500 text-lg">
            No tiene permisos para acceder a esta sección
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Reportes</h1>
        <div className="flex gap-2">
          <Button onClick={generateReport} disabled={isLoading}>
            <FileText className="mr-2 h-4 w-4" />
            {isLoading ? "Generando..." : "Generar Reporte"}
          </Button>
          {reportData && reportType !== "summary" && (
            <Button onClick={exportReport} variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Exportar Excel
            </Button>
          )}
        </div>
      </div>

      <ReportFilters
        reportType={reportType}
        onReportTypeChange={(value: string) =>
          setReportType(value as ReportType)
        }
        dateFrom={dateFrom}
        onDateFromChange={setDateFrom}
        dateTo={dateTo}
        onDateToChange={setDateTo}
        onGenerateReport={generateReport}
      />

      {reportData && (
        <div className="space-y-6">
          {reportType === "summary" && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Total Cambios
                  </CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {reportData.summary.totalExchanges}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Total Transferencias
                  </CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {reportData.summary.totalTransfers}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Volumen Total
                  </CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    ${reportData.summary.totalVolume.toLocaleString()}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Promedio por Transacción
                  </CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    ${reportData.summary.averageTransaction.toLocaleString()}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
          {(reportType === "exchanges" || reportType === "transfers") && (
            <>
              <ReportChart
                data={
                  reportType === "exchanges"
                    ? reportData.exchanges
                    : reportData.transfers
                }
                reportType={reportType}
              />
              <ReportTable
                data={
                  reportType === "exchanges"
                    ? reportData.exchanges
                    : reportData.transfers
                }
                reportType={reportType}
              />
            </>
          )}
        </div>
      )}

      {!reportData && !isLoading && (
        <Card>
          <CardHeader>
            <CardTitle>Generar Reporte</CardTitle>
            <CardDescription>
              Seleccione el tipo de reporte y el rango de fechas para generar el
              informe
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <FileText className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">
                  No hay datos
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  Configure los filtros y genere un reporte para ver los datos
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Reports;
