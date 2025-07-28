import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { PuntoAtencion } from "../../types";
import { pointService } from "../../services/pointService";
import EditPointDialog from "@/components/admin/EditPointDialog";
import { Edit, Trash } from "lucide-react";

export const PointManagement = () => {
  const [points, setPoints] = useState<PuntoAtencion[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    nombre: "",
    direccion: "",
    ciudad: "",
    provincia: "",
    codigo_postal: "",
    telefono: "",
  });
  const [editingPoint, setEditingPoint] = useState<PuntoAtencion | null>(null);
  const [deletePointId, setDeletePointId] = useState<string | null>(null); // Para confirmar eliminación
  const [deleteLoading, setDeleteLoading] = useState(false);

  const loadPoints = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { points: fetchedPoints } = await pointService.getAllPointsForAdmin();
      // Ordenar por nombre
      setPoints(fetchedPoints.sort((a, b) => a.nombre.localeCompare(b.nombre)));
    } catch {
      const errorMessage = "Error al cargar puntos de atención";
      setError(errorMessage);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPoints();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nombre || !formData.direccion || !formData.ciudad || !formData.provincia) {
      toast({
        title: "Error",
        description: "Los campos nombre, dirección, ciudad y provincia son obligatorios",
        variant: "destructive",
      });
      return;
    }

    try {
      const { point: newPoint } = await pointService.createPoint(formData);
      if (!newPoint) throw new Error();

      await loadPoints();
      setFormData({
        nombre: "",
        direccion: "",
        ciudad: "",
        provincia: "",
        codigo_postal: "",
        telefono: "",
      });
      setShowForm(false);

      toast({
        title: "Punto creado",
        description: `Punto ${newPoint.nombre} creado exitosamente`,
      });
    } catch {
      toast({
        title: "Error",
        description: "Error interno del servidor",
        variant: "destructive",
      });
    }
  };

  const togglePointStatus = async (pointId: string) => {
    try {
      await pointService.togglePointStatus(pointId);
      await loadPoints();
      toast({
        title: "Estado actualizado",
        description: "Estado del punto actualizado correctamente",
      });
    } catch {
      toast({
        title: "Error",
        description: "No se pudo cambiar el estado del punto",
        variant: "destructive",
      });
    }
  };

  const confirmDeletePoint = (pointId: string) => {
    setDeletePointId(pointId);
  };

  const handleDeletePoint = async () => {
    if (!deletePointId) return;
    setDeleteLoading(true);
    try {
      await pointService.deletePoint(deletePointId);
      await loadPoints();
      toast({
        title: "Punto eliminado",
        description: "El punto fue eliminado correctamente",
      });
    } catch {
      toast({
        title: "Error",
        description: "No se pudo eliminar el punto",
        variant: "destructive",
      });
    } finally {
      setDeleteLoading(false);
      setDeletePointId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 text-center py-12">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Cargando puntos de atención...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center py-12">
        <p className="text-red-500 text-lg">Error al cargar puntos de atención</p>
        <p className="text-gray-500 mt-2">{error}</p>
        <Button onClick={loadPoints} className="mt-4" variant="outline">
          Reintentar
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">
          Gestión de Puntos de Atención
        </h1>
        <Button onClick={() => setShowForm(!showForm)} className="bg-blue-600 hover:bg-blue-700">
          {showForm ? "Cancelar" : "Nuevo Punto"}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Crear Nuevo Punto de Atención</CardTitle>
            <CardDescription>Complete la información del nuevo punto de atención</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Nombre *</Label>
                  <Input value={formData.nombre} onChange={(e) => setFormData({ ...formData, nombre: e.target.value })} />
                </div>
                <div>
                  <Label>Ciudad *</Label>
                  <Input value={formData.ciudad} onChange={(e) => setFormData({ ...formData, ciudad: e.target.value })} />
                </div>
              </div>
              <div>
                <Label>Dirección *</Label>
                <Input value={formData.direccion} onChange={(e) => setFormData({ ...formData, direccion: e.target.value })} />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Provincia *</Label>
                  <Input value={formData.provincia} onChange={(e) => setFormData({ ...formData, provincia: e.target.value })} />
                </div>
                <div>
                  <Label>Código Postal</Label>
                  <Input value={formData.codigo_postal} onChange={(e) => setFormData({ ...formData, codigo_postal: e.target.value })} />
                </div>
                <div>
                  <Label>Teléfono</Label>
                  <Input value={formData.telefono} onChange={(e) => setFormData({ ...formData, telefono: e.target.value })} />
                </div>
              </div>
              <div className="flex gap-2">
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                  Crear Punto
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Puntos de Atención del Sistema</CardTitle>
          <CardDescription>Lista de todos los puntos registrados</CardDescription>
        </CardHeader>
        <CardContent>
          {points.length === 0 ? (
            <div className="text-center py-12 text-gray-500">No hay puntos registrados</div>
          ) : (
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
                    <TableCell>{point.nombre}</TableCell>
                    <TableCell>{point.direccion}</TableCell>
                    <TableCell>{point.ciudad}</TableCell>
                    <TableCell>{point.provincia}</TableCell>
                    <TableCell>{point.telefono || "N/A"}</TableCell>
                    <TableCell>
                      <span
                        className={`px-2 py-1 rounded text-xs ${
                          point.activo ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                        }`}
                      >
                        {point.activo ? "Activo" : "Inactivo"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => setEditingPoint(point)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant={point.activo ? "destructive" : "default"} onClick={() => togglePointStatus(point.id)}>
                          {point.activo ? "Desactivar" : "Activar"}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => confirmDeletePoint(point.id)}>
                          <Trash className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {editingPoint && (
        <EditPointDialog point={editingPoint} isOpen={!!editingPoint} onClose={() => setEditingPoint(null)} onPointUpdated={loadPoints} />
      )}

      {/* Dialog de confirmación de eliminación */}
      <Dialog open={!!deletePointId} onOpenChange={() => setDeletePointId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar eliminación</DialogTitle>
          </DialogHeader>
          <p>¿Estás seguro de que deseas eliminar este punto de atención? Esta acción no se puede deshacer.</p>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setDeletePointId(null)} disabled={deleteLoading}>
              Cancelar
            </Button>
            <Button className="bg-red-600 hover:bg-red-700" onClick={handleDeletePoint} disabled={deleteLoading}>
              {deleteLoading ? "Eliminando..." : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
