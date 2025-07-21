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
  const [hasActiveJornada, setHasActiveJornada] = useState<boolean | null>(null);

  // Verificar jornada activa
  useEffect(() => {
    const checkActiveJornada = async () => {
      try {
        const token = localStorage.getItem("authToken");
        console.log("🔍 DailyClose - localStorage keys:", Object.keys(localStorage));
        console.log("🔍 DailyClose - token check:", {
          tokenExists: !!token,
          tokenPreview: token ? token.substring(0, 30) + "..." : "No token",
          userInfo: { id: user.id, rol: user.rol, nombre: user.nombre }
        });
        
        if (!token) {
          console.log("❌ No token found for jornada check");
          setHasActiveJornada(false);
          return;
        }

        console.log("🔍 Checking active jornada for user:", user.rol);
        const response = await fetch("/api/schedules/active", {
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
          }
        });
        
        console.log("🕒 Active jornada response status:", response.status);
        
        if (response.ok) {
          const data = await response.json();
          console.log("🕒 Active jornada response data:", data);
          
          // Verificar que tenga schedule y que esté ACTIVO
          const hasJornada = data.success && data.schedule && 
                           (data.schedule.estado === 'ACTIVO' || data.schedule.estado === 'ALMUERZO');
          console.log("🕒 Has active jornada:", hasJornada);
          setHasActiveJornada(hasJornada);
        } else {
          console.log("❌ No active jornada or error:", response.status);
          setHasActiveJornada(false);
        }
      } catch (error) {
        console.error("💥 Error checking active jornada:", error);
        setHasActiveJornada(false);
      }
    };

    if (user.rol === "OPERADOR") {
      checkActiveJornada();
      
      // Recheck jornada every 30 seconds when mounted
      const interval = setInterval(checkActiveJornada, 30000);
      return () => clearInterval(interval);
    } else {
      setHasActiveJornada(true); // Los admin siempre pueden
    }
  }, [user]);

  useEffect(() => {
    const fetchCurrencies = async () => {
      try {
        console.log("🔄 Fetching currencies and balances...");
        
        const token = localStorage.getItem("authToken");
        console.log("🔍 DailyClose fetchCurrencies - token check:", {
          tokenExists: !!token,
          tokenPreview: token ? token.substring(0, 30) + "..." : "No token",
          selectedPoint: selectedPoint ? selectedPoint.id : "No point"
        });
        
        if (!token) {
          toast({
            title: "Sesión Expirada",
            description: "Por favor, inicie sesión nuevamente.",
            variant: "destructive",
          });
          return;
        }
        
        const authHeaders = {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        };
        
        // Primero obtener las monedas y luego filtrar por las que tienen saldo
        const [currenciesResponse, balancesResponse] = await Promise.all([
          fetch("/api/currencies", { headers: authHeaders }),
          fetch("/api/vista-saldos-puntos", { headers: authHeaders })
        ]);
        
        const currenciesData = await currenciesResponse.json();
        const balancesData = await balancesResponse.json();
        
        console.log("💰 Currencies response:", currenciesData);
        console.log("💰 Balances response:", balancesData);
        
        if (currenciesData.success && Array.isArray(currenciesData.currencies) && 
            balancesData.success && Array.isArray(balancesData.saldos)) {
          
          // Filtrar solo las monedas que tienen saldo inicial > 0 en este punto
          const pointBalances = balancesData.saldos.filter(s => 
            s.punto_atencion_id === selectedPoint?.id && 
            Number(s.saldo_inicial) > 0
          );
          
          const activeCurrencyIds = pointBalances.map(b => b.moneda_id);
          const filteredCurrencies = currenciesData.currencies.filter(c => 
            activeCurrencyIds.includes(c.id)
          );
          
          console.log("🎯 Filtered currencies with balance:", filteredCurrencies);
          setCurrencies(filteredCurrencies);

          const initialBalances: {
            [key: string]: { bills: string; coins: string };
          } = {};
          filteredCurrencies.forEach((currency: Moneda) => {
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
          description: "No se pudo cargar la lista de monedas con saldo.",
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
    console.log("🔄 performDailyClose START");
    if (!selectedPoint) {
      console.log("❌ No selectedPoint");
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
      console.log("❌ Incomplete balances:", balances);
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
    
    console.log("📊 Detalles prepared:", detalles);

    try {
      const token = localStorage.getItem("authToken");
      console.log("🔑 Token exists:", !!token);
      console.log("🔑 Token preview:", token ? token.substring(0, 50) + "..." : "No token");
      console.log("👤 Current user:", user);
      console.log("📍 Selected point:", selectedPoint);
      
      if (!token) {
        toast({
          title: "Sesión Expirada",
          description: "Su sesión ha expirado. Por favor, inicie sesión nuevamente.",
          variant: "destructive",
        });
        // Redirigir al login después de 2 segundos
        setTimeout(() => {
          window.location.href = "/login";
        }, 2000);
        return;
      }
      
      const requestBody = {
        detalles,
        observaciones: ""
      };
      console.log("📡 Request body:", requestBody);
      console.log("📡 Making request to:", "/api/cuadre-caja");
      
      const res = await fetch("/api/cuadre-caja", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(requestBody),
      });
      
      console.log("📥 Response status:", res.status);
      console.log("📥 Response headers:", Object.fromEntries(res.headers.entries()));

      const data = await res.json();
      console.log("📄 Response data:", data);

      if (!data.success) {
        throw new Error(data.error || "Error inesperado");
      }

      setTodayClose(data.cuadre);

      toast({
        title: "Cierre realizado",
        description: "El cierre diario se ha guardado correctamente",
      });
    } catch (error) {
      console.error("💥 Error in performDailyClose:", error);
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

  if (hasActiveJornada === false) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-red-500 text-lg">
            Debe tener una jornada activa para realizar el cierre diario
          </p>
          <p className="text-gray-500 text-sm mt-2">
            Inicie su jornada desde "Gestión de Horarios" para continuar
          </p>
        </div>
      </div>
    );
  }

  if (hasActiveJornada === null) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Verificando jornada activa...</p>
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
                onClick={() => {
                  console.log("🖱️ Button clicked - performDailyClose");
                  performDailyClose();
                }}
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
