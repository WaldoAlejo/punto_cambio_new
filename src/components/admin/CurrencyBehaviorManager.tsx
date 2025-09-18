import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Moneda } from "../../types";
import { obtenerDescripcionComportamiento } from "../../utils/currencyCalculations";
import { Settings, Save, RefreshCw } from "lucide-react";
import { apiService } from "@/services/apiService";

interface Props {
  currencies: Moneda[];
  onUpdate?: () => void;
}

const CurrencyBehaviorManager = ({ currencies, onUpdate }: Props) => {
  const [editing, setEditing] = useState<
    Record<
      string,
      {
        comportamiento_compra: "MULTIPLICA" | "DIVIDE";
        comportamiento_venta: "MULTIPLICA" | "DIVIDE";
      }
    >
  >({});
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const initial: Record<
      string,
      {
        comportamiento_compra: "MULTIPLICA" | "DIVIDE";
        comportamiento_venta: "MULTIPLICA" | "DIVIDE";
      }
    > = {};
    currencies.forEach((c) => {
      initial[c.id] = {
        comportamiento_compra: c.comportamiento_compra,
        comportamiento_venta: c.comportamiento_venta,
      };
    });
    setEditing(initial);
  }, [currencies]);

  const handleChange = (
    id: string,
    type: "compra" | "venta",
    value: "MULTIPLICA" | "DIVIDE"
  ) => {
    setEditing((prev) => ({
      ...prev,
      [id]: { ...prev[id], [`comportamiento_${type}`]: value },
    }));
  };

  const hasChanges = (id: string) => {
    const original = currencies.find((c) => c.id === id);
    const current = editing[id];
    if (!original || !current) return false;
    return (
      original.comportamiento_compra !== current.comportamiento_compra ||
      original.comportamiento_venta !== current.comportamiento_venta
    );
  };

  const saveChanges = async (id: string) => {
    if (!editing[id]) return;
    setIsLoading(true);
    try {
      const res = await apiService.patch<{
        currency: Moneda;
        success: boolean;
        error?: string;
      }>(`/currencies/${id}/behavior`, editing[id]);
      if (!res || res.success === false)
        throw new Error(res?.error || "Error al actualizar comportamiento");
      toast.success("Comportamiento actualizado correctamente");
      onUpdate?.();
    } catch (err) {
      toast.error("Error al actualizar comportamiento");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const resetChanges = (id: string) => {
    const original = currencies.find((c) => c.id === id);
    if (!original) return;
    setEditing((prev) => ({
      ...prev,
      [id]: {
        comportamiento_compra: original.comportamiento_compra,
        comportamiento_venta: original.comportamiento_venta,
      },
    }));
  };

  const getColor = (behavior: "MULTIPLICA" | "DIVIDE") =>
    behavior === "MULTIPLICA"
      ? "bg-green-100 text-green-800"
      : "bg-blue-100 text-blue-800";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
          <Settings className="h-5 w-5" /> Configuración de Comportamientos
        </CardTitle>
        <CardDescription className="text-sm sm:text-base">
          Defina cómo se calculan los montos de compra y venta.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {currencies.map((c) => {
          const current = editing[c.id];
          if (!current) return null;
          const changed = hasChanges(c.id);

          return (
            <div
              key={c.id}
              className="border rounded-lg p-4 space-y-3 shadow-sm bg-white"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <h3 className="font-medium text-base sm:text-lg">
                    {c.codigo} - {c.nombre}
                  </h3>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    {obtenerDescripcionComportamiento(c)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge className={getColor(c.comportamiento_compra)}>
                    Compra: {c.comportamiento_compra}
                  </Badge>
                  <Badge className={getColor(c.comportamiento_venta)}>
                    Venta: {c.comportamiento_venta}
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm font-medium">
                    Comportamiento COMPRA
                  </label>
                  <Select
                    value={current.comportamiento_compra}
                    onValueChange={(v: "MULTIPLICA" | "DIVIDE") =>
                      handleChange(c.id, "compra", v)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MULTIPLICA">
                        MULTIPLICA (Monto × Tasa)
                      </SelectItem>
                      <SelectItem value="DIVIDE">
                        DIVIDE (Monto ÷ Tasa)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium">
                    Comportamiento VENTA
                  </label>
                  <Select
                    value={current.comportamiento_venta}
                    onValueChange={(v: "MULTIPLICA" | "DIVIDE") =>
                      handleChange(c.id, "venta", v)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MULTIPLICA">
                        MULTIPLICA (Monto × Tasa)
                      </SelectItem>
                      <SelectItem value="DIVIDE">
                        DIVIDE (Monto ÷ Tasa)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {changed && (
                <div className="flex flex-wrap gap-2 pt-2">
                  <Button
                    size="sm"
                    onClick={() => saveChanges(c.id)}
                    disabled={isLoading}
                    className="flex items-center gap-1"
                  >
                    <Save className="h-4 w-4" /> Guardar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => resetChanges(c.id)}
                    disabled={isLoading}
                    className="flex items-center gap-1"
                  >
                    <RefreshCw className="h-4 w-4" /> Descartar
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default CurrencyBehaviorManager;
