
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, RefreshCw, AlertCircle, Database } from 'lucide-react';
import { User, PuntoAtencion } from '../../types';
import { scheduleService, Schedule } from '../../services/scheduleService';
import { toast } from "@/hooks/use-toast";

interface TimeReportsProps {
  user: User;
  selectedPoint: PuntoAtencion | null;
}

const TimeReports = ({ user, selectedPoint }: TimeReportsProps) => {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSchedules = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { schedules: fetchedSchedules, error: fetchError } = await scheduleService.getAllSchedules();
      
      if (fetchError) {
        setError(fetchError);
        toast({
          title: "Error al cargar horarios",
          description: fetchError,
          variant: "destructive",
        });
      } else {
        setSchedules(fetchedSchedules);
        if (fetchedSchedules.length === 0) {
          toast({
            title: "Sin datos",
            description: "No se encontraron registros de horarios",
          });
        }
      }
    } catch (err) {
      const errorMessage = "Error inesperado al cargar los horarios";
      setError(errorMessage);
      console.error("Error fetching schedules:", err);
      toast({
        title: "Error de conexión",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedules();
  }, []);

  const formatTime = (dateString: string | null) => {
    if (!dateString) return '-';
    try {
      return new Date(dateString).toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'Hora inválida';
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return 'Fecha inválida';
    }
  };

  const calculateDuration = (start: string, end: string | null) => {
    if (!end) return '-';
    try {
      const startTime = new Date(start);
      const endTime = new Date(end);
      const diff = endTime.getTime() - startTime.getTime();
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      return `${hours}h ${minutes}m`;
    } catch {
      return 'Error';
    }
  };

  const getShiftStatus = (schedule: Schedule) => {
    if (schedule.fecha_salida) return { label: 'Completada', color: 'bg-green-100 text-green-800' };
    if (schedule.fecha_regreso) return { label: 'Post-almuerzo', color: 'bg-blue-100 text-blue-800' };
    if (schedule.fecha_almuerzo) return { label: 'En almuerzo', color: 'bg-yellow-100 text-yellow-800' };
    return { label: 'En progreso', color: 'bg-orange-100 text-orange-800' };
  };

  const filteredSchedules = schedules.filter(schedule => {
    if (user.rol === 'OPERADOR') {
      return schedule.usuario_id === user.id;
    }
    if (selectedPoint && user.rol === 'ADMIN') {
      return schedule.punto_atencion_id === selectedPoint.id;
    }
    return true;
  });

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mr-3" />
            <span className="text-lg text-gray-600">Cargando horarios...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center py-8">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-red-500" />
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Error de Conexión</h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={fetchSchedules} className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Reintentar
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (filteredSchedules.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Reportes de Horarios
          </CardTitle>
          <CardDescription>
            Historial de jornadas laborales registradas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Database className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <h3 className="text-lg font-semibold text-gray-800 mb-2">No hay datos disponibles</h3>
            <p className="text-gray-600 mb-4">
              No se encontraron registros de horarios para mostrar
            </p>
            <Button onClick={fetchSchedules} variant="outline" className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              Actualizar
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Reportes de Horarios
            </CardTitle>
            <CardDescription>
              Historial de jornadas laborales ({filteredSchedules.length} registros)
            </CardDescription>
          </div>
          <Button onClick={fetchSchedules} variant="outline" size="sm" className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4" />
            Actualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Usuario</TableHead>
                <TableHead>Punto de Atención</TableHead>
                <TableHead>Inicio</TableHead>
                <TableHead>Almuerzo</TableHead>
                <TableHead>Regreso</TableHead>
                <TableHead>Salida</TableHead>
                <TableHead>Duración</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSchedules.map((schedule) => {
                const status = getShiftStatus(schedule);
                return (
                  <TableRow key={schedule.id}>
                    <TableCell className="font-medium">
                      {formatDate(schedule.fecha_inicio)}
                    </TableCell>
                    <TableCell>
                      {schedule.usuario?.nombre || 'Usuario desconocido'}
                    </TableCell>
                    <TableCell>
                      {schedule.puntoAtencion?.nombre || 'Punto desconocido'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-gray-500" />
                        {formatTime(schedule.fecha_inicio)}
                      </div>
                    </TableCell>
                    <TableCell>{formatTime(schedule.fecha_almuerzo)}</TableCell>
                    <TableCell>{formatTime(schedule.fecha_regreso)}</TableCell>
                    <TableCell>{formatTime(schedule.fecha_salida)}</TableCell>
                    <TableCell>
                      {calculateDuration(schedule.fecha_inicio, schedule.fecha_salida)}
                    </TableCell>
                    <TableCell>
                      <Badge className={status.color}>
                        {status.label}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};

export default TimeReports;
