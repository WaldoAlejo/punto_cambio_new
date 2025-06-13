
import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { User, PuntoAtencion } from '../../types';

interface PointManagementProps {
  user: User;
}

const PointManagement = ({ user }: PointManagementProps) => {
  const [points, setPoints] = useState<PuntoAtencion[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    nombre: '',
    direccion: '',
    telefono: ''
  });

  useEffect(() => {
    // Load mock points
    const mockPoints: PuntoAtencion[] = [
      {
        id: '1',
        nombre: 'Punto Centro',
        direccion: 'Av. Principal 123, Centro',
        ciudad: 'Caracas',
        provincia: 'Distrito Capital',
        telefono: '+58 212-555-0001',
        activo: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        saldos: []
      },
      {
        id: '2',
        nombre: 'Punto Norte',
        direccion: 'CC El Recreo, Nivel 1, Local 45',
        ciudad: 'Caracas',
        provincia: 'Distrito Capital',
        telefono: '+58 212-555-0002',
        activo: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        saldos: []
      }
    ];
    setPoints(mockPoints);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nombre || !formData.direccion) {
      toast({
        title: "Error",
        description: "Nombre y dirección son obligatorios",
        variant: "destructive"
      });
      return;
    }

    const newPoint: PuntoAtencion = {
      id: Date.now().toString(),
      nombre: formData.nombre,
      direccion: formData.direccion,
      ciudad: 'Caracas',
      provincia: 'Distrito Capital',
      telefono: formData.telefono,
      activo: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      saldos: []
    };

    setPoints(prev => [...prev, newPoint]);
    
    // Reset form
    setFormData({
      nombre: '',
      direccion: '',
      telefono: ''
    });
    setShowForm(false);

    toast({
      title: "Punto creado",
      description: `Punto ${newPoint.nombre} creado exitosamente`,
    });
  };

  const togglePointStatus = (pointId: string) => {
    setPoints(prev => prev.map(p => 
      p.id === pointId ? { ...p, activo: !p.activo } : p
    ));
    
    const targetPoint = points.find(p => p.id === pointId);
    toast({
      title: "Estado actualizado",
      description: `Punto ${targetPoint?.nombre} ${targetPoint?.activo ? 'desactivado' : 'activado'}`,
    });
  };

  if (user.rol !== 'ADMIN' && user.rol !== 'SUPER_USUARIO') {
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
                  value={formData.nombre}
                  onChange={(e) => setFormData(prev => ({ ...prev, nombre: e.target.value }))}
                  placeholder="Ej: Punto Centro"
                />
              </div>

              <div className="space-y-2">
                <Label>Dirección</Label>
                <Input
                  value={formData.direccion}
                  onChange={(e) => setFormData(prev => ({ ...prev, direccion: e.target.value }))}
                  placeholder="Dirección completa del punto"
                />
              </div>

              <div className="space-y-2">
                <Label>Teléfono (Opcional)</Label>
                <Input
                  value={formData.telefono}
                  onChange={(e) => setFormData(prev => ({ ...prev, telefono: e.target.value }))}
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
                  <TableCell className="font-medium">{point.nombre}</TableCell>
                  <TableCell>{point.direccion}</TableCell>
                  <TableCell>{point.telefono || 'N/A'}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      point.activo 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {point.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </TableCell>
                  <TableCell>
                    {new Date(point.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant={point.activo ? "destructive" : "default"}
                      onClick={() => togglePointStatus(point.id)}
                    >
                      {point.activo ? 'Desactivar' : 'Activar'}
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
