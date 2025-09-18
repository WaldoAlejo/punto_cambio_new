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

interface Props {
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
}: Props) => {
  const [formData, setFormData] = useState({
    codigo: currency.codigo,
    nombre: currency.nombre,
    simbolo: currency.simbolo,
    orden_display: currency.orden_display,
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (currency) {
      setFormData({
        codigo: currency.codigo,
        nombre: currency.nombre,
        simbolo: currency.simbolo,
        orden_display: currency.orden_display,
      });
    }
  }, [currency]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]:
        e.target.name === "orden_display"
          ? parseInt(e.target.value) || 0
          : e.target.value,
    }));
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
      onCurrencyUpdated();
      onClose();
    } catch {
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
      <DialogContent className="max-w-lg w-full">
        <DialogHeader>
          <DialogTitle>Editar Moneda</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label htmlFor="codigo">Código (3 letras)</Label>
              <Input
                id="codigo"
                name="codigo"
                value={formData.codigo}
                onChange={handleChange}
                maxLength={3}
                disabled={loading}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="simbolo">Símbolo</Label>
              <Input
                id="simbolo"
                name="simbolo"
                value={formData.simbolo}
                onChange={handleChange}
                maxLength={5}
                disabled={loading}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="orden_display">Orden</Label>
              <Input
                id="orden_display"
                name="orden_display"
                type="number"
                value={formData.orden_display}
                onChange={handleChange}
                min={0}
                disabled={loading}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="nombre">Nombre Completo</Label>
            <Input
              id="nombre"
              name="nombre"
              value={formData.nombre}
              onChange={handleChange}
              disabled={loading}
            />
          </div>
          <DialogFooter className="mt-4 flex flex-wrap gap-2 justify-end">
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
