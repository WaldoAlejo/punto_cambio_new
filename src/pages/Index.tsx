
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
      if (!user) return;

      try {
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
            setIsLoading(false);
            return;
          }
        }

        // Si es admin o super usuario, mostrar selección de punto
        if (user.rol === 'ADMIN' || user.rol === 'SUPER_USUARIO') {
          setShowPointSelection(true);
        } else if (points.length > 0) {
          // Para otros roles, usar el primer punto disponible
          setSelectedPoint(points[0]);
        }
      } catch (error) {
        console.error('Error loading points:', error);
        toast({
          title: "Error",
          description: "Error al cargar puntos de atención",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadPoints();
  }, [user, toast]);

  const handlePointSelect = (point: PuntoAtencion) => {
    setSelectedPoint(point);
    setShowPointSelection(false);
  };

  const handleLogout = () => {
    logout();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
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
    return null;
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
