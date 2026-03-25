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
import { PuntoAtencion } from "../../types";
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
    servientrega_alianza: "",
    servientrega_oficina_alianza: "",
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
        servientrega_alianza: "",
        servientrega_oficina_alianza: "",
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
      <div className="p-3 sm:p-6 text-center py-8 sm:py-12">
        <div className="animate-spin rounded-full h-16 w-16 sm:h-32 sm:w-32 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-3 sm:mt-4 text-sm sm:text-base text-gray-600">Cargando puntos...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-3 sm:p-6 text-center py-8 sm:py-12">
        <p className="text-red-500 text-base sm:text-lg">
          Error al cargar puntos
        </p>
        <p className="text-gray-500 mt-2 text-sm">{error}</p>
        <Button onClick={loadPoints} className="mt-4" variant="outline">
          Reintentar
        </Button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-3 sm:gap-4">
      {/* Header - Responsive */}
      <div className="flex-shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <h1 className="text-base sm:text-lg font-bold text-gray-800">
          Gestión de Puntos
        </h1>
        <Button
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 hover:bg-blue-700 text-sm h-9"
        >
          {showForm ? "Cancelar" : "Nuevo Punto"}
        </Button>
      </div>

      {/* Contenido scrolleable */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-4">
        {showForm && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base sm:text-lg">Crear Nuevo Punto</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Complete la información del punto
              </CardDescription>
            </CardHeader>
            <CardContent className="max-h-[70vh] overflow-y-auto p-3 sm:p-6">
              <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
                {/* Información básica */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div className="space-y-1.5 sm:space-y-2">
                    <Label className="text-xs sm:text-sm">Nombre *</Label>
                    <Input
                      value={formData.nombre}
                      onChange={(e) =>
                        setFormData({ ...formData, nombre: e.target.value })
                      }
                      placeholder="Nombre del punto de atención"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Ciudad *</Label>
                    <Input
                      value={formData.ciudad}
                      onChange={(e) =>
                        setFormData({ ...formData, ciudad: e.target.value })
                      }
                      placeholder="Ciudad"
                    />
                  </div>
                </div>

                {/* Dirección completa */}
                <div className="space-y-2">
                  <Label>Dirección *</Label>
                  <Input
                    value={formData.direccion}
                    onChange={(e) =>
                      setFormData({ ...formData, direccion: e.target.value })
                    }
                    placeholder="Dirección completa"
                  />
                </div>

                {/* Información adicional */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Provincia *</Label>
                    <Input
                      value={formData.provincia}
                      onChange={(e) =>
                        setFormData({ ...formData, provincia: e.target.value })
                      }
                      placeholder="Provincia"
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
                      placeholder="Código postal"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Teléfono</Label>
                    <Input
                      value={formData.telefono}
                      onChange={(e) =>
                        setFormData({ ...formData, telefono: e.target.value })
                      }
                      placeholder="Número de teléfono"
                    />
                  </div>
                </div>

                {/* Selector de agencia */}
                <div className="border-t pt-4">
                  <AgenciaSelector
                    value={formData.servientrega_agencia_nombre}
                    onAgenciaSelect={(agencia) => {
                      setFormData({
                        ...formData,
                        servientrega_agencia_codigo: agencia?.tipo_cs || "",
                        servientrega_agencia_nombre: agencia?.nombre || "",
                        // 🔧 CORRECCIÓN: alianza SIEMPRE es "PUNTO CAMBIO SAS"
                        servientrega_alianza: "PUNTO CAMBIO SAS",
                        // 🔧 CORRECCIÓN: oficina_alianza es el nombre de la agencia
                        servientrega_oficina_alianza: agencia?.nombre || "",
                      });
                    }}
                    placeholder="Seleccionar agencia de Servientrega..."
                  />
                </div>

                {/* Botones de acción */}
                <div className="flex gap-3 pt-4 border-t bg-gray-50 -mx-6 px-6 py-4 mt-6">
                  <Button
                    type="submit"
                    className="bg-blue-600 hover:bg-blue-700"
                  >
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
                <p className="text-gray-500 text-lg">
                  No hay puntos registrados
                </p>
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
    </div>
  );
};
