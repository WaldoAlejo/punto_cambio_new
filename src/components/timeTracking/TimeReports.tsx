import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { apiService } from '../../services/apiService';
import { spontaneousExitService, SpontaneousExit } from '../../services/spontaneousExitService';
import { Usuario, PuntoAtencion, Jornada, SalidaEspontanea, Schedule } from '../../types';

interface TimeReportsProps {
  user: Usuario;
  selectedPoint: PuntoAtencion | null;
}

const TimeReports = ({ user, selectedPoint }: TimeReportsProps) => {
  const [reportType, setReportType] = useState<'schedules' | 'exits'>('schedules');
  const [dateFrom, setDateFrom] = useState(new Date().toISOString().split('T')[0]);
  const [dateTo, setDateTo] = useState(new Date().toISOString().split('T')[0]);
  const [schedules, setSchedules] = useState<Jornada[]>([]);
  const [exits, setExits] = useState<SalidaEspontanea[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const loadScheduleReports = async () => {
    setIsLoading(true);
    try {
      const endpoint = selectedPoint 
        ? `/schedules/reports?point_id=${selectedPoint.id}&date_from=${dateFrom}&date_to=${dateTo}`
        : `/schedules/reports?date_from=${dateFrom}&date_to=${dateTo}`;
      
      const response = await apiService.get<{ schedules: Jornada[]; success: boolean; error?: string }>(endpoint);
      
      if (response.success && response.schedules) {
        setSchedules(response.schedules);
      } else {
        toast({
          title: "Error",
          description: response.error || "Error al cargar reportes de horarios",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error loading schedule reports:', error);
      toast({
        title: "Error",
        description: "Error al cargar reportes de horarios",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadExitReports = async () => {
    setIsLoading(true);
    try {
      const { exits: fetchedExits, error } = await spontaneousExitService.getAllExits(
        selectedPoint?.id || undefined
      );
      
      if (error) {
        toast({
          title: "Error",
          description: error,
          variant: "destructive"
        });
        return;
      }

      // Convert SpontaneousExit to SalidaEspontanea format
      const convertedExits: SalidaEspontanea[] = fetchedExits.map((exit: SpontaneousExit) => ({
        id: exit.id,
        usuario_id: exit.usuario_id,
        punto_atencion_id: exit.punto_atencion_id,
        motivo: exit.motivo,
        descripcion: exit.descripcion || null,
        fecha_salida: exit.fecha_salida,
        fecha_regreso: exit.fecha_regreso || null,
        ubicacion_salida: exit.ubicacion_salida || null,
        ubicacion_regreso: exit.ubicacion_regreso || null,
        duracion_minutos: exit.duracion_minutos || null,
        aprobado_por: exit.aprobado_por || null,
        estado: exit.estado,
        created_at: exit.created_at,
        updated_at: exit.updated_at,
        usuario: exit.usuario ? {
          id: exit.usuario.id,
          username: exit.usuario.username,
          nombre: exit.usuario.nombre,
          correo: null,
          telefono: null,
          rol: 'OPERADOR' as const,
          activo: true,
          punto_atencion_id: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        } : undefined,
        puntoAtencion: exit.puntoAtencion,
        usuarioAprobador: exit.usuarioAprobador ? {
          id: exit.usuarioAprobador.id,
          username: exit.usuarioAprobador.username,
          nombre: exit.usuarioAprobador.nombre,
          correo: null,
          telefono: null,
          rol: 'ADMIN' as const,
          activo: true,
          punto_atencion_id: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        } : undefined
      }));

      setExits(convertedExits);
    } catch (error) {
      console.error('Error loading exit reports:', error);
      toast({
        title: "Error",
        description: "Error al cargar reportes de salidas",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const generateReport = () => {
    if (reportType === 'schedules') {
      loadScheduleReports();
    } else {
      loadExitReports();
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Reportes de Tiempo</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Generar Reporte de Tiempo</CardTitle>
          <CardDescription>Configure los filtros para generar el reporte de horarios o salidas</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="space-y-2">
              <Label>Tipo de Reporte</Label>
              <Select value={reportType} onValueChange={(value: 'schedules' | 'exits') => setReportType(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="schedules">Horarios</SelectItem>
                  <SelectItem value="exits">Salidas Espontáneas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Fecha Desde</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Fecha Hasta</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={generateReport} disabled={isLoading} className="w-full">
                {isLoading ? 'Generando...' : 'Generar Reporte'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {reportType === 'schedules' && schedules.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Reporte de Horarios</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Punto</TableHead>
                  <TableHead>Fecha Inicio</TableHead>
                  <TableHead>Fecha Salida</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedules.map((schedule) => (
                  <TableRow key={schedule.id}>
                    <TableCell>{schedule.usuario?.nombre || 'N/A'}</TableCell>
                    <TableCell>{schedule.puntoAtencion?.nombre || 'N/A'}</TableCell>
                    <TableCell>{new Date(schedule.fecha_inicio).toLocaleString()}</TableCell>
                    <TableCell>{schedule.fecha_salida ? new Date(schedule.fecha_salida).toLocaleString() : 'N/A'}</TableCell>
                    <TableCell>{schedule.estado}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {reportType === 'exits' && exits.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Reporte de Salidas Espontáneas</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuario</TableHead>
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
                    <TableCell>{exit.motivo}</TableCell>
                    <TableCell>{new Date(exit.fecha_salida).toLocaleString()}</TableCell>
                    <TableCell>{exit.fecha_regreso ? new Date(exit.fecha_regreso).toLocaleString() : 'N/A'}</TableCell>
                    <TableCell>{exit.duracion_minutos ? `${exit.duracion_minutos} min` : 'N/A'}</TableCell>
                    <TableCell>{exit.estado}</TableCell>
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

export default TimeReports;
