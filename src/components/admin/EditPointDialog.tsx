import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PuntoAtencion } from "../../types";
import { pointService } from "../../services/pointService";
import { toast } from "@/hooks/use-toast";

interface EditPointDialogProps {
  point: PuntoAtencion;
  isOpen: boolean;
  onClose: () => void;
  onPointUpdated: () => void;
}

const EditPointDialog = ({
  point,
  isOpen,
  onClose,
  onPointUpdated,
}: EditPointDialogProps) => {
  const [formData, setFormData] = useState({
    nombre: point.nombre,
    direccion: point.direccion,
    ciudad: point.ciudad,
    provincia: point.provincia,
    codigo_postal: point.codigo_postal || "",
    telefono: point.telefono || "",
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

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
      setLoading(false);
      return;
    }

    try {
      const { point: updated } = await pointService.updatePoint(
        point.id,
        formData
      );
      if (!updated) throw new Error();

      toast({
        title: "Punto actualizado",
        description: `Punto de atención ${updated.nombre} actualizado correctamente`,
      });
      onClose();
      onPointUpdated();
    } catch {
      toast({
        title: "Error",
        description: "No se pudo actualizar el punto",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar Punto de Atención</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Nombre *</Label>
            <Input
              name="nombre"
              value={formData.nombre}
              onChange={handleChange}
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label>Dirección *</Label>
            <Input
              name="direccion"
              value={formData.direccion}
              onChange={handleChange}
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label>Ciudad *</Label>
            <Input
              name="ciudad"
              value={formData.ciudad}
              onChange={handleChange}
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label>Provincia *</Label>
            <Input
              name="provincia"
              value={formData.provincia}
              onChange={handleChange}
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label>Código Postal</Label>
            <Input
              name="codigo_postal"
              value={formData.codigo_postal}
              onChange={handleChange}
              disabled={loading}
            />
          </div>
          <div className="space-y-2">
            <Label>Teléfono</Label>
            <Input
              name="telefono"
              value={formData.telefono}
              onChange={handleChange}
              disabled={loading}
            />
          </div>
          <DialogFooter className="mt-4 flex gap-2 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700"
              disabled={loading}
            >
              {loading ? "Guardando..." : "Guardar Cambios"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditPointDialog;
