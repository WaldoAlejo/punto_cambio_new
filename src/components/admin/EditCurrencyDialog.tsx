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
import { Moneda } from "../../types";
import { currencyService } from "../../services/currencyService";
import { toast } from "@/hooks/use-toast";

interface EditCurrencyDialogProps {
  currency: Moneda;
  isOpen: boolean;
  onClose: () => void;
  onCurrencyUpdated: () => void;
}

const EditCurrencyDialog = ({
  currency,
  isOpen,
  onClose,
  onCurrencyUpdated,
}: EditCurrencyDialogProps) => {
  const [formData, setFormData] = useState({
    codigo: currency.codigo,
    nombre: currency.nombre,
    simbolo: currency.simbolo,
    orden_display: currency.orden_display,
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setFormData({
      codigo: currency.codigo,
      nombre: currency.nombre,
      simbolo: currency.simbolo,
      orden_display: currency.orden_display,
    });
  }, [currency]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]:
        e.target.name === "orden_display"
          ? parseInt(e.target.value) || 0
          : e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    if (!formData.codigo || !formData.nombre || !formData.simbolo) {
      toast({
        title: "Error",
        description: "Todos los campos son obligatorios",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }
    try {
      const { currency: updated, error } = await currencyService.updateCurrency(
        currency.id,
        formData
      );
      if (!updated || error)
        throw new Error(error || "Error al actualizar moneda");
      toast({
        title: "Moneda actualizada",
        description: `Moneda ${updated.nombre} actualizada correctamente`,
      });
      onClose();
      onCurrencyUpdated();
    } catch (err) {
      toast({
        title: "Error",
        description: "No se pudo actualizar la moneda",
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
          <DialogTitle>Editar Moneda</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Código (3 letras)</Label>
              <Input
                name="codigo"
                value={formData.codigo}
                onChange={handleChange}
                maxLength={3}
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label>Símbolo</Label>
              <Input
                name="simbolo"
                value={formData.simbolo}
                onChange={handleChange}
                maxLength={5}
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label>Orden</Label>
              <Input
                name="orden_display"
                type="number"
                value={formData.orden_display}
                onChange={handleChange}
                min={0}
                disabled={loading}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Nombre Completo</Label>
            <Input
              name="nombre"
              value={formData.nombre}
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

export default EditCurrencyDialog;
