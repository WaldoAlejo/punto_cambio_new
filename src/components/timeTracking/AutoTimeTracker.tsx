
import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Coffee, LogOut as LogOutIcon, MapPin, AlertCircle } from 'lucide-react';
import { User, PuntoAtencion, Jornada } from '../../types';
import { toast } from "@/hooks/use-toast";
import { apiService } from '../../services/apiService';

interface AutoTimeTrackerProps {
  user: User;
  selectedPoint: PuntoAtencion | null;
}

interface JornadaRequest {
  usuario_id: string;
  punto_atencion_id: string;
  fecha_inicio?: string;
  fecha_almuerzo?: string;
  fecha_regreso?: string;
  fecha_salida?: string;
}

const AutoTimeTracker = ({ user, selectedPoint }: AutoTimeTrackerProps) => {
  const [currentSession, setCurrentSession] = useState<Jornada | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    // Obtener ubicación al cargar
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.log('Error obteniendo ubicación:', error);
        }
      );
    }

    // Cargar jornada activa si existe
    loadActiveSession();
  }, [user, selectedPoint]);

  const loadActiveSession = async () => {
    // En una implementación real, aquí cargarías la jornada activa desde el servidor
    // Por ahora, mantenemos el estado local
  };

  const saveJornada = async (jornadaData: JornadaRequest) => {
    try {
      setLoading(true);
      const response = await apiService.post('/schedules', jornadaData);
      
      if (!response) {
        throw new Error('No se recibió respuesta del servidor');
      }

      return response;
    } catch (error) {
      console.error('Error guardando jornada:', error);
      toast({
        title: "Error",
        description: "No se pudo guardar la jornada. Continuando en modo local.",
        variant: "destructive",
      });
      return null;
    } finally {
      setLoading(false);
    }
  };

  const handleStartShift = async () => {
    if (!selectedPoint) {
      toast({
        title: "Error",
        description: "Debe seleccionar un punto de atención",
        variant: "destructive",
      });
      return;
    }

    const newSession: Jornada = {
      id: Date.now().toString(),
      usuario_id: user.id,
      punto_atencion_id: selectedPoint.id,
      fecha_inicio: new Date().toISOString(),
    };

    setCurrentSession(newSession);

    // Intentar guardar en el servidor
    await saveJornada({
      usuario_id: user.id,
      punto_atencion_id: selectedPoint.id,
      fecha_inicio: newSession.fecha_inicio
    });
    
    toast({
      title: "Jornada iniciada",
      description: `Bienvenido ${user.nombre}. Tu jornada ha comenzado.`,
    });
  };

  const handleLunchBreak = async () => {
    if (!currentSession) return;

    const updatedSession = {
      ...currentSession,
      fecha_almuerzo: new Date().toISOString()
    };

    setCurrentSession(updatedSession);

    // Intentar actualizar en el servidor
    await saveJornada({
      usuario_id: currentSession.usuario_id,
      punto_atencion_id: currentSession.punto_atencion_id,
      fecha_almuerzo: updatedSession.fecha_almuerzo
    });
    
    toast({
      title: "Hora de almuerzo",
      description: "Disfruta tu descanso. Recuerda marcar tu regreso.",
    });
  };

  const handleLunchReturn = async () => {
    if (!currentSession) return;

    const updatedSession = {
      ...currentSession,
      fecha_regreso: new Date().toISOString()
    };

    setCurrentSession(updatedSession);

    // Intentar actualizar en el servidor
    await saveJornada({
      usuario_id: currentSession.usuario_id,
      punto_atencion_id: currentSession.punto_atencion_id,
      fecha_regreso: updatedSession.fecha_regreso
    });
    
    toast({
      title: "Regreso de almuerzo",
      description: "Bienvenido de vuelta. Continuemos con la jornada.",
    });
  };

  const handleEndShift = async () => {
    if (!currentSession) return;

    const updatedSession = {
      ...currentSession,
      fecha_salida: new Date().toISOString()
    };

    setCurrentSession(updatedSession);

    // Intentar actualizar en el servidor
    await saveJornada({
      usuario_id: currentSession.usuario_id,
      punto_atencion_id: currentSession.punto_atencion_id,
      fecha_salida: updatedSession.fecha_salida
    });
    
    toast({
      title: "Jornada finalizada",
      description: "¡Excelente trabajo hoy! Que tengas un buen día.",
    });

    // Resetear después de 2 segundos
    setTimeout(() => setCurrentSession(null), 2000);
  };

  const getShiftDuration = () => {
    if (!currentSession?.fecha_inicio) return '00:00:00';
    
    const start = new Date(currentSession.fecha_inicio);
    const now = currentTime;
    const diff = now.getTime() - start.getTime();
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const getShiftStatus = () => {
    if (!currentSession) return 'Sin iniciar';
    if (currentSession.fecha_salida) return 'Finalizada';
    if (currentSession.fecha_almuerzo && !currentSession.fecha_regreso) return 'En almuerzo';
    if (currentSession.fecha_regreso) return 'Activa (post-almuerzo)';
    return 'Activa';
  };

  const getStatusColor = () => {
    const status = getShiftStatus();
    switch (status) {
      case 'Activa': case 'Activa (post-almuerzo)': return 'bg-green-100 text-green-800';
      case 'En almuerzo': return 'bg-yellow-100 text-yellow-800';
      case 'Finalizada': return 'bg-gray-100 text-gray-800';
      default: return 'bg-blue-100 text-blue-800';
    }
  };

  if (user.rol !== 'OPERADOR') {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center py-8 text-gray-500">
            <Clock className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p>El control automático de horarios es solo para operadores</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!selectedPoint) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center py-8 text-gray-500">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-yellow-500" />
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Punto de Atención Requerido</h3>
            <p>Debe seleccionar un punto de atención para iniciar su jornada</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Control Automático de Jornada
          </CardTitle>
          <CardDescription>
            Punto seleccionado: {selectedPoint.nombre}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Estado:</span>
                <Badge className={getStatusColor()}>
                  {getShiftStatus()}
                </Badge>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Tiempo trabajado:</span>
                <span className="font-mono text-lg font-semibold text-blue-600">
                  {getShiftDuration()}
                </span>
              </div>

              {location && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <MapPin className="h-4 w-4" />
                  <span>Ubicación registrada</span>
                </div>
              )}
            </div>

            <div className="space-y-3">
              {!currentSession && (
                <Button 
                  onClick={handleStartShift} 
                  className="w-full"
                  disabled={loading}
                >
                  <Clock className="h-4 w-4 mr-2" />
                  {loading ? 'Iniciando...' : 'Iniciar Jornada'}
                </Button>
              )}

              {currentSession && !currentSession.fecha_almuerzo && (
                <Button 
                  onClick={handleLunchBreak} 
                  variant="outline" 
                  className="w-full"
                  disabled={loading}
                >
                  <Coffee className="h-4 w-4 mr-2" />
                  {loading ? 'Registrando...' : 'Ir a Almorzar'}
                </Button>
              )}

              {currentSession?.fecha_almuerzo && !currentSession.fecha_regreso && (
                <Button 
                  onClick={handleLunchReturn} 
                  className="w-full"
                  disabled={loading}
                >
                  <Clock className="h-4 w-4 mr-2" />
                  {loading ? 'Registrando...' : 'Regresar de Almuerzo'}
                </Button>
              )}

              {currentSession && currentSession.fecha_regreso && !currentSession.fecha_salida && (
                <Button 
                  onClick={handleEndShift} 
                  variant="destructive" 
                  className="w-full"
                  disabled={loading}
                >
                  <LogOutIcon className="h-4 w-4 mr-2" />
                  {loading ? 'Finalizando...' : 'Finalizar Jornada'}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {currentSession && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Resumen de Jornada</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Inicio:</span>
                <span className="font-medium">
                  {new Date(currentSession.fecha_inicio).toLocaleTimeString('es-ES')}
                </span>
              </div>
              
              {currentSession.fecha_almuerzo && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Almuerzo:</span>
                  <span className="font-medium">
                    {new Date(currentSession.fecha_almuerzo).toLocaleTimeString('es-ES')}
                  </span>
                </div>
              )}
              
              {currentSession.fecha_regreso && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Regreso:</span>
                  <span className="font-medium">
                    {new Date(currentSession.fecha_regreso).toLocaleTimeString('es-ES')}
                  </span>
                </div>
              )}
              
              {currentSession.fecha_salida && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Salida:</span>
                  <span className="font-medium">
                    {new Date(currentSession.fecha_salida).toLocaleTimeString('es-ES')}
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AutoTimeTracker;
