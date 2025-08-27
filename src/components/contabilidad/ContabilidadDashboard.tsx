import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Calculator,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  DollarSign,
  BarChart3,
} from "lucide-react";
import { User, PuntoAtencion, Moneda } from "@/types";
import { useContabilidadDivisas } from "@/hooks/useContabilidadDivisas";
import { currencyService } from "@/services/currencyService";
import SaldosDivisasEnTiempoReal from "./SaldosDivisasEnTiempoReal";
import HistorialMovimientos from "./HistorialMovimientos";

interface ContabilidadDashboardProps {
  user: User;
  selectedPoint: PuntoAtencion | null;
  currencies?: Moneda[];
}

export const ContabilidadDashboard = ({
  user,
  selectedPoint,
  currencies: propCurrencies,
}: ContabilidadDashboardProps) => {
  const { saldos, movimientos, isLoading, error, refresh } =
    useContabilidadDivisas({ user, selectedPoint });

  const [currencies, setCurrencies] = useState<Moneda[]>(propCurrencies || []);
  const [loadingCurrencies, setLoadingCurrencies] = useState(!propCurrencies);

  const [estadisticas, setEstadisticas] = useState({
    totalIngresos: 0,
    totalEgresos: 0,
    totalCambios: 0,
    saldoPositivo: 0,
    saldoNegativo: 0,
    monedaPrincipalSaldo: 0,
  });

  // Cargar monedas si no se proporcionaron
  useEffect(() => {
    const loadCurrencies = async () => {
      if (propCurrencies) {
        setCurrencies(propCurrencies);
        setLoadingCurrencies(false);
        return;
      }

      try {
        setLoadingCurrencies(true);
        const { currencies: fetchedCurrencies, error: currencyError } =
          await currencyService.getAllCurrencies();

        if (currencyError) {
          console.error("Error al cargar monedas:", currencyError);
        } else {
          setCurrencies(fetchedCurrencies);
        }
      } catch (err) {
        console.error("Error inesperado al cargar monedas:", err);
      } finally {
        setLoadingCurrencies(false);
      }
    };

    loadCurrencies();
  }, [propCurrencies]);

  // Calcular estadísticas
  useEffect(() => {
    if (movimientos.length > 0 && saldos.length > 0) {
      const hoy = new Date();
      const inicioHoy = new Date(
        hoy.getFullYear(),
        hoy.getMonth(),
        hoy.getDate()
      );

      const movimientosHoy = movimientos.filter(
        (mov) => new Date(mov.fecha) >= inicioHoy
      );

      const ingresos = movimientosHoy
        .filter(
          (mov) =>
            mov.tipo_movimiento === "INGRESO" ||
            mov.tipo_movimiento === "TRANSFERENCIA_ENTRANTE"
        )
        .reduce((sum, mov) => sum + mov.monto, 0);

      const egresos = movimientosHoy
        .filter(
          (mov) =>
            mov.tipo_movimiento === "EGRESO" ||
            mov.tipo_movimiento === "TRANSFERENCIA_SALIENTE"
        )
        .reduce((sum, mov) => sum + mov.monto, 0);

      const cambios = movimientosHoy.filter(
        (mov) => mov.tipo_movimiento === "CAMBIO_DIVISA"
      ).length;

      const saldosPositivos = saldos.filter((s) => s.saldo > 0).length;
      const saldosNegativos = saldos.filter((s) => s.saldo < 0).length;

      const usdSaldo =
        saldos.find((s) => s.moneda_codigo === "USD")?.saldo || 0;

      setEstadisticas({
        totalIngresos: ingresos,
        totalEgresos: egresos,
        totalCambios: cambios,
        saldoPositivo: saldosPositivos,
        saldoNegativo: saldosNegativos,
        monedaPrincipalSaldo: usdSaldo,
      });
    }
  }, [movimientos, saldos]);

  // Escuchar eventos de actualización de saldos
  useEffect(() => {
    const handleSaldosUpdated = () => {
      refresh();
    };

    window.addEventListener("saldosUpdated", handleSaldosUpdated);
    window.addEventListener("exchangeCompleted", handleSaldosUpdated);

    return () => {
      window.removeEventListener("saldosUpdated", handleSaldosUpdated);
      window.removeEventListener("exchangeCompleted", handleSaldosUpdated);
    };
  }, [refresh]);

  const formatCurrency = (amount: number, codigo = "USD") => {
    if (codigo === "USD") {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
      }).format(amount);
    }

    return new Intl.NumberFormat("es-ES", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  if (!selectedPoint) {
    return (
      <div className="p-6 text-center py-12">
        <Calculator className="h-16 w-16 mx-auto mb-4 text-gray-400" />
        <h2 className="text-xl font-semibold text-gray-600 mb-2">
          Sistema Contable de Divisas
        </h2>
        <p className="text-gray-500">
          Seleccione un punto de atención para ver la información contable
        </p>
      </div>
    );
  }

  if (loadingCurrencies) {
    return (
      <div className="p-6 text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Cargando información contable...</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Calculator className="h-6 w-6 text-blue-600" />
            Contabilidad de Divisas
          </h1>
          <p className="text-gray-600 mt-1">
            Control contable automático para {selectedPoint.nombre}
          </p>
        </div>
        <Button onClick={refresh} disabled={isLoading} variant="outline">
          <RefreshCw
            className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`}
          />
          Actualizar
        </Button>
      </div>

      {/* Estadísticas del día */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Ingresos Hoy
                </p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(estadisticas.totalIngresos)}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Egresos Hoy</p>
                <p className="text-2xl font-bold text-red-600">
                  {formatCurrency(estadisticas.totalEgresos)}
                </p>
              </div>
              <TrendingDown className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Cambios Hoy</p>
                <p className="text-2xl font-bold text-blue-600">
                  {estadisticas.totalCambios}
                </p>
              </div>
              <BarChart3 className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">
                  USD (Principal)
                </p>
                <p
                  className={`text-2xl font-bold ${
                    estadisticas.monedaPrincipalSaldo >= 0
                      ? "text-green-600"
                      : "text-red-600"
                  }`}
                >
                  {formatCurrency(estadisticas.monedaPrincipalSaldo)}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Estado general del sistema */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Estado del Sistema Contable</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-3">
              {estadisticas.saldoNegativo === 0 ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-red-600" />
              )}
              <div>
                <p className="font-medium">Saldos Negativos</p>
                <p className="text-sm text-gray-600">
                  {estadisticas.saldoNegativo} de {saldos.length} monedas
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <p className="font-medium">Saldos Positivos</p>
                <p className="text-sm text-gray-600">
                  {estadisticas.saldoPositivo} de {saldos.length} monedas
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <BarChart3 className="h-5 w-5 text-blue-600" />
              <div>
                <p className="font-medium">Balance del Día</p>
                <p
                  className={`text-sm font-semibold ${
                    estadisticas.totalIngresos - estadisticas.totalEgresos >= 0
                      ? "text-green-600"
                      : "text-red-600"
                  }`}
                >
                  {formatCurrency(
                    estadisticas.totalIngresos - estadisticas.totalEgresos
                  )}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs principales */}
      <Tabs defaultValue="saldos" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="saldos">Saldos en Tiempo Real</TabsTrigger>
          <TabsTrigger value="movimientos">
            Historial de Movimientos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="saldos" className="space-y-4">
          <SaldosDivisasEnTiempoReal
            user={user}
            selectedPoint={selectedPoint}
          />
        </TabsContent>

        <TabsContent value="movimientos" className="space-y-4">
          <HistorialMovimientos
            user={user}
            selectedPoint={selectedPoint}
            currencies={currencies}
          />
        </TabsContent>
      </Tabs>

      {/* Información adicional */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Información del Sistema</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold mb-2">Funcionamiento Automático</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>
                  • Los saldos se actualizan automáticamente con cada cambio
                </li>
                <li>• Se registra cada movimiento de entrada y salida</li>
                <li>
                  • La moneda principal (USD) es la referencia del sistema
                </li>
                <li>• Los movimientos se auditan completamente</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Tipos de Movimientos</h4>
              <div className="space-y-2">
                <Badge className="bg-green-100 text-green-800">Ingreso</Badge>
                <Badge className="bg-red-100 text-red-800">Egreso</Badge>
                <Badge className="bg-blue-100 text-blue-800">
                  Cambio de Divisa
                </Badge>
                <Badge className="bg-purple-100 text-purple-800">
                  Transferencia
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ContabilidadDashboard;
