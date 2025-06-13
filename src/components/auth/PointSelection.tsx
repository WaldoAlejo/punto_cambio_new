
import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { User, AttentionPoint } from '../../types';

interface PointSelectionProps {
  user: User;
  onPointSelect: (point: AttentionPoint) => void;
  onLogout: () => void;
}

const PointSelection = ({ user, onPointSelect, onLogout }: PointSelectionProps) => {
  const [points, setPoints] = useState<AttentionPoint[]>([]);
  const [loading, setLoading] = useState(true);

  // Mock attention points - In production this would come from your backend
  const mockPoints: AttentionPoint[] = [
    {
      id: '1',
      name: 'Punto Centro',
      address: 'Av. Principal 123, Centro',
      phone: '+58 212-555-0001',
      is_active: true,
      created_at: new Date().toISOString(),
      balances: []
    },
    {
      id: '2', 
      name: 'Punto Norte',
      address: 'CC El Recreo, Nivel 1, Local 45',
      phone: '+58 212-555-0002',
      is_active: true,
      created_at: new Date().toISOString(),
      balances: []
    },
    {
      id: '3',
      name: 'Punto Sur',
      address: 'Av. Francisco de Miranda, Torre Sur',
      phone: '+58 212-555-0003',
      is_active: true,
      created_at: new Date().toISOString(),
      balances: []
    }
  ];

  useEffect(() => {
    const loadPoints = async () => {
      try {
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 500));
        setPoints(mockPoints.filter(p => p.is_active));
      } catch (error) {
        toast({
          title: "Error",
          description: "No se pudieron cargar los puntos de atención",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };

    loadPoints();
  }, []);

  const handlePointSelect = (point: AttentionPoint) => {
    toast({
      title: "Punto seleccionado",
      description: `Trabajando en: ${point.name}`,
    });
    onPointSelect(point);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Cargando puntos de atención...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-blue-800">Seleccionar Punto de Atención</h1>
            <p className="text-gray-600 mt-2">Bienvenido {user.name}</p>
          </div>
          <Button 
            variant="outline" 
            onClick={onLogout}
            className="text-red-600 border-red-600 hover:bg-red-50"
          >
            Cerrar Sesión
          </Button>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {points.map((point) => (
            <Card 
              key={point.id} 
              className="hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => handlePointSelect(point)}
            >
              <CardHeader>
                <CardTitle className="text-lg text-blue-700">{point.name}</CardTitle>
                <CardDescription>{point.address}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {point.phone && (
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Teléfono:</span> {point.phone}
                    </p>
                  )}
                  <div className="flex items-center">
                    <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                    <span className="text-sm text-green-600">Activo</span>
                  </div>
                </div>
                <Button 
                  className="w-full mt-4 bg-blue-600 hover:bg-blue-700"
                  onClick={() => handlePointSelect(point)}
                >
                  Seleccionar
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {points.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No hay puntos de atención disponibles</p>
            <Button 
              variant="outline" 
              onClick={onLogout}
              className="mt-4"
            >
              Volver al login
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PointSelection;
