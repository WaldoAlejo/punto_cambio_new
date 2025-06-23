
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { scheduleService } from "@/services/scheduleService";
import { spontaneousExitService } from "@/services/spontaneousExitService";
import { Schedule, SalidaEspontanea } from "@/types";
import { Clock, Download } from "lucide-react";

export const TimeReports = () => {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [exits, setExits] = useState<SalidaEspontanea[]>([]);
  const [loading, setLoading] = useState(false);
  const [reportType, setReportType] = useState<"schedules" | "exits">("schedules");
  const [filters, setFilters] = useState({
    dateFrom: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    dateTo: new Date().toISOString().split('T')[0],
  });
  const { toast } = useToast();

  const generateReport = async () => {
    setLoading(true);
    try {
      if (reportType === "schedules") {
        const result = await scheduleService.getAllSchedules();
        if (result.error) {
          toast({
            title: "Error",
            description: result.error,
            variant: "destructive",
          });
        } else {
          const filteredSchedules = result.schedules.filter(schedule => {
            const scheduleDate = new Date(schedule.fecha_inicio).toISOString().split('T')[0];
            return scheduleDate >= filters.dateFrom && scheduleDate <= filters.dateTo;
          });
          setSchedules(filteredSchedules);
          toast({
            title: "Éxito",
            description: `Reporte generado con ${filteredSchedules.length} registros`,
          });
        }
      } else {
        const result = await spontaneousExitService.getAllExits();
        if (result.error) {
          toast({
            title: "Error",
            description: result.error,
            variant: "destructive",
          });
        } else {
          const filteredExits = result.exits.filter(exit => {
            const exitDate = new Date(exit.fecha_salida).toISOString().split('T')[0];
            return exitDate >= filters.dateFrom && exitDate <= filters.dateTo;
          });
          setExits(filteredExits);
          toast({
            title: "Éxito",
            description: `Reporte generado con ${filteredExits.length} registros`,
          });
        }
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al generar el reporte",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    const data = reportType === "schedules" ? schedules : exits;
    if (data.length === 0) {
      toast({
        title: "Error",
        description: "No hay datos para exportar",
        variant: "destructive",
      });
      return;
    }

    let csv = '';
    if (reportType === "schedules") {
      csv = 'Usuario,Punto,Fecha Inicio,Fecha Almuerzo,Fecha Regreso,Fecha Salida,Estado\n';
      schedules.forEach(schedule => {
        csv += `${schedule.usuario?.nombre || 'N/A'},${schedule.puntoAtencion?.nombre || 'N/A'},${schedule.fecha_inicio},${schedule.fecha_almuerzo || ''},${schedule.fecha_regreso || ''},${schedule.fecha_salida || ''},${schedule.estado}\n`;
      });
    } else {
      csv = 'Usuario,Punto,Motivo,Fecha Salida,Fecha Regreso,Duración (min),Estado\n';
      exits.forEach(exit => {
        csv += `${exit.usuario?.nombre || 'N/A'},${exit.puntoAtencion?.nombre || 'N/A'},${exit.motivo},${exit.fecha_salida},${exit.fecha_regreso || ''},${exit.duracion_minutos || ''},${exit.estado}\n`;
      });
    }
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reporte_${reportType}_${filters.dateFrom}_${filters.dateTo}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const calculateWorkingHours = (schedule: Schedule) => {
    if (!schedule.fecha_inicio || !schedule.fecha_salida) return 0;
    
    const start = new Date(schedule.fecha_inicio);
    const end = new Date(schedule.fecha_salida);
    const diff = end.getTime() - start.getTime();
    
    // Restar tiempo de almuerzo si existe
    let lunchTime = 0;
    if (schedule.fecha_almuerzo && schedule.fecha_regreso) {
      const lunchStart = new Date(schedule.fecha_almuerzo);
      const lunchEnd = new Date(schedule.fecha_regreso);
      lunchTime = lunchEnd.getTime() - lunchStart.getTime();
    }
    
    return Math.max(0, (diff - lunchTime) / (1000 * 60 * 60)); // Horas
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ACTIVO":
        return "default";
      case "COMPLETADO":
        return "secondary";
      case "CANCELADO":
        return "destructive";
      default:
        return "outline";
    }
  };

  const getMotivoColor = (motivo: string) => {
    switch (motivo) {
      case "BANCO":
        return "default";
      case "DILIGENCIA_PERSONAL":
        return "secondary";
      case "TRAMITE_GOBIERNO":
        return "outline";
      case "EMERGENCIA_MEDICA":
        return "destructive";
      default:
        return "outline";
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Clock className="h-5 w-5" />
            <CardTitle>Reportes de Tiempo</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div>
              <Label htmlFor="reportType">Tipo de Reporte</Label>
              <Select
                value={reportType}
                onValueChange={(value) => setReportType(value as "schedules" | "exits")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="schedules">Jornadas Laborales</SelectItem>
                  <SelectItem value="exits">Salidas Espontáneas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="dateFrom">Fecha Desde</Label>
              <Input
                id="dateFrom"
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="dateTo">Fecha Hasta</Label>
              <Input
                id="dateTo"
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
              />
            </div>
            <div className="flex items-end space-x-2">
              <Button onClick={generateReport} disabled={loading} className="flex-1">
                {loading ? "Generando..." : "Generar"}
              </Button>
              {((reportType === "schedules" && schedules.length > 0) || 
                (reportType === "exits" && exits.length > 0)) && (
                <Button variant="outline" onClick={exportToCSV}>
                  <Download className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {reportType === "schedules" && schedules.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Jornadas Laborales</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Punto</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Inicio</TableHead>
                  <TableHead>Almuerzo</TableHead>
                  <TableHead>Regreso</TableHead>
                  <TableHead>Salida</TableHead>
                  <TableHead>Horas Trabajadas</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedules.map((schedule) => (
                  <TableRow key={schedule.id}>
                    <TableCell>{schedule.usuario?.nombre || 'N/A'}</TableCell>
                    <TableCell>{schedule.puntoAtencion?.nombre || 'N/A'}</TableCell>
                    <TableCell>
                      {new Date(schedule.fecha_inicio).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {new Date(schedule.fecha_inicio).toLocaleTimeString()}
                    </TableCell>
                    <TableCell>
                      {schedule.fecha_almuerzo 
                        ? new Date(schedule.fecha_almuerzo).toLocaleTimeString() 
                        : '-'}
                    </TableCell>
                    <TableCell>
                      {schedule.fecha_regreso 
                        ? new Date(schedule.fecha_regreso).toLocaleTimeString() 
                        : '-'}
                    </TableCell>
                    <TableCell>
                      {schedule.fecha_salida 
                        ? new Date(schedule.fecha_salida).toLocaleTimeString() 
                        : '-'}
                    </TableCell>
                    <TableCell>
                      {calculateWorkingHours(schedule).toFixed(1)}h
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusColor(schedule.estado)}>
                        {schedule.estado}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {reportType === "exits" && exits.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Salidas Espontáneas</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Punto</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Fecha Salida</TableHead>
                  <TableHead>Fecha Regreso</TableHead>
                  <TableHead>Duración</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {exits.map((exit) => (
                  <TableRow key={exit.id}>
                    <TableCell>{exit.usuario?.nombre || 'N/A'}</TableCell>
                    <TableCell>{exit.puntoAtencion?.nombre || 'N/A'}</TableCell>
                    <TableCell>
                      <Badge variant={getMotivoColor(exit.motivo)}>
                        {exit.motivo.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(exit.fecha_salida).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      {exit.fecha_regreso 
                        ? new Date(exit.fecha_regreso).toLocaleString() 
                        : 'En curso'}
                    </TableCell>
                    <TableCell>
                      {exit.duracion_minutos 
                        ? `${exit.duracion_minutos} min` 
                        : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getStatusColor(exit.estado)}>
                        {exit.estado}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
