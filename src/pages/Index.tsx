
import { useEffect, useState } from "react";
import { useAuth } from '../hooks/useAuth';
import Dashboard from '../components/dashboard/Dashboard';
import PointSelection from '../components/auth/PointSelection';
import { PuntoAtencion } from '../types';
import { pointService } from '../services/pointService';
import { useToast } from "@/hooks/use-toast";

const Index = () => {
  const { user, logout } = useAuth();
  const [selectedPoint, setSelectedPoint] = useState<PuntoAtencion | null>(null);
  const [showPointSelection, setShowPointSelection] = useState(false);
  const [availablePoints, setAvailablePoints] = useState<PuntoAtencion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

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
          setSelectedPoint(null); // Admin no tiene punto específico
          setIsLoading(false);
          toast({
            title: "Acceso administrativo",
            description: `Bienvenido ${user.nombre}`,
          });
          return;
        }

        const { points, error } = await pointService.getAllPoints();
        
        if (error) {
          toast({
            title: "Error",
            description: "Error al cargar puntos de atención",
            variant: "destructive"
          });
          return;
        }

        setAvailablePoints(points);

        // Si el usuario tiene un punto asignado, usarlo por defecto
        if (user.punto_atencion_id) {
          const userPoint = points.find(p => p.id === user.punto_atencion_id);
          if (userPoint) {
            setSelectedPoint(userPoint);
            toast({
              title: "Punto asignado",
              description: `Conectado a ${userPoint.nombre}`,
            });
            setIsLoading(false);
            return;
          }
        }

        // Para operadores sin punto asignado, mostrar selección
        if (points.length === 0) {
          toast({
            title: "Sin puntos disponibles",
            description: "No hay puntos de atención configurados",
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
  }, [user, toast]);

  const handlePointSelect = (point: PuntoAtencion) => {
    try {
      setSelectedPoint(point);
      setShowPointSelection(false);
      toast({
        title: "Punto seleccionado",
        description: `Conectado a ${point.nombre}`,
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
        user={user!}
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
