
import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { User, PuntoAtencion } from '../../types';
import { pointService } from '../../services/pointService';

interface PointManagementProps {
  user: User;
}

const PointManagement = ({ user }: PointManagementProps) => {
  const [points, setPoints] = useState<PuntoAtencion[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [formData, setFormData] = useState({
    nombre: '',
    direccion: '',
    ciudad: '',
    provincia: '',
    codigo_postal: '',
    telefono: ''
  });

  useEffect(() => {
    loadPoints();
  }, []);

  const loadPoints = async () => {
    setIsLoading(true);
    try {
      const { points: fetchedPoints, error } = await pointService.getAllPoints();
      
      if (error) {
        toast({
          title: "Error",
          description: error,
          variant: "destructive"
        });
        return;
      }

      setPoints(fetchedPoints);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.nombre || !formData.direccion || !formData.ciudad || !formData.provincia) {
      toast({
        title: "Error",
        description: "Nombre, dirección, ciudad y provincia son obligatorios",
        variant: "destructive"
      });
      return;
    }

    try {
      const { point: newPoint, error } = await pointService.createPoint({
        nombre: formData.nombre,
        direccion: formData.direccion,
        ciudad: formData.ciudad,
        provincia: formData.provincia,
        codigo_postal: formData.codigo_postal,
        telefono: formData.telefono
      });

      if (error || !newPoint) {
        toast({
          title: "Error",
          description: error || "Error al crear punto",
          variant: "destructive"
        });
        return;
      }

      // Recargar la lista de puntos
      await loadPoints();
      
      // Reset form
      setFormData({
        nombre: '',
        direccion: '',
        ciudad: '',
        provincia: '',
        codigo_postal: '',
        telefono: ''
      });
      setShowForm(false);

      toast({
        title: "Punto creado",
        description: `Punto ${newPoint.nombre} creado exitosamente`,
      });
    } catch (error) {
      console.error('Error creating point:', error);
      toast({
        title: "Error",
        description: "Error interno del servidor",
        variant: "destructive"
      });
    }
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

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando puntos...</p>
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
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nombre del Punto</Label>
                  <Input
                    value={formData.nombre}
                    onChange={(e) => setFormData(prev => ({ ...prev, nombre: e.target.value }))}
                    placeholder="Ej: Punto Centro"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Ciudad</Label>
                  <Input
                    value={formData.ciudad}
                    onChange={(e) => setFormData(prev => ({ ...prev, ciudad: e.target.value }))}
                    placeholder="Ciudad"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Provincia</Label>
                  <Input
                    value={formData.provincia}
                    onChange={(e) => setFormData(prev => ({ ...prev, provincia: e.target.value }))}
                    placeholder="Provincia"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Código Postal (Opcional)</Label>
                  <Input
                    value={formData.codigo_postal}
                    onChange={(e) => setFormData(prev => ({ ...prev, codigo_postal: e.target.value }))}
                    placeholder="Código postal"
                  />
                </div>
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
          {points.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">No hay puntos de atención registrados</p>
              <p className="text-gray-400 mt-2">
                Cree el primer punto de atención haciendo clic en "Nuevo Punto"
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Dirección</TableHead>
                  <TableHead>Ciudad/Provincia</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Fecha Creación</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {points.map((point) => (
                  <TableRow key={point.id}>
                    <TableCell className="font-medium">{point.nombre}</TableCell>
                    <TableCell>{point.direccion}</TableCell>
                    <TableCell>{point.ciudad}, {point.provincia}</TableCell>
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
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PointManagement;
