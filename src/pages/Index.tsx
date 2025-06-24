
import { useEffect, useState } from "react";
import { useAuth } from '../hooks/useAuth';
import Dashboard from '../components/dashboard/Dashboard';
import PointSelection from '../components/auth/PointSelection';
import { PuntoAtencion, User } from '../types';
import { pointService } from '../services/pointService';
import { useToast } from "@/hooks/use-toast";

const SELECTED_POINT_KEY = 'selectedPoint';

const Index = () => {
  const { user, logout } = useAuth();
  const [selectedPoint, setSelectedPoint] = useState<PuntoAtencion | null>(null);
  const [showPointSelection, setShowPointSelection] = useState(false);
  const [availablePoints, setAvailablePoints] = useState<PuntoAtencion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  // Cargar punto guardado del localStorage al iniciar
  useEffect(() => {
    const savedPoint = localStorage.getItem(SELECTED_POINT_KEY);
    if (savedPoint) {
      try {
        const point = JSON.parse(savedPoint);
        console.warn('Punto recuperado del localStorage:', point);
        setSelectedPoint(point);
      } catch (error) {
        console.error('Error al recuperar punto guardado:', error);
        localStorage.removeItem(SELECTED_POINT_KEY);
      }
    }
  }, []);

  useEffect(() => {
    const loadPoints = async () => {
      if (!user) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        
        // Si es administrador, no necesita seleccionar punto
        if (user.rol === 'ADMIN' || user.rol === 'SUPER_USUARIO') {
          setSelectedPoint(null);
          setIsLoading(false);
          toast({
            title: "Acceso administrativo",
            description: `Bienvenido ${user.nombre}`,
          });
          return;
        }

        // Si ya hay un punto seleccionado (guardado en localStorage), usarlo
        if (selectedPoint) {
          console.warn('Usando punto previamente seleccionado:', selectedPoint);
          setIsLoading(false);
          toast({
            title: "Sesión continuada",
            description: `Continuando en ${selectedPoint.nombre}`,
          });
          return;
        }

        // Para operadores, cargar puntos disponibles
        const { points, error } = await pointService.getAllPoints();
        
        if (error) {
          toast({
            title: "Error",
            description: "Error al cargar puntos de atención",
            variant: "destructive"
          });
          return;
        }

        // Si el usuario tiene un punto asignado, verificar si está disponible
        if (user.punto_atencion_id) {
          const userPoint = points.find(p => p.id === user.punto_atencion_id);
          if (userPoint) {
            setSelectedPoint(userPoint);
            // Guardar en localStorage
            localStorage.setItem(SELECTED_POINT_KEY, JSON.stringify(userPoint));
            toast({
              title: "Punto asignado",
              description: `Conectado a ${userPoint.nombre}`,
            });
            setIsLoading(false);
            return;
          }
        }

        // Para operadores sin punto asignado, mostrar puntos disponibles
        setAvailablePoints(points);

        if (points.length === 0) {
          toast({
            title: "Sin puntos disponibles",
            description: "No hay puntos de atención libres en este momento",
            variant: "destructive"
          });
        } else {
          setShowPointSelection(true);
          toast({
            title: "Seleccione un punto",
            description: "Seleccione su punto de atención para continuar",
          });
        }
      } catch (error) {
        console.error('Error loading points:', error);
        toast({
          title: "Error de conexión",
          description: "Error al conectar con el servidor",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadPoints();
  }, [user, toast, selectedPoint]);

  const handlePointSelect = (point: PuntoAtencion) => {
    try {
      setSelectedPoint(point);
      setShowPointSelection(false);
      // Guardar en localStorage para persistir entre recargas
      localStorage.setItem(SELECTED_POINT_KEY, JSON.stringify(point));
      toast({
        title: "Jornada iniciada",
        description: `Jornada iniciada en ${point.nombre}`,
      });
    } catch (error) {
      console.error('Error selecting point:', error);
      toast({
        title: "Error",
        description: "Error al seleccionar el punto",
        variant: "destructive"
      });
    }
  };

  const handleLogout = () => {
    try {
      // IMPORTANTE: NO limpiar el punto seleccionado al cerrar sesión
      // El punto debe persistir hasta el cierre de caja
      logout();
      toast({
        title: "Sesión cerrada",
        description: "Ha cerrado sesión exitosamente",
      });
    } catch (error) {
      console.error('Error during logout:', error);
      toast({
        title: "Error",
        description: "Error al cerrar sesión",
        variant: "destructive"
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando aplicación...</p>
        </div>
      </div>
    );
  }

  if (showPointSelection) {
    return (
      <PointSelection
        points={availablePoints}
        onPointSelect={handlePointSelect}
        onLogout={handleLogout}
        user={user || { 
          id: '', 
          nombre: '', 
          correo: '', 
          rol: 'OPERADOR', 
          activo: true, 
          created_at: '', 
          updated_at: '',
          username: ''
        } as User}
      />
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Redirigiendo al login...</p>
        </div>
      </div>
    );
  }

  return (
    <Dashboard
      user={user}
      selectedPoint={selectedPoint}
      onLogout={handleLogout}
    />
  );
};

export default Index;
