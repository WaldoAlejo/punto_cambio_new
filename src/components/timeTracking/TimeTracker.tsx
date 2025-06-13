
import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, LogIn, LogOut, UtensilsCrossed, ArrowRight } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { User, PuntoAtencion } from '../../types';

interface TimeTrackerProps {
  user: User;
  selectedPoint: PuntoAtencion | null;
}

interface JornadaEstado {
  id?: string;
  fecha_inicio?: string;
  fecha_almuerzo?: string;
  fecha_regreso?: string;
  fecha_salida?: string;
  estado: 'NO_INICIADO' | 'TRABAJANDO' | 'ALMUERZO' | 'FINALIZADO';
}

const TimeTracker = ({ user, selectedPoint }: TimeTrackerProps) => {
  const [jornadaActual, setJornadaActual] = useState<JornadaEstado>({ estado: 'NO_INICIADO' });
  const [tiempoActual, setTiempoActual] = useState(new Date());

  // Actualizar tiempo cada segundo
  useEffect(() => {
    const interval = setInterval(() => {
      setTiempoActual(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Cargar jornada actual al montar el componente
  useEffect(() => {
    cargarJornadaActual();
  }, [user.id, selectedPoint?.id]);

  const cargarJornadaActual = () => {
    // Mock: En producción esto vendría de la base de datos
    const jornadaGuardada = localStorage.getItem(`jornada_${user.id}_${selectedPoint?.id}`);
    if (jornadaGuardada) {
      const jornada = JSON.parse(jornadaGuardada);
      setJornadaActual(jornada);
    }
  };

  const guardarJornada = (nuevaJornada: JornadaEstado) => {
    localStorage.setItem(`jornada_${user.id}_${selectedPoint?.id}`, JSON.stringify(nuevaJornada));
    setJornadaActual(nuevaJornada);
  };

  const iniciarJornada = () => {
    const ahora = new Date().toISOString();
    const nuevaJornada: JornadaEstado = {
      id: `jornada_${Date.now()}`,
      fecha_inicio: ahora,
      estado: 'TRABAJANDO'
    };
    
    guardarJornada(nuevaJornada);
    toast({
      title: "Jornada iniciada",
      description: `Inicio de jornada registrado a las ${formatearHora(ahora)}`,
    });
  };

  const irAlmuerzo = () => {
    if (jornadaActual.estado !== 'TRABAJANDO') return;
    
    const ahora = new Date().toISOString();
    const nuevaJornada: JornadaEstado = {
      ...jornadaActual,
      fecha_almuerzo: ahora,
      estado: 'ALMUERZO'
    };
    
    guardarJornada(nuevaJornada);
    toast({
      title: "Salida a almuerzo",
      description: `Salida registrada a las ${formatearHora(ahora)}`,
    });
  };

  const regresarAlmuerzo = () => {
    if (jornadaActual.estado !== 'ALMUERZO') return;
    
    const ahora = new Date().toISOString();
    const nuevaJornada: JornadaEstado = {
      ...jornadaActual,
      fecha_regreso: ahora,
      estado: 'TRABAJANDO'
    };
    
    guardarJornada(nuevaJornada);
    toast({
      title: "Regreso de almuerzo",
      description: `Regreso registrado a las ${formatearHora(ahora)}`,
    });
  };

  const finalizarJornada = () => {
    if (jornadaActual.estado !== 'TRABAJANDO') return;
    
    const ahora = new Date().toISOString();
    const nuevaJornada: JornadaEstado = {
      ...jornadaActual,
      fecha_salida: ahora,
      estado: 'FINALIZADO'
    };
    
    guardarJornada(nuevaJornada);
    toast({
      title: "Jornada finalizada",
      description: `Salida registrada a las ${formatearHora(ahora)}`,
    });
  };

  const formatearHora = (fecha: string) => {
    return new Date(fecha).toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const calcularTiempoTrabajado = () => {
    if (!jornadaActual.fecha_inicio) return "0h 0m";
    
    const inicio = new Date(jornadaActual.fecha_inicio);
    const fin = jornadaActual.fecha_salida ? new Date(jornadaActual.fecha_salida) : new Date();
    
    let tiempoTotal = fin.getTime() - inicio.getTime();
    
    // Restar tiempo de almuerzo si aplica
    if (jornadaActual.fecha_almuerzo && jornadaActual.fecha_regreso) {
      const almuerzo = new Date(jornadaActual.fecha_almuerzo);
      const regreso = new Date(jornadaActual.fecha_regreso);
      tiempoTotal -= (regreso.getTime() - almuerzo.getTime());
    } else if (jornadaActual.fecha_almuerzo && jornadaActual.estado === 'ALMUERZO') {
      const almuerzo = new Date(jornadaActual.fecha_almuerzo);
      tiempoTotal -= (new Date().getTime() - almuerzo.getTime());
    }
    
    const horas = Math.floor(tiempoTotal / (1000 * 60 * 60));
    const minutos = Math.floor((tiempoTotal % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${horas}h ${minutos}m`;
  };

  const getEstadoBadge = () => {
    switch (jornadaActual.estado) {
      case 'NO_INICIADO':
        return <Badge variant="secondary">No iniciado</Badge>;
      case 'TRABAJANDO':
        return <Badge variant="default" className="bg-green-500">Trabajando</Badge>;
      case 'ALMUERZO':
        return <Badge variant="destructive">En almuerzo</Badge>;
      case 'FINALIZADO':
        return <Badge variant="outline">Finalizado</Badge>;
    }
  };

  if (!selectedPoint) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-gray-500">
              Selecciona un punto de atención para registrar tu jornada
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Control de Horarios</h1>
          <p className="text-gray-600">{selectedPoint.nombre}</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-mono">{tiempoActual.toLocaleTimeString('es-ES')}</div>
          <div className="text-sm text-gray-500">{tiempoActual.toLocaleDateString('es-ES')}</div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Estado actual */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Estado Actual
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span>Estado:</span>
              {getEstadoBadge()}
            </div>
            <div className="flex items-center justify-between">
              <span>Tiempo trabajado:</span>
              <span className="font-mono font-bold">{calcularTiempoTrabajado()}</span>
            </div>
          </CardContent>
        </Card>

        {/* Acciones */}
        <Card>
          <CardHeader>
            <CardTitle>Acciones</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              onClick={iniciarJornada}
              disabled={jornadaActual.estado !== 'NO_INICIADO'}
              className="w-full"
              variant={jornadaActual.estado === 'NO_INICIADO' ? 'default' : 'secondary'}
            >
              <LogIn className="mr-2 h-4 w-4" />
              Iniciar Jornada
            </Button>

            <Button
              onClick={irAlmuerzo}
              disabled={jornadaActual.estado !== 'TRABAJANDO'}
              variant="outline"
              className="w-full"
            >
              <UtensilsCrossed className="mr-2 h-4 w-4" />
              Ir a Almuerzo
            </Button>

            <Button
              onClick={regresarAlmuerzo}
              disabled={jornadaActual.estado !== 'ALMUERZO'}
              variant="outline"
              className="w-full"
            >
              <ArrowRight className="mr-2 h-4 w-4" />
              Regresar de Almuerzo
            </Button>

            <Button
              onClick={finalizarJornada}
              disabled={jornadaActual.estado !== 'TRABAJANDO'}
              variant="destructive"
              className="w-full"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Finalizar Jornada
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Resumen del día */}
      {jornadaActual.fecha_inicio && (
        <Card>
          <CardHeader>
            <CardTitle>Resumen del Día</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-gray-500">Inicio</div>
                <div className="font-mono">
                  {jornadaActual.fecha_inicio ? formatearHora(jornadaActual.fecha_inicio) : '--:--'}
                </div>
              </div>
              <div>
                <div className="text-gray-500">Almuerzo</div>
                <div className="font-mono">
                  {jornadaActual.fecha_almuerzo ? formatearHora(jornadaActual.fecha_almuerzo) : '--:--'}
                </div>
              </div>
              <div>
                <div className="text-gray-500">Regreso</div>
                <div className="font-mono">
                  {jornadaActual.fecha_regreso ? formatearHora(jornadaActual.fecha_regreso) : '--:--'}
                </div>
              </div>
              <div>
                <div className="text-gray-500">Salida</div>
                <div className="font-mono">
                  {jornadaActual.fecha_salida ? formatearHora(jornadaActual.fecha_salida) : '--:--'}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default TimeTracker;
