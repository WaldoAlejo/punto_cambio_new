
import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { User, PuntoAtencion } from '../../types';

interface PointSelectionProps {
  user: User;
  onPointSelect: (point: PuntoAtencion) => void;
  onLogout: () => void;
}

const PointSelection = ({ user, onPointSelect, onLogout }: PointSelectionProps) => {
  const [points, setPoints] = useState<PuntoAtencion[]>([]);
  const [occupiedPoints, setOccupiedPoints] = useState<string[]>([]);

  // Mock data - puntos de atención
  const mockPoints: PuntoAtencion[] = [
    {
      id: '1',
      nombre: 'Punto Centro',
      direccion: 'Av. Principal #123',
      ciudad: 'Caracas',
      provincia: 'Distrito Capital',
      telefono: '+58 212-1234567',
      activo: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: '2',
      nombre: 'Punto Norte',
      direccion: 'Centro Comercial Norte, Local 45',
      ciudad: 'Caracas',
      provincia: 'Distrito Capital',
      telefono: '+58 212-7654321',
      activo: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: '3',
      nombre: 'Punto Sur',
      direccion: 'Mall del Sur, Piso 2, Local 201',
      ciudad: 'Caracas',
      provincia: 'Distrito Capital',
      telefono: '+58 212-9876543',
      activo: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ];

  // Mock data - puntos ocupados (simulando usuarios conectados)
  const mockOccupiedPoints = ['2']; // Punto Norte está ocupado

  useEffect(() => {
    setPoints(mockPoints);
    setOccupiedPoints(mockOccupiedPoints);
  }, []);

  const handlePointSelect = (point: PuntoAtencion) => {
    if (occupiedPoints.includes(point.id)) {
      return; // No permitir seleccionar puntos ocupados
    }
    onPointSelect(point);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle className="text-center">Seleccionar Punto de Atención</CardTitle>
          <CardDescription className="text-center">
            Hola {user.nombre}, selecciona el punto de atención donde trabajarás hoy
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {points.map(point => {
              const isOccupied = occupiedPoints.includes(point.id);
              return (
                <div
                  key={point.id}
                  className={`p-4 border rounded-lg transition-colors ${
                    isOccupied 
                      ? 'bg-gray-100 border-gray-300 cursor-not-allowed' 
                      : 'hover:bg-blue-50 cursor-pointer border-gray-200'
                  }`}
                  onClick={() => handlePointSelect(point)}
                >
                  <div className="flex items-center justify-between">
                    <div className={isOccupied ? 'text-gray-500' : ''}>
                      <h3 className="font-semibold text-lg">{point.nombre}</h3>
                      <p className="text-sm text-gray-600">{point.direccion}</p>
                      <p className="text-sm text-gray-600">{point.ciudad}, {point.provincia}</p>
                      <p className="text-sm text-gray-600">{point.telefono}</p>
                    </div>
                    <div className="text-right">
                      {isOccupied ? (
                        <span className="text-sm text-red-600 font-medium">
                          Ocupado por otro usuario
                        </span>
                      ) : (
                        <Button size="sm">
                          Seleccionar
                        </Button>
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
