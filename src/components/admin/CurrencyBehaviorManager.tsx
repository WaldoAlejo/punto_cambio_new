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

interface CurrencyBehaviorManagerProps {
  currencies: Moneda[];
  onUpdate?: () => void;
}

const CurrencyBehaviorManager = ({
  currencies,
  onUpdate,
}: CurrencyBehaviorManagerProps) => {
  const [editingCurrencies, setEditingCurrencies] = useState<
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
    // Inicializar el estado con los valores actuales
    const initialState: Record<
      string,
      {
        comportamiento_compra: "MULTIPLICA" | "DIVIDE";
        comportamiento_venta: "MULTIPLICA" | "DIVIDE";
      }
    > = {};

    currencies.forEach((currency) => {
      initialState[currency.id] = {
        comportamiento_compra: currency.comportamiento_compra,
        comportamiento_venta: currency.comportamiento_venta,
      };
    });

    setEditingCurrencies(initialState);
  }, [currencies]);

  const handleBehaviorChange = (
    currencyId: string,
    type: "compra" | "venta",
    value: "MULTIPLICA" | "DIVIDE"
  ) => {
    setEditingCurrencies((prev) => ({
      ...prev,
      [currencyId]: {
        ...prev[currencyId],
        [`comportamiento_${type}`]: value,
      },
    }));
  };

  const hasChanges = (currencyId: string) => {
    const currency = currencies.find((c) => c.id === currencyId);
    const editing = editingCurrencies[currencyId];

    if (!currency || !editing) return false;

    return (
      currency.comportamiento_compra !== editing.comportamiento_compra ||
      currency.comportamiento_venta !== editing.comportamiento_venta
    );
  };

  const saveChanges = async (currencyId: string) => {
    const editing = editingCurrencies[currencyId];
    if (!editing) return;

    setIsLoading(true);
    try {
      const res = await apiService.patch<{
        currency: Moneda;
        success: boolean;
        error?: string;
      }>(`/currencies/${currencyId}/behavior`, editing);

      if (!res || res.success === false) {
        throw new Error(res?.error || "Error al actualizar comportamiento");
      }

      toast.success("Comportamiento actualizado correctamente");
      onUpdate?.();
    } catch (error) {
      toast.error("Error al actualizar comportamiento");
      console.error("Error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const resetChanges = (currencyId: string) => {
    const currency = currencies.find((c) => c.id === currencyId);
    if (!currency) return;

    setEditingCurrencies((prev) => ({
      ...prev,
      [currencyId]: {
        comportamiento_compra: currency.comportamiento_compra,
        comportamiento_venta: currency.comportamiento_venta,
      },
    }));
  };

  const getBehaviorColor = (behavior: "MULTIPLICA" | "DIVIDE") => {
    return behavior === "MULTIPLICA"
      ? "bg-green-100 text-green-800"
      : "bg-blue-100 text-blue-800";
  };

  return (
    <Card className="flex-shrink-0">
      <CardHeader className="p-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Settings className="h-4 w-4" />
          Configuración de Comportamientos de Divisas
        </CardTitle>
        <CardDescription className="text-xs">
          Configure cómo se calculan los montos para cada divisa en operaciones
          de compra y venta.
          <br />
          <strong>MULTIPLICA:</strong> Monto × Tasa | <strong>DIVIDE:</strong>{" "}
          Monto ÷ Tasa
        </CardDescription>
      </CardHeader>
      <CardContent className="p-3">
        <div className="space-y-3">
          {currencies.map((currency) => {
            const editing = editingCurrencies[currency.id];
            const changed = hasChanges(currency.id);

            if (!editing) return null;

            return (
              <div
                key={currency.id}
                className="border rounded-lg p-3 space-y-2"
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <h3 className="font-medium text-sm">
                      {currency.codigo} - {currency.nombre}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      {obtenerDescripcionComportamiento(currency)}
                    </p>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Badge
                      className={`text-xs ${getBehaviorColor(
                        currency.comportamiento_compra
                      )}`}
                    >
                      Compra: {currency.comportamiento_compra}
                    </Badge>
                    <Badge
                      className={`text-xs ${getBehaviorColor(
                        currency.comportamiento_venta
                      )}`}
                    >
                      Venta: {currency.comportamiento_venta}
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium">
                      Comportamiento en COMPRA
                    </label>
                    <Select
                      value={editing.comportamiento_compra}
                      onValueChange={(value: "MULTIPLICA" | "DIVIDE") =>
                        handleBehaviorChange(currency.id, "compra", value)
                      }
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MULTIPLICA" className="text-xs">
                          MULTIPLICA (Monto × Tasa)
                        </SelectItem>
                        <SelectItem value="DIVIDE" className="text-xs">
                          DIVIDE (Monto ÷ Tasa)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-medium">
                      Comportamiento en VENTA
                    </label>
                    <Select
                      value={editing.comportamiento_venta}
                      onValueChange={(value: "MULTIPLICA" | "DIVIDE") =>
                        handleBehaviorChange(currency.id, "venta", value)
                      }
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="MULTIPLICA" className="text-xs">
                          MULTIPLICA (Monto × Tasa)
                        </SelectItem>
                        <SelectItem value="DIVIDE" className="text-xs">
                          DIVIDE (Monto ÷ Tasa)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {changed && (
                  <div className="flex gap-2 pt-1">
                    <Button
                      size="sm"
                      onClick={() => saveChanges(currency.id)}
                      disabled={isLoading}
                      className="flex items-center gap-1 h-7 text-xs"
                    >
                      <Save className="h-3 w-3" />
                      Guardar Cambios
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => resetChanges(currency.id)}
                      disabled={isLoading}
                      className="flex items-center gap-1 h-7 text-xs"
                    >
                      <RefreshCw className="h-3 w-3" />
                      Descartar
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default CurrencyBehaviorManager;
