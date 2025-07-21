import { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import Dashboard from "../components/dashboard/Dashboard";
import PointSelection from "../components/auth/PointSelection";
import { PuntoAtencion } from "../types";
import { pointService } from "../services/pointService";
import { useToast } from "@/hooks/use-toast";

const Index = () => {
  const { user, logout, selectedPoint, setSelectedPoint } = useAuth();
  const [availablePoints, setAvailablePoints] = useState<PuntoAtencion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showPointSelection, setShowPointSelection] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const loadPoints = async () => {
      if (!user) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);

        if (user.rol === "ADMIN" || user.rol === "SUPER_USUARIO") {
          toast({
            title: "Acceso administrativo",
            description: `Bienvenido ${user.nombre}`,
          });
          setIsLoading(false);
          return;
        }

        if (selectedPoint) {
          toast({
            title: "Sesión continuada",
            description: `Continuando en ${selectedPoint.nombre}`,
          });
          setIsLoading(false);
          return;
        }

        const { points } = await pointService.getActivePoints();

        if (user.punto_atencion_id) {
          const userPoint = points.find((p) => p.id === user.punto_atencion_id);
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

        setAvailablePoints(points);

        if (points.length === 0) {
          toast({
            title: "Sin puntos disponibles",
            description: "No hay puntos de atención libres en este momento",
            variant: "destructive",
          });
        } else {
          toast({
            title: "Seleccione un punto",
            description: "Seleccione su punto de atención para continuar",
          });
          setShowPointSelection(true);
        }
      } catch {
        toast({
          title: "Error de conexión",
          description: "No se pudieron cargar los puntos",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadPoints();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handlePointSelect = (point: PuntoAtencion) => {
    try {
      setSelectedPoint(point);
      setShowPointSelection(false);
      toast({
        title: "Jornada iniciada",
        description: `Jornada iniciada en ${point.nombre}`,
      });
    } catch {
      toast({
        title: "Error",
        description: "No se pudo seleccionar el punto",
        variant: "destructive",
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
    } catch {
      toast({
        title: "Error",
        description: "No se pudo cerrar sesión",
        variant: "destructive",
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

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">Redirigiendo al login...</p>
      </div>
    );
  }

  if (showPointSelection) {
    return (
      <PointSelection
        points={availablePoints}
        onPointSelect={handlePointSelect}
        onLogout={handleLogout}
        user={user}
      />
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
