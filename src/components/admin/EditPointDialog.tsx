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
import { PuntoAtencion } from "../../types";
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
    servientrega_alianza: point.servientrega_alianza || "",
    servientrega_oficina_alianza: point.servientrega_oficina_alianza || "",
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
        servientrega_alianza: point.servientrega_alianza || "",
        servientrega_oficina_alianza: point.servientrega_oficina_alianza || "",
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
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Editar Punto de Atención</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-2">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Información básica en grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nombre *</Label>
                <Input
                  name="nombre"
                  value={formData.nombre}
                  onChange={handleChange}
                  disabled={loading}
                  placeholder="Nombre del punto de atención"
                />
              </div>
              <div className="space-y-2">
                <Label>Ciudad *</Label>
                <Input
                  name="ciudad"
                  value={formData.ciudad}
                  onChange={handleChange}
                  disabled={loading}
                  placeholder="Ciudad"
                />
              </div>
            </div>

            {/* Dirección completa */}
            <div className="space-y-2">
              <Label>Dirección *</Label>
              <Input
                name="direccion"
                value={formData.direccion}
                onChange={handleChange}
                disabled={loading}
                placeholder="Dirección completa"
              />
            </div>

            {/* Provincia, código postal y teléfono */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Provincia *</Label>
                <Input
                  name="provincia"
                  value={formData.provincia}
                  onChange={handleChange}
                  disabled={loading}
                  placeholder="Provincia"
                />
              </div>
              <div className="space-y-2">
                <Label>Código Postal</Label>
                <Input
                  name="codigo_postal"
                  value={formData.codigo_postal}
                  onChange={handleChange}
                  disabled={loading}
                  placeholder="Código postal"
                />
              </div>
              <div className="space-y-2">
                <Label>Teléfono</Label>
                <Input
                  name="telefono"
                  value={formData.telefono}
                  onChange={handleChange}
                  disabled={loading}
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
                    servientrega_alianza: agencia?.agencia || "",
                    servientrega_oficina_alianza:
                      agencia?.codigo_establecimiento || "",
                  });
                }}
                placeholder="Seleccionar agencia de Servientrega..."
                disabled={loading}
              />
            </div>
          </form>
        </div>

        {/* Footer fijo */}
        <DialogFooter className="flex-shrink-0 mt-4 pt-4 border-t bg-white">
          <div className="flex gap-2 justify-end w-full">
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
              onClick={handleSubmit}
              className="bg-blue-600 hover:bg-blue-700"
              disabled={loading}
            >
              {loading ? "Guardando..." : "Guardar Cambios"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default EditPointDialog;
