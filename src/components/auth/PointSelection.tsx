import { useState, useEffect } from "react";
import axios from "axios";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { User, PuntoAtencion } from "../../types";

interface PointSelectionProps {
  user: User;
  points: PuntoAtencion[];
  onPointSelect: (point: PuntoAtencion) => void;
  onLogout: () => void;
}

interface PuntosActivosResponse {
  puntos: { id: string }[];
}

const PointSelection = ({
  user,
  points,
  onPointSelect,
  onLogout,
}: PointSelectionProps) => {
  const [occupiedPoints, setOccupiedPoints] = useState<string[]>([]);

  useEffect(() => {
    const fetchOccupiedPoints = async () => {
      try {
        const response = await axios.get<PuntosActivosResponse>(
          "/api/puntos/activos"
        );
        const ocupados = response.data.puntos.map((p) => p.id);
        setOccupiedPoints(ocupados);
      } catch (error) {
        console.error("Error al cargar puntos activos", error);
        setOccupiedPoints([]); // fallback
      }
    };

    fetchOccupiedPoints();
  }, []);

  const handlePointSelect = (point: PuntoAtencion) => {
    if (occupiedPoints.includes(point.id)) return;
    onPointSelect(point);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="text-center">
            Seleccionar Punto de Atención
          </CardTitle>
          <CardDescription className="text-center">
            Hola {user.nombre}, selecciona el punto de atención donde trabajarás
            hoy
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {points.map((point) => {
              const isOccupied = occupiedPoints.includes(point.id);
              return (
                <div
                  key={point.id}
                  className={`p-4 border rounded-lg transition-colors ${
                    isOccupied
                      ? "bg-gray-100 border-gray-300 cursor-not-allowed"
                      : "hover:bg-blue-50 cursor-pointer border-gray-200"
                  }`}
                  onClick={() => handlePointSelect(point)}
                >
                  <div className="flex items-center justify-between">
                    <div className={isOccupied ? "text-gray-500" : ""}>
                      <h3 className="font-semibold text-lg">{point.nombre}</h3>
                      <p className="text-sm text-gray-600">{point.direccion}</p>
                      <p className="text-sm text-gray-600">
                        {point.ciudad}, {point.provincia}
                      </p>
                      {point.telefono && (
                        <p className="text-sm text-gray-600">
                          {point.telefono}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      {isOccupied ? (
                        <span className="text-sm text-red-600 font-medium">
                          Ocupado por otro usuario
                        </span>
                      ) : (
                        <Button size="sm">Seleccionar</Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-6 pt-4 border-t flex justify-center">
            <Button
              variant="outline"
              onClick={onLogout}
              className="text-red-600 border-red-600 hover:bg-red-50"
            >
              Cerrar Sesión
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PointSelection;
