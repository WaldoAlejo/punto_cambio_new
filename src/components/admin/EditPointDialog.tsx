import { useState, useEffect } from "react";
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
import { PuntoAtencion, Agencia } from "../../types";
import { pointService } from "../../services/pointService";
import { AgenciaSelector } from "@/components/ui/AgenciaSelector";
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
    servientrega_agencia_codigo: point.servientrega_agencia_codigo || "",
    servientrega_agencia_nombre: point.servientrega_agencia_nombre || "",
  });
  const [loading, setLoading] = useState(false);

  // ✅ Resetear formulario al cambiar de punto o abrir modal
  useEffect(() => {
    if (isOpen) {
      setFormData({
        nombre: point.nombre,
        direccion: point.direccion,
        ciudad: point.ciudad,
        provincia: point.provincia,
        codigo_postal: point.codigo_postal || "",
        telefono: point.telefono || "",
        servientrega_agencia_codigo: point.servientrega_agencia_codigo || "",
        servientrega_agencia_nombre: point.servientrega_agencia_nombre || "",
      });
    }
  }, [point, isOpen]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
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
        description: `Punto ${updated.nombre} actualizado correctamente`,
      });
      onPointUpdated();
      onClose();
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
          {["nombre", "direccion", "ciudad", "provincia"].map((field) => (
            <div key={field} className="space-y-2">
              <Label className="capitalize">{field} *</Label>
              <Input
                name={field}
                value={formData[field as keyof typeof formData]}
                onChange={handleChange}
                disabled={loading}
              />
            </div>
          ))}
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
            disabled={loading}
          />
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
