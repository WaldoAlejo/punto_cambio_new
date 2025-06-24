
import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, MapPin, Monitor, Wifi } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { User, PuntoAtencion, Schedule } from '../../types';
import { scheduleService } from '../../services/scheduleService';
import { deviceService, DeviceInfo } from '../../services/deviceService';

interface TimeManagementProps {
  user: User;
  selectedPoint: PuntoAtencion | null;
}

const TimeManagement = ({ user, selectedPoint }: TimeManagementProps) => {
  const [currentSchedule, setCurrentSchedule] = useState<Schedule | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);

  useEffect(() => {
    loadCurrentSchedule();
    loadDeviceInfo();
  }, []);

  const loadDeviceInfo = async () => {
    try {
      const info = await deviceService.getDeviceInfo();
      setDeviceInfo(info);
    } catch (error) {
      console.error('Error al cargar información del dispositivo:', error);
    }
  };

  const loadCurrentSchedule = async () => {
    try {
      const { schedule, error } = await scheduleService.getActiveSchedule();
      if (error) {
        console.log('No hay jornada activa:', error);
        setCurrentSchedule(null);
      } else {
        setCurrentSchedule(schedule);
      }
    } catch (error) {
      console.error('Error al cargar jornada actual:', error);
    }
  };

  const handleTimeAction = async (action: 'start' | 'lunch' | 'return' | 'end') => {
    if (!selectedPoint) {
      toast({
        title: "Error",
        description: "Debe seleccionar un punto de atención",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      const { location, device } = await deviceService.getLocationWithDevice();
      
      const scheduleData = {
        usuario_id: user.id,
        punto_atencion_id: selectedPoint.id,
        ubicacion: location,
        device_info: device
      };

      const { schedule, error } = await scheduleService.createOrUpdateSchedule(scheduleData);
      
      if (error) {
        toast({
          title: "Error",
          description: error,
          variant: "destructive"
        });
        return;
      }

      setCurrentSchedule(schedule);
      
      const actionMessages = {
        start: 'Jornada iniciada',
        lunch: 'Salida a almuerzo registrada',
        return: 'Regreso de almuerzo registrado', 
        end: 'Jornada finalizada'
      };

      toast({
        title: actionMessages[action],
        description: `Registrado desde: ${device.deviceName}`,
      });

    } catch (error) {
      console.error('Error en acción de horario:', error);
      toast({
        title: "Error",
        description: "Error al registrar horario",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (dateString?: string) => {
    if (!dateString) return 'No registrado';
    return new Date(dateString).toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getWorkingHours = () => {
    if (!currentSchedule?.fecha_inicio) return '0h 0m';
    
    const start = new Date(currentSchedule.fecha_inicio);
    const end = currentSchedule.fecha_salida ? new Date(currentSchedule.fecha_salida) : new Date();
    const diff = end.getTime() - start.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  if (user.rol === 'ADMIN' || user.rol === 'SUPER_USUARIO') {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">La gestión de horarios es solo para operadores</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Gestión de Horarios</h1>
        <div className="text-sm text-gray-500">
          {selectedPoint ? selectedPoint.nombre : 'Sin punto seleccionado'}
        </div>
      </div>

      {/* Información del Dispositivo */}
      {deviceInfo && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Monitor className="h-5 w-5" />
              Información del Equipo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="font-medium text-gray-600">Dispositivo:</p>
                <p>{deviceInfo.deviceName}</p>
              </div>
              <div>
                <p className="font-medium text-gray-600">Identificador:</p>
                <p className="font-mono text-xs">{deviceInfo.macAddress}</p>
              </div>
              <div>
                <p className="font-medium text-gray-600">Plataforma:</p>
                <p>{deviceInfo.platform}</p>
              </div>
              <div>
                <p className="font-medium text-gray-600">Última actualización:</p>
                <p>{new Date(deviceInfo.timestamp).toLocaleTimeString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Estado Actual */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Estado Actual de Jornada
          </CardTitle>
          <CardDescription>
            {currentSchedule ? 'Jornada en curso' : 'Sin jornada activa'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {currentSchedule ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-lg font-medium">Tiempo trabajado:</span>
                <Badge variant="secondary" className="text-lg px-3 py-1">
                  {getWorkingHours()}
                </Badge>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <p className="text-sm text-gray-600">Entrada</p>
                  <p className="font-medium text-green-600">{formatTime(currentSchedule.fecha_inicio)}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-600">Almuerzo</p>
                  <p className="font-medium text-orange-600">{formatTime(currentSchedule.fecha_almuerzo)}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-600">Regreso</p>
                  <p className="font-medium text-blue-600">{formatTime(currentSchedule.fecha_regreso)}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-600">Salida</p>
                  <p className="font-medium text-red-600">{formatTime(currentSchedule.fecha_salida)}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500">No hay jornada activa</p>
              <p className="text-sm text-gray-400 mt-2">Presione "Iniciar Jornada" para comenzar</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Acciones */}
      <Card>
        <CardHeader>
          <CardTitle>Acciones de Horario</CardTitle>
          <CardDescription>Registre sus horarios de entrada, almuerzo y salida</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {!currentSchedule && (
              <Button
                onClick={() => handleTimeAction('start')}
                disabled={isLoading}
                className="bg-green-600 hover:bg-green-700"
              >
                Iniciar Jornada
              </Button>
            )}
            
            {currentSchedule && !currentSchedule.fecha_almuerzo && (
              <Button
                onClick={() => handleTimeAction('lunch')}
                disabled={isLoading}
                className="bg-orange-600 hover:bg-orange-700"
              >
                Salir a Almuerzo
              </Button>
            )}
            
            {currentSchedule && currentSchedule.fecha_almuerzo && !currentSchedule.fecha_regreso && (
              <Button
                onClick={() => handleTimeAction('return')}
                disabled={isLoading}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Regresar de Almuerzo
              </Button>
            )}
            
            {currentSchedule && !currentSchedule.fecha_salida && (
              <Button
                onClick={() => handleTimeAction('end')}
                disabled={isLoading}
                className="bg-red-600 hover:bg-red-700"
              >
                Finalizar Jornada
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TimeManagement;
