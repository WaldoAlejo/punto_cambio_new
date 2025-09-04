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

const CurrencyBehaviorPage = () => {
  const navigate = useNavigate();
  const [currencies, setCurrencies] = useState<Moneda[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchCurrencies = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/currencies", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (!response.ok) {
        throw new Error("Error al cargar las monedas");
      }

      const data = await response.json();
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
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="h-8 w-8 animate-spin" />
          <span className="ml-2">Cargando configuración de divisas...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
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
            <h1 className="text-2xl font-bold">
              Configuración de Comportamientos de Divisas
            </h1>
            <p className="text-muted-foreground">
              Configure cómo se calculan los montos para cada divisa en
              operaciones de compra y venta
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={handleRefresh}
          className="flex items-center gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Actualizar
        </Button>
      </div>

      {/* Información explicativa */}
      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-blue-800">
            ¿Cómo funcionan los comportamientos?
          </CardTitle>
          <CardDescription className="text-blue-700">
            Cada divisa puede tener diferentes comportamientos para compra y
            venta:
          </CardDescription>
        </CardHeader>
        <CardContent className="text-blue-700">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold mb-2">🔢 MULTIPLICA</h4>
              <p className="text-sm">
                El monto se <strong>multiplica</strong> por la tasa de cambio.
                <br />
                <code>Resultado = Monto × Tasa</code>
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">➗ DIVIDE</h4>
              <p className="text-sm">
                El monto se <strong>divide</strong> por la tasa de cambio.
                <br />
                <code>Resultado = Monto ÷ Tasa</code>
              </p>
            </div>
          </div>
          <div className="mt-4 p-3 bg-blue-100 rounded-lg">
            <h4 className="font-semibold mb-2">📋 Ejemplos configurados:</h4>
            <ul className="text-sm space-y-1">
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
  );
};

export default CurrencyBehaviorPage;
