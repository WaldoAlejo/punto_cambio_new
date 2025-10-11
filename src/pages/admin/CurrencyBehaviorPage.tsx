import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import CurrencyBehaviorManager from "../../components/admin/CurrencyBehaviorManager";
import { Moneda } from "../../types";
import { apiService } from "@/services/apiService";

const CurrencyBehaviorPage = () => {
  const navigate = useNavigate();
  const [currencies, setCurrencies] = useState<Moneda[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchCurrencies = async () => {
    try {
      setIsLoading(true);

      const data = await apiService.get<{
        currencies: Moneda[];
        success: boolean;
        error?: string;
      }>("/currencies");

      if (!data || data.error || data.success === false) {
        throw new Error(data?.error || "Error al cargar las monedas");
      }

      setCurrencies(data.currencies || []);
    } catch (error) {
      console.error("Error fetching currencies:", error);
      toast.error("Error al cargar las monedas");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrencies();
  }, []);

  const handleRefresh = () => {
    fetchCurrencies();
    toast.success("Datos actualizados");
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex items-center gap-2">
          <RefreshCw className="h-8 w-8 animate-spin" />
          <span className="ml-2">Cargando configuración de divisas...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col gap-4">
      {/* Header - Siempre visible */}
      <div className="flex-shrink-0 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/admin")}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver
          </Button>
          <div>
            <h1 className="text-lg font-bold">
              Configuración de Comportamientos de Divisas
            </h1>
            <p className="text-xs text-muted-foreground">
              Configure cómo se calculan los montos para cada divisa en
              operaciones de compra y venta
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          className="flex items-center gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Actualizar
        </Button>
      </div>

      {/* Contenido scrolleable */}
      <div className="flex-1 min-h-0 overflow-y-auto space-y-4">
        {/* Información explicativa */}
        <Card className="flex-shrink-0 bg-blue-50 border-blue-200">
          <CardHeader className="p-3">
            <CardTitle className="text-sm text-blue-800">
              ¿Cómo funcionan los comportamientos?
            </CardTitle>
            <CardDescription className="text-xs text-blue-700">
              Cada divisa puede tener diferentes comportamientos para compra y
              venta:
            </CardDescription>
          </CardHeader>
          <CardContent className="p-3 text-blue-700">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <h4 className="font-semibold text-sm mb-1">🔢 MULTIPLICA</h4>
                <p className="text-xs">
                  El monto se <strong>multiplica</strong> por la tasa de cambio.
                  <br />
                  <code className="text-xs">Resultado = Monto × Tasa</code>
                </p>
              </div>
              <div>
                <h4 className="font-semibold text-sm mb-1">➗ DIVIDE</h4>
                <p className="text-xs">
                  El monto se <strong>divide</strong> por la tasa de cambio.
                  <br />
                  <code className="text-xs">Resultado = Monto ÷ Tasa</code>
                </p>
              </div>
            </div>
            <div className="mt-3 p-2 bg-blue-100 rounded-lg">
              <h4 className="font-semibold text-sm mb-1">
                📋 Ejemplos configurados:
              </h4>
              <ul className="text-xs space-y-1">
                <li>
                  <strong>Euro (EUR):</strong> Compra multiplica, Venta divide
                </li>
                <li>
                  <strong>Peso Argentino (ARS):</strong> Compra divide, Venta
                  multiplica
                </li>
                <li>
                  <strong>Dólar Australiano (AUD):</strong> Compra multiplica,
                  Venta divide
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Gestor de comportamientos */}
        <CurrencyBehaviorManager
          currencies={currencies}
          onUpdate={fetchCurrencies}
        />
      </div>
    </div>
  );
};

export default CurrencyBehaviorPage;
