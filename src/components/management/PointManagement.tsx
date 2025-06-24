import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { pointService } from "@/services/pointService";
import { PuntoAtencion, CreatePointData } from "@/types";
import { MapPin, Plus, Edit, Power } from "lucide-react";

export const PointManagement = () => {
  const [points, setPoints] = useState<PuntoAtencion[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingPoint, setEditingPoint] = useState<PuntoAtencion | null>(null);
  const [formData, setFormData] = useState<CreatePointData>({
    nombre: "",
    direccion: "",
    ciudad: "",
    provincia: "",
    codigo_postal: "",
    telefono: "",
  });
  const { toast } = useToast();

  useEffect(() => {
    loadPoints();
  }, []);

  const loadPoints = async () => {
    setLoading(true);
    try {
      const result = await pointService.getAllPoints();
      
      if (result.error) {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive",
        });
      } else {
        setPoints(result.points);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al cargar puntos de atención",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePoint = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (!formData.nombre || !formData.direccion || !formData.ciudad || !formData.provincia) {
        toast({
          title: "Error",
          description: "Los campos nombre, dirección, ciudad y provincia son obligatorios",
          variant: "destructive",
        });
        return;
      }

      const pointData = {
        ...formData,
        codigo_postal: formData.codigo_postal || undefined,
        telefono: formData.telefono || undefined,
      };

      const result = await pointService.createPoint(pointData);
      
      if (result.error) {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Éxito",
          description: "Punto de atención creado correctamente",
        });
        
        setDialogOpen(false);
        setFormData({
          nombre: "",
          direccion: "",
          ciudad: "",
          provincia: "",
          codigo_postal: "",
          telefono: "",
        });
        
        await loadPoints();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al crear punto de atención",
        variant: "destructive",
      });
    }
  };

  const handleEditPoint = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editingPoint) return;

    try {
      const result = await pointService.updatePoint(editingPoint.id, formData);
      
      if (result.error) {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Éxito",
          description: "Punto de atención actualizado correctamente",
        });
        
        setEditDialogOpen(false);
        setEditingPoint(null);
        setFormData({
          nombre: "",
          direccion: "",
          ciudad: "",
          provincia: "",
          codigo_postal: "",
          telefono: "",
        });
        
        await loadPoints();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al actualizar punto de atención",
        variant: "destructive",
      });
    }
  };

  const handleToggleStatus = async (point: PuntoAtencion) => {
    try {
      const result = await pointService.togglePointStatus(point.id);
      
      if (result.error) {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Éxito",
          description: `Punto ${result.point?.activo ? 'activado' : 'desactivado'} correctamente`,
        });
        
        await loadPoints();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al cambiar estado del punto",
        variant: "destructive",
      });
    }
  };

  const openEditDialog = (point: PuntoAtencion) => {
    setEditingPoint(point);
    setFormData({
      nombre: point.nombre,
      direccion: point.direccion,
      ciudad: point.ciudad,
      provincia: point.provincia,
      codigo_postal: point.codigo_postal || "",
      telefono: point.telefono || "",
    });
    setEditDialogOpen(true);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            <span className="ml-2">Cargando puntos de atención...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <MapPin className="h-5 w-5" />
            <CardTitle>Gestión de Puntos de Atención</CardTitle>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nuevo Punto
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Crear Nuevo Punto de Atención</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreatePoint} className="space-y-4">
                <div>
                  <Label htmlFor="nombre">Nombre</Label>
                  <Input
                    id="nombre"
                    value={formData.nombre}
                    onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="direccion">Dirección</Label>
                  <Input
                    id="direccion"
                    value={formData.direccion}
                    onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="ciudad">Ciudad</Label>
                    <Input
                      id="ciudad"
                      value={formData.ciudad}
                      onChange={(e) => setFormData({ ...formData, ciudad: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="provincia">Provincia</Label>
                    <Input
                      id="provincia"
                      value={formData.provincia}
                      onChange={(e) => setFormData({ ...formData, provincia: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="codigo_postal">Código Postal</Label>
                    <Input
                      id="codigo_postal"
                      value={formData.codigo_postal}
                      onChange={(e) => setFormData({ ...formData, codigo_postal: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="telefono">Teléfono</Label>
                    <Input
                      id="telefono"
                      value={formData.telefono}
                      onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full">
                  Crear Punto de Atención
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Dirección</TableHead>
              <TableHead>Ciudad</TableHead>
              <TableHead>Provincia</TableHead>
              <TableHead>Teléfono</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {points.map((point) => (
              <TableRow key={point.id}>
                <TableCell className="font-medium">{point.nombre}</TableCell>
                <TableCell>{point.direccion}</TableCell>
                <TableCell>{point.ciudad}</TableCell>
                <TableCell>{point.provincia}</TableCell>
                <TableCell>{point.telefono || "N/A"}</TableCell>
                <TableCell>
                  <Badge variant={point.activo ? "default" : "destructive"}>
                    {point.activo ? "Activo" : "Inactivo"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditDialog(point)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant={point.activo ? "destructive" : "default"}
                      size="sm"
                      onClick={() => handleToggleStatus(point)}
                    >
                      <Power className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Punto de Atención</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditPoint} className="space-y-4">
            <div>
              <Label htmlFor="edit_nombre">Nombre</Label>
              <Input
                id="edit_nombre"
                value={formData.nombre}
                onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="edit_direccion">Dirección</Label>
              <Input
                id="edit_direccion"
                value={formData.direccion}
                onChange={(e) => setFormData({ ...formData, direccion: e.target.value })}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit_ciudad">Ciudad</Label>
                <Input
                  id="edit_ciudad"
                  value={formData.ciudad}
                  onChange={(e) => setFormData({ ...formData, ciudad: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="edit_provincia">Provincia</Label>
                <Input
                  id="edit_provincia"
                  value={formData.provincia}
                  onChange={(e) => setFormData({ ...formData, provincia: e.target.value })}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="edit_codigo_postal">Código Postal</Label>
                <Input
                  id="edit_codigo_postal"
                  value={formData.codigo_postal}
                  onChange={(e) => setFormData({ ...formData, codigo_postal: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit_telefono">Teléfono</Label>
                <Input
                  id="edit_telefono"
                  value={formData.telefono}
                  onChange={(e) => setFormData({ ...formData, telefono: e.target.value })}
                />
              </div>
            </div>
            <div className="flex space-x-2">
              <Button type="submit" className="flex-1">
                Actualizar Punto
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditDialogOpen(false)}
              >
                Cancelar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
