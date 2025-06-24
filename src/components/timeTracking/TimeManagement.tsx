
import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Play, Square, Plus, List } from "lucide-react";
import { User, PuntoAtencion } from '../../types';
import { useToast } from "@/hooks/use-toast";
import AutoTimeTracker from './AutoTimeTracker';
import SpontaneousExitForm from './SpontaneousExitForm';
import SpontaneousExitHistory from './SpontaneousExitHistory';

interface TimeManagementProps {
  user: User;
  selectedPoint: PuntoAtencion | null;
}

const TimeManagement = ({ user, selectedPoint }: TimeManagementProps) => {
  const [isTracking, setIsTracking] = useState(false);
  const [showExitForm, setShowExitForm] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [currentSessionTime, setCurrentSessionTime] = useState(0);
  const { toast } = useToast();

  useEffect(() => {
    // Check if there's an active session
    const savedSession = localStorage.getItem('timeTrackingSession');
    if (savedSession) {
      try {
        const session = JSON.parse(savedSession);
        if (session.userId === user.id && session.pointId === selectedPoint?.id) {
          setIsTracking(true);
          console.warn('Resuming active time tracking session');
        }
      } catch (error) {
        console.error('Error parsing saved session:', error);
        localStorage.removeItem('timeTrackingSession');
      }
    }
  }, [user.id, selectedPoint?.id]);

  const startTracking = () => {
    if (!selectedPoint) {
      toast({
        title: "Error",
        description: "Debe seleccionar un punto de atención para iniciar el tracking",
        variant: "destructive"
      });
      return;
    }

    const session = {
      userId: user.id,
      pointId: selectedPoint.id,
      startTime: new Date().toISOString()
    };

    localStorage.setItem('timeTrackingSession', JSON.stringify(session));
    setIsTracking(true);

    toast({
      title: "Tracking iniciado",
      description: "Se ha iniciado el seguimiento de tiempo",
    });
  };

  const stopTracking = () => {
    localStorage.removeItem('timeTrackingSession');
    setIsTracking(false);
    setCurrentSessionTime(0);

    toast({
      title: "Tracking detenido",
      description: "Se ha detenido el seguimiento de tiempo",
    });
  };

  const handleExitRegistered = () => {
    setShowExitForm(false);
    toast({
      title: "Salida registrada",
      description: "La salida espontánea ha sido registrada exitosamente",
    });
  };

  const handleTimeUpdate = (totalMinutes: number) => {
    setCurrentSessionTime(totalMinutes);
  };

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Gestión de Tiempo</h1>
        <Badge variant={isTracking ? "default" : "secondary"}>
          {isTracking ? "Activo" : "Inactivo"}
        </Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Control Panel */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Control de Tiempo
            </CardTitle>
            <CardDescription>
              Inicie o detenga el seguimiento de su tiempo de trabajo
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isTracking ? (
              <Button onClick={startTracking} className="w-full">
                <Play className="mr-2 h-4 w-4" />
                Iniciar Tracking
              </Button>
            ) : (
              <div className="space-y-4">
                <AutoTimeTracker 
                  user={user} 
                  selectedPoint={selectedPoint}
                  onTimeUpdate={handleTimeUpdate}
                />
                <div className="flex gap-2">
                  <Button onClick={stopTracking} variant="destructive" className="flex-1">
                    <Square className="mr-2 h-4 w-4" />
                    Detener
                  </Button>
                  <Button 
                    onClick={() => setShowExitForm(true)} 
                    variant="outline"
                    disabled={showExitForm}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Salida
                  </Button>
                </div>
              </div>
            )}

            <Button 
              onClick={() => setShowHistory(!showHistory)} 
              variant="outline" 
              className="w-full"
            >
              <List className="mr-2 h-4 w-4" />
              {showHistory ? 'Ocultar' : 'Ver'} Historial
            </Button>
          </CardContent>
        </Card>

        {/* Session Info */}
        <Card>
          <CardHeader>
            <CardTitle>Información de Sesión</CardTitle>
            <CardDescription>
              Detalles de la sesión actual de trabajo
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm font-medium">Usuario:</span>
                <span className="text-sm">{user.nombre}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium">Punto:</span>
                <span className="text-sm">{selectedPoint?.nombre || 'No seleccionado'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium">Estado:</span>
                <Badge variant={isTracking ? "default" : "secondary"}>
                  {isTracking ? "Trabajando" : "Inactivo"}
                </Badge>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium">Tiempo actual:</span>
                <span className="text-sm font-mono">{formatTime(currentSessionTime)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Spontaneous Exit Form */}
      {showExitForm && (
        <SpontaneousExitForm
          user={user}
          selectedPoint={selectedPoint}
          onExitRegistered={handleExitRegistered}
          onCancel={() => setShowExitForm(false)}
        />
      )}

      {/* History */}
      {showHistory && (
        <SpontaneousExitHistory
          _user={user}
          selectedPoint={selectedPoint}
        />
      )}
    </div>
  );
};

export default TimeManagement;
