
import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { User, AttentionPoint } from '../../types';

interface PointManagementProps {
  user: User;
}

const PointManagement = ({ user }: PointManagementProps) => {
  const [points, setPoints] = useState<AttentionPoint[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    phone: ''
  });

  useEffect(() => {
    // Load mock points
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
      }
    ];
    setPoints(mockPoints);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.address) {
      toast({
        title: "Error",
        description: "Nombre y dirección son obligatorios",
        variant: "destructive"
      });
      return;
    }

    const newPoint: AttentionPoint = {
      id: Date.now().toString(),
      name: formData.name,
      address: formData.address,
      phone: formData.phone,
      is_active: true,
      created_at: new Date().toISOString(),
      balances: []
    };

    setPoints(prev => [...prev, newPoint]);
    
    // Reset form
    setFormData({
      name: '',
      address: '',
      phone: ''
    });
    setShowForm(false);

    toast({
      title: "Punto creado",
      description: `Punto ${newPoint.name} creado exitosamente`,
    });
  };

  const togglePointStatus = (pointId: string) => {
    setPoints(prev => prev.map(p => 
      p.id === pointId ? { ...p, is_active: !p.is_active } : p
    ));
    
    const targetPoint = points.find(p => p.id === pointId);
    toast({
      title: "Estado actualizado",
      description: `Punto ${targetPoint?.name} ${targetPoint?.is_active ? 'desactivado' : 'activado'}`,
    });
  };

  if (user.role !== 'administrador' && user.role !== 'super_usuario') {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-red-500 text-lg">No tiene permisos para acceder a esta sección</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Gestión de Puntos de Atención</h1>
        <Button 
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {showForm ? 'Cancelar' : 'Nuevo Punto'}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Crear Nuevo Punto de Atención</CardTitle>
            <CardDescription>Complete la información del nuevo punto</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Nombre del Punto</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Ej: Punto Centro"
                />
              </div>

              <div className="space-y-2">
                <Label>Dirección</Label>
                <Input
                  value={formData.address}
                  onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="Dirección completa del punto"
                />
              </div>

              <div className="space-y-2">
                <Label>Teléfono (Opcional)</Label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="Número de teléfono"
                />
              </div>

              <div className="flex gap-2">
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                  Crear Punto
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setShowForm(false)}
                >
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Puntos de Atención</CardTitle>
          <CardDescription>Lista de todos los puntos registrados</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Dirección</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Fecha Creación</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {points.map((point) => (
                <TableRow key={point.id}>
                  <TableCell className="font-medium">{point.name}</TableCell>
                  <TableCell>{point.address}</TableCell>
                  <TableCell>{point.phone || 'N/A'}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      point.is_active 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {point.is_active ? 'Activo' : 'Inactivo'}
                    </span>
                  </TableCell>
                  <TableCell>
                    {new Date(point.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant={point.is_active ? "destructive" : "default"}
                      onClick={() => togglePointStatus(point.id)}
                    >
                      {point.is_active ? 'Desactivar' : 'Activar'}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default PointManagement;
