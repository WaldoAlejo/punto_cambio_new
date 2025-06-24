
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MapPin, Clock, User, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiService } from '../../services/apiService';
import { User as UserType } from '../../types';
import { scheduleService } from '../../services/scheduleService';

interface ActiveSchedule {
  id: string;
  fecha_inicio: string;
  fecha_almuerzo?: string;
  fecha_regreso?: string;
  fecha_salida?: string;
  ubicacion_inicio?: {
    lat: number;
    lng: number;
    direccion?: string;
  };
  ubicacion_salida?: {
    lat: number;
    lng: number;
    direccion?: string;
  };
  estado: string;
  usuario: {
    id: string;
    nombre: string;
    username: string;
  };
  puntoAtencion: {
    id: string;
    nombre: string;
  };
}

interface ActivePointsReportProps {
  user: UserType;
}

const ActivePointsReport = ({ user }: ActivePointsReportProps) => {
  const [activeSchedules, setActiveSchedules] = useState<ActiveSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadActiveSchedules();
  }, []);

  const loadActiveSchedules = async () => {
    setLoading(true);
    try {
      console.log('Cargando horarios activos...');
      
      // Obtener horarios activos de hoy
      const today = new Date().toISOString().split('T')[0];
      const { schedules, error } = await scheduleService.getSchedules({ fecha: today });
      
      if (error) {
        console.error('Error al cargar horarios:', error);
        toast({
          title: "Error",
          description: `Error al cargar horarios activos: ${error}`,
          variant: "destructive",
        });
        return;
      }

      // Filtrar solo los horarios activos (que no han terminado)
      const activesOnly = schedules.filter(schedule => 
        schedule.estado === 'ACTIVO' && !schedule.fecha_salida
      );

      console.log('Horarios activos encontrados:', activesOnly);
      setActiveSchedules(activesOnly);

      toast({
        title: "Datos actualizados",
        description: `Se encontraron ${activesOnly.length} usuarios activos`,
      });

    } catch (error) {
      console.error('Error al cargar horarios activos:', error);
      toast({
        title: "Error de conexión",
        description: "No se pudieron cargar los datos de usuarios activos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (dateString?: string) => {
    if (!dateString) return 'No registrado';
    return new Date(dateString).toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const getWorkingHours = (startTime: string, endTime?: string) => {
    const start = new Date(startTime);
    const end = endTime ? new Date(endTime) : new Date();
    const diff = end.getTime() - start.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const getLocationString = (location?: { lat: number; lng: number; direccion?: string }) => {
    if (!location) return 'No disponible';
    if (location.direccion) return location.direccion;
    return `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-2">Cargando usuarios activos...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Usuarios Activos</h2>
          <p className="text-gray-600">
            Monitoreo en tiempo real de jornadas laborales - {formatDate(new Date().toISOString())}
          </p>
        </div>
        <Button onClick={loadActiveSchedules} disabled={loading}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualizar
        </Button>
      </div>

      {activeSchedules.length === 0 ? (
        <Card>
          <CardContent className="flex items-center justify-center h-32">
            <div className="text-center">
              <User className="h-12 w-12 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-500">No hay usuarios trabajando actualmente</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {activeSchedules.map((schedule) => (
            <Card key={schedule.id} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <User className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{schedule.usuario.nombre}</CardTitle>
                      <p className="text-sm text-gray-600">@{schedule.usuario.username}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant="secondary" className="mb-1">
                      {schedule.puntoAtencion.nombre}
                    </Badge>
                    <p className="text-sm text-gray-600">
                      Trabajando: {getWorkingHours(schedule.fecha_inicio)}
                    </p>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent>
                <Tabs defaultValue="schedule" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="schedule">Horarios</TabsTrigger>
                    <TabsTrigger value="location">Ubicaciones</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="schedule" className="space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center text-sm text-gray-600">
                          <Clock className="h-4 w-4 mr-1" />
                          Entrada
                        </div>
                        <p className="font-medium text-green-600">
                          {formatTime(schedule.fecha_inicio)}
                        </p>
                      </div>
                      
                      <div className="space-y-1">
                        <div className="flex items-center text-sm text-gray-600">
                          <Clock className="h-4 w-4 mr-1" />
                          Almuerzo
                        </div>
                        <p className="font-medium text-orange-600">
                          {formatTime(schedule.fecha_almuerzo)}
                        </p>
                      </div>
                      
                      <div className="space-y-1">
                        <div className="flex items-center text-sm text-gray-600">
                          <Clock className="h-4 w-4 mr-1" />
                          Regreso
                        </div>
                        <p className="font-medium text-blue-600">
                          {formatTime(schedule.fecha_regreso)}
                        </p>
                      </div>
                      
                      <div className="space-y-1">
                        <div className="flex items-center text-sm text-gray-600">
                          <Clock className="h-4 w-4 mr-1" />
                          Salida
                        </div>
                        <p className="font-medium text-red-600">
                          {formatTime(schedule.fecha_salida)}
                        </p>
                      </div>
                    </div>
                  </TabsContent>
                  
                  <TabsContent value="location" className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center text-sm text-gray-600">
                          <MapPin className="h-4 w-4 mr-1" />
                          Ubicación de Entrada
                        </div>
                        <p className="text-sm bg-green-50 p-2 rounded border">
                          {getLocationString(schedule.ubicacion_inicio)}
                        </p>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex items-center text-sm text-gray-600">
                          <MapPin className="h-4 w-4 mr-1" />
                          Ubicación de Salida
                        </div>
                        <p className="text-sm bg-red-50 p-2 rounded border">
                          {getLocationString(schedule.ubicacion_salida)}
                        </p>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default ActivePointsReport;
