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
import { toast } from "@/hooks/use-toast";
import { User, PuntoAtencion, Moneda, CuadreCaja } from "../../types";

interface DailyCloseProps {
  user: User;
  selectedPoint: PuntoAtencion | null;
}

const DailyClose = ({ user, selectedPoint }: DailyCloseProps) => {
  const [currencies, setCurrencies] = useState<Moneda[]>([]);
  const [balances, setBalances] = useState<{
    [key: string]: { bills: string; coins: string };
  }>({});
  const [todayClose, setTodayClose] = useState<CuadreCaja | null>(null);

  useEffect(() => {
    const fetchCurrencies = async () => {
      try {
        const response = await fetch("/api/currencies");
        const data = await response.json();
        if (data.success && Array.isArray(data.currencies)) {
          setCurrencies(data.currencies);

          const initialBalances: {
            [key: string]: { bills: string; coins: string };
          } = {};
          data.currencies.forEach((currency: Moneda) => {
            initialBalances[currency.id] = { bills: "", coins: "" };
          });
          setBalances(initialBalances);
        } else {
          throw new Error("Respuesta inesperada del servidor");
        }
      } catch (error) {
        console.error("Error al obtener monedas:", error);
        toast({
          title: "Error",
          description: "No se pudo cargar la lista de monedas.",
          variant: "destructive",
        });
      }
    };

    if (selectedPoint) {
      fetchCurrencies();
      setTodayClose(null);
    }
  }, [selectedPoint]);

  const handleBalanceChange = (
    currencyId: string,
    type: "bills" | "coins",
    value: string
  ) => {
    setBalances((prev) => ({
      ...prev,
      [currencyId]: {
        ...prev[currencyId],
        [type]: value,
      },
    }));
  };

  const calculateTotalBalance = (currencyId: string) => {
    const bills = parseFloat(balances[currencyId]?.bills || "0");
    const coins = parseFloat(balances[currencyId]?.coins || "0");
    return bills + coins;
  };

  const performDailyClose = async () => {
    if (!selectedPoint) {
      toast({
        title: "Error",
        description: "Debe seleccionar un punto de atención",
        variant: "destructive",
      });
      return;
    }

    const incompleteBalances = currencies.some(
      (currency) =>
        !balances[currency.id]?.bills || !balances[currency.id]?.coins
    );

    if (incompleteBalances) {
      toast({
        title: "Error",
        description: "Debe completar todos los saldos antes del cierre",
        variant: "destructive",
      });
      return;
    }

    // Preparar detalles del cuadre
    const detalles = currencies.map((currency) => ({
      moneda_id: currency.id,
      conteo_fisico: calculateTotalBalance(currency.id),
      billetes: parseInt(balances[currency.id]?.bills || "0"),
      monedas: parseInt(balances[currency.id]?.coins || "0"),
      saldo_apertura: 0, // Se calculará en el backend
      saldo_cierre: 0, // Se calculará en el backend
    }));

    try {
      const token = localStorage.getItem("token");
      const res = await fetch("/api/cuadre-caja", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          detalles,
          observaciones: ""
        }),
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || "Error inesperado");
      }

      setTodayClose(data.cuadre);

      toast({
        title: "Cierre realizado",
        description: "El cierre diario se ha guardado correctamente",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "No se pudo guardar el cierre",
        variant: "destructive",
      });
    }
  };

  const generateCloseReport = () => {
    if (!todayClose) return;

    toast({
      title: "Reporte generado",
      description: "El reporte de cierre diario se ha generado",
    });
  };

  if (!selectedPoint) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">
            Debe seleccionar un punto de atención para realizar el cierre
          </p>
        </div>
      </div>
    );
  }

  if (user.rol !== "OPERADOR") {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-red-500 text-lg">
            Solo operadores pueden realizar cierres diarios
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Cierre Diario</h1>
        <div className="text-sm text-gray-500">
          Punto: {selectedPoint.nombre} - {new Date().toLocaleDateString()}
        </div>
      </div>

      {!todayClose ? (
        <Card>
          <CardHeader>
            <CardTitle>Cuadre de Caja</CardTitle>
            <CardDescription>
              Ingrese los saldos de billetes y monedas por cada divisa
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {currencies.map((currency) => (
                <div key={currency.id} className="border rounded-lg p-4">
                  <h3 className="font-semibold text-lg mb-4">
                    {currency.codigo} - {currency.nombre}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Billetes</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={balances[currency.id]?.bills || ""}
                        onChange={(e) =>
                          handleBalanceChange(
                            currency.id,
                            "bills",
                            e.target.value
                          )
                        }
                        placeholder="0.00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Monedas</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={balances[currency.id]?.coins || ""}
                        onChange={(e) =>
                          handleBalanceChange(
                            currency.id,
                            "coins",
                            e.target.value
                          )
                        }
                        placeholder="0.00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Total</Label>
                      <div className="h-10 px-3 py-2 border rounded-md bg-gray-50 flex items-center">
                        {calculateTotalBalance(currency.id).toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              <Button
                onClick={performDailyClose}
                className="w-full bg-green-600 hover:bg-green-700 text-white py-3"
                size="lg"
              >
                Realizar Cierre Diario
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Cierre Completado</CardTitle>
            <CardDescription>
              Cierre diario realizado el{" "}
              {todayClose.fecha_cierre &&
                new Date(todayClose.fecha_cierre).toLocaleString()}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-blue-700">Total Cambios</h4>
                  <p className="text-2xl font-bold text-blue-600">
                    {todayClose.total_cambios}
                  </p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-green-700">
                    Transferencias Entrada
                  </h4>
                  <p className="text-2xl font-bold text-green-600">
                    {todayClose.total_transferencias_entrada}
                  </p>
                </div>
                <div className="bg-orange-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-orange-700">
                    Transferencias Salida
                  </h4>
                  <p className="text-2xl font-bold text-orange-600">
                    {todayClose.total_transferencias_salida}
                  </p>
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={generateCloseReport}
                  variant="outline"
                  className="border-blue-600 text-blue-600 hover:bg-blue-50"
                >
                  Generar Reporte
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default DailyClose;
