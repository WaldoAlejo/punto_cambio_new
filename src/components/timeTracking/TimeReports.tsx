import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Download, FileText, Clock } from "lucide-react";
import { User, PuntoAtencion } from "../../types";
import { useToast } from "@/hooks/use-toast";

interface TimeReportsProps {
  _user: User;
  selectedPoint: PuntoAtencion | null;
}

const TimeReports = ({ selectedPoint }: TimeReportsProps) => {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [reportData, setReportData] = useState<TimeReportData[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  interface TimeReportData {
    fecha: string;
    horaInicio: string;
    horaFin: string;
    tiempoTotal: number;
    salidasEspontaneas: number;
    tiempoSalidas: number;
    tiempoEfectivo: number;
  }

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
      // Simulated data - replace with actual service call
      const mockData: TimeReportData[] = [
        {
          fecha: "2024-01-15",
          horaInicio: "08:00",
          horaFin: "17:00",
          tiempoTotal: 540,
          salidasEspontaneas: 3,
          tiempoSalidas: 45,
          tiempoEfectivo: 495,
        },
        {
          fecha: "2024-01-16",
          horaInicio: "08:15",
          horaFin: "17:00",
          tiempoTotal: 525,
          salidasEspontaneas: 2,
          tiempoSalidas: 30,
          tiempoEfectivo: 495,
        },
      ];

      setReportData(mockData);

      toast({
        title: "Reporte generado",
        description: "El reporte de tiempo se ha generado exitosamente",
      });
    } catch (error) {
      console.error("Error generating time report:", error);
      toast({
        title: "Error",
        description: "Error al generar el reporte de tiempo",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatMinutes = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Reporte de Tiempo
          </CardTitle>
          <CardDescription>
            Genere reportes detallados del tiempo trabajado
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="space-y-2">
              <Label htmlFor="dateFrom">Fecha Desde</Label>
              <Input
                id="dateFrom"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dateTo">Fecha Hasta</Label>
              <Input
                id="dateTo"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={generateReport}
                disabled={isLoading}
                className="w-full"
              >
                <FileText className="mr-2 h-4 w-4" />
                {isLoading ? "Generando..." : "Generar"}
              </Button>
            </div>
          </div>

          {selectedPoint && (
            <div className="mb-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Punto:</strong> {selectedPoint.nombre}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {reportData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Resultados del Reporte</CardTitle>
            <CardDescription>
              Detalle del tiempo trabajado en el período seleccionado
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Hora Inicio</TableHead>
                  <TableHead>Hora Fin</TableHead>
                  <TableHead>Tiempo Total</TableHead>
                  <TableHead>Salidas</TableHead>
                  <TableHead>Tiempo Salidas</TableHead>
                  <TableHead>Tiempo Efectivo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reportData.map((row, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      {new Date(row.fecha).toLocaleDateString()}
                    </TableCell>
                    <TableCell>{row.horaInicio}</TableCell>
                    <TableCell>{row.horaFin}</TableCell>
                    <TableCell>{formatMinutes(row.tiempoTotal)}</TableCell>
                    <TableCell>{row.salidasEspontaneas}</TableCell>
                    <TableCell>{formatMinutes(row.tiempoSalidas)}</TableCell>
                    <TableCell className="font-medium">
                      {formatMinutes(row.tiempoEfectivo)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="flex justify-end mt-4">
              <Button variant="outline">
                <Download className="mr-2 h-4 w-4" />
                Exportar Excel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default TimeReports;
