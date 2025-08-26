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
import { toast } from "@/hooks/use-toast";
import { PuntoAtencion, Agencia } from "../../types";
import { pointService } from "../../services/pointService";
import EditPointDialog from "@/components/admin/EditPointDialog";
import { AgenciaSelector } from "@/components/ui/AgenciaSelector";
import { Edit } from "lucide-react";

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
    servientrega_agencia_codigo: "",
    servientrega_agencia_nombre: "",
  });
  const [editingPoint, setEditingPoint] = useState<PuntoAtencion | null>(null);

  const loadPoints = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { points: fetchedPoints } =
        await pointService.getAllPointsForAdmin();
      setPoints(fetchedPoints);
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

    if (
      !formData.nombre ||
      !formData.direccion ||
      !formData.ciudad ||
      !formData.provincia
    ) {
      toast({
        title: "Error",
        description:
          "Los campos nombre, dirección, ciudad y provincia son obligatorios",
        variant: "destructive",
      });
      return;
    }

    try {
      const { point: newPoint } = await pointService.createPoint(formData);

      if (!newPoint) {
        toast({
          title: "Error",
          description: "Error al crear punto de atención",
          variant: "destructive",
        });
        return;
      }

      await loadPoints();
      setFormData({
        nombre: "",
        direccion: "",
        ciudad: "",
        provincia: "",
        codigo_postal: "",
        telefono: "",
        servientrega_agencia_codigo: "",
        servientrega_agencia_nombre: "",
      });
      setShowForm(false);

      toast({
        title: "Punto creado",
        description: `Punto de atención ${newPoint.nombre} creado exitosamente`,
      });
    } catch {
      toast({
        title: "Error",
        description: "Error interno del servidor",
        variant: "destructive",
      });
    }
  };

  // --- ACTIVAR/DESACTIVAR ---
  const togglePointStatus = async (pointId: string) => {
    try {
      await pointService.togglePointStatus(pointId);
      await loadPoints();
      const targetPoint = points.find((p) => p.id === pointId);
      toast({
        title: "Estado actualizado",
        description: `Punto ${targetPoint?.nombre} ${
          targetPoint?.activo ? "desactivado" : "activado"
        }`,
      });
    } catch {
      toast({
        title: "Error",
        description: "No se pudo cambiar el estado del punto",
        variant: "destructive",
      });
    }
  };

  // --- UI ---
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
        <p className="text-red-500 text-lg">
          Error al cargar puntos de atención
        </p>
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
        <Button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {showForm ? "Cancelar" : "Nuevo Punto"}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Crear Nuevo Punto de Atención</CardTitle>
            <CardDescription>
              Complete la información del nuevo punto de atención
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nombre *</Label>
                  <Input
                    value={formData.nombre}
                    onChange={(e) =>
                      setFormData({ ...formData, nombre: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Ciudad *</Label>
                  <Input
                    value={formData.ciudad}
                    onChange={(e) =>
                      setFormData({ ...formData, ciudad: e.target.value })
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Dirección *</Label>
                <Input
                  value={formData.direccion}
                  onChange={(e) =>
                    setFormData({ ...formData, direccion: e.target.value })
                  }
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Provincia *</Label>
                  <Input
                    value={formData.provincia}
                    onChange={(e) =>
                      setFormData({ ...formData, provincia: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Código Postal</Label>
                  <Input
                    value={formData.codigo_postal}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        codigo_postal: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Teléfono</Label>
                  <Input
                    value={formData.telefono}
                    onChange={(e) =>
                      setFormData({ ...formData, telefono: e.target.value })
                    }
                  />
                </div>
              </div>

              <AgenciaSelector
                value={formData.servientrega_agencia_nombre}
                onAgenciaSelect={(agencia) => {
                  setFormData({
                    ...formData,
                    servientrega_agencia_codigo: agencia?.tipo_cs || "",
                    servientrega_agencia_nombre: agencia?.nombre || "",
                  });
                }}
                placeholder="Seleccionar agencia de Servientrega..."
              />

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
          <CardTitle>Puntos de Atención del Sistema</CardTitle>
          <CardDescription>
            Lista de todos los puntos de atención registrados
          </CardDescription>
        </CardHeader>
        <CardContent>
          {points.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg">No hay puntos registrados</p>
              <p className="text-gray-400 mt-2">
                Cree uno haciendo clic en "Nuevo Punto"
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Dirección</TableHead>
                  <TableHead>Ciudad</TableHead>
                  <TableHead>Provincia</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead>Agencia Servientrega</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Fecha Creación</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {points.map((point) => (
                  <TableRow key={point.id}>
                    <TableCell className="font-medium">
                      {point.nombre}
                    </TableCell>
                    <TableCell>{point.direccion}</TableCell>
                    <TableCell>{point.ciudad}</TableCell>
                    <TableCell>{point.provincia}</TableCell>
                    <TableCell>{point.telefono || "N/A"}</TableCell>
                    <TableCell>
                      {point.servientrega_agencia_nombre || "No asignada"}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          point.activo
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {point.activo ? "Activo" : "Inactivo"}
                      </span>
                    </TableCell>
                    <TableCell>
                      {new Date(point.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingPoint(point)}
                          title="Editar punto"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant={point.activo ? "destructive" : "default"}
                          onClick={() => togglePointStatus(point.id)}
                        >
                          {point.activo ? "Desactivar" : "Activar"}
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

      {/* MODAL de edición */}
      {editingPoint && (
        <EditPointDialog
          point={editingPoint}
          isOpen={!!editingPoint}
          onClose={() => setEditingPoint(null)}
          onPointUpdated={loadPoints}
        />
      )}
    </div>
  );
};
