import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
// Tabs removidos
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
import { useContabilidadAdmin } from "@/hooks/useContabilidadAdmin";
import { currencyService } from "@/services/currencyService";
import SaldosDivisasEnTiempoReal from "./SaldosDivisasEnTiempoReal";
import HistorialMovimientos from "./HistorialMovimientos";

// NUEVOS imports para colapsables y switch
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Switch } from "@/components/ui/switch";

interface ContabilidadDashboardProps {
  user: User;
  selectedPoint: PuntoAtencion | null;
  currencies?: Moneda[];
  isAdminView?: boolean;
}

export const ContabilidadDashboard = ({
  user,
  selectedPoint,
  currencies: propCurrencies,
  isAdminView = false,
}: ContabilidadDashboardProps) => {
  // Usar hook apropiado según si es vista de administrador
  const contabilidadNormal = useContabilidadDivisas({ user, selectedPoint });
  const contabilidadAdmin = useContabilidadAdmin({ user });

  const { saldos, movimientos, isLoading, error, refresh } = isAdminView
    ? user.rol === "ADMIN" || user.rol === "SUPER_USUARIO"
      ? {
          saldos: contabilidadAdmin.saldosConsolidados,
          movimientos: contabilidadAdmin.movimientosConsolidados,
          isLoading: contabilidadAdmin.isLoading,
          error: contabilidadAdmin.error,
          refresh: contabilidadAdmin.refresh,
        }
      : {
          saldos: [],
          movimientos: [],
          isLoading: false,
          error: "Permisos insuficientes",
          refresh: () => {},
        }
    : contabilidadNormal;

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

  // Totales consolidados por moneda (solo relevante en vista admin)
  const [totalesPorMoneda, setTotalesPorMoneda] = useState<
    { codigo: string; total: number }[]
  >([]);

  // VISIBILIDAD de secciones (novedad)
  const [showMovimientos, setShowMovimientos] = useState(true);
  const [showSaldos, setShowSaldos] = useState(false); // saldos cerrado por defecto

  // Estado para balance completo
  const [balanceCompleto, setBalanceCompleto] = useState<any>(null);
  const [loadingBalanceCompleto, setLoadingBalanceCompleto] = useState(false);
  const [showBalanceCompleto, setShowBalanceCompleto] = useState(true);

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

      // Contar cambios como cantidad de transacciones únicas (referencia_id) con tipo_referencia CAMBIO_DIVISA
      const cambios = (() => {
        const setRefs = new Set<string>();
        for (const mov of movimientosHoy) {
          if (mov.tipo_referencia === "CAMBIO_DIVISA" && mov.referencia_id) {
            setRefs.add(mov.referencia_id);
          }
        }
        return setRefs.size;
      })();

      const saldosPositivos = saldos.filter((s) => s.saldo > 0).length;
      const saldosNegativos = saldos.filter((s) => s.saldo < 0).length;

      // Suma USD en todos los puntos (vista admin) o solo del punto (vista normal)
      const usdSaldo = isAdminView
        ? saldos
            .filter((s) => s.moneda_codigo === "USD")
            .reduce((acc, s) => acc + s.saldo, 0)
        : saldos.find((s) => s.moneda_codigo === "USD")?.saldo || 0;

      // Totales por moneda (para tarjetas por divisa)
      const map = new Map<string, number>();
      for (const s of saldos) {
        map.set(s.moneda_codigo, (map.get(s.moneda_codigo) || 0) + s.saldo);
      }
      const totales = Array.from(map.entries()).map(([codigo, total]) => ({
        codigo,
        total,
      }));
      setTotalesPorMoneda(totales);

      setEstadisticas({
        totalIngresos: ingresos,
        totalEgresos: egresos,
        totalCambios: cambios,
        saldoPositivo: saldosPositivos,
        saldoNegativo: saldosNegativos,
        monedaPrincipalSaldo: usdSaldo,
      });
    }
  }, [movimientos, saldos, isAdminView]);

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

  if (!selectedPoint && !isAdminView) {
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
      {/* Encabezado + botón de refresco */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Calculator className="h-6 w-6 text-blue-600" />
            {isAdminView ? "Contabilidad General" : "Contabilidad de Divisas"}
          </h1>
          <p className="text-gray-600 mt-1">
            {isAdminView
              ? "Vista consolidada de todos los puntos de atención"
              : `Control contable automático para ${selectedPoint?.nombre}`}
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

          {isAdminView && totalesPorMoneda.length > 0 && (
            <div className="mt-6">
              <h4 className="font-semibold mb-3">
                Totales por Divisa (Consolidado)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {totalesPorMoneda
                  .sort((a, b) =>
                    a.codigo === "USD" ? -1 : a.codigo.localeCompare(b.codigo)
                  )
                  .map((t) => (
                    <Card key={t.codigo}>
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs text-gray-500">{t.codigo}</p>
                            <p className="text-lg font-semibold">
                              {formatCurrency(t.total, t.codigo)}
                            </p>
                          </div>
                          <DollarSign className="h-5 w-5 text-gray-400" />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* =========================
          TOOLBAR PEGAJOSO DE FILTROS
          ========================= */}
      <div className="sticky top-0 z-10 -mx-2 px-2 py-2 bg-white/70 backdrop-blur supports-[backdrop-filter]:bg-white/50 border rounded-md">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Mostrar</span>
            {/* Switches de visibilidad */}
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm">
                <Switch
                  checked={showMovimientos}
                  onCheckedChange={setShowMovimientos}
                />
                <span>Movimientos</span>
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={showSaldos} onCheckedChange={setShowSaldos} />
                <span>Saldos por divisa</span>
              </label>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                refresh?.();
              }}
            >
              <RefreshCw
                className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
              />
            </Button>
          </div>
        </div>
      </div>

      {/* Sección: Historial de Movimientos (abierta por defecto) */}
      <Collapsible open={showMovimientos} onOpenChange={setShowMovimientos}>
        <Card className="mt-3">
          <CardHeader className="flex flex-row items-center justify-between py-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Historial de Movimientos
            </CardTitle>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm">
                {showMovimientos ? "Ocultar" : "Mostrar"}
              </Button>
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="pt-0">
              <HistorialMovimientos
                user={user}
                selectedPoint={selectedPoint}
                currencies={currencies}
                isAdminView={isAdminView}
              />
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Sección: Saldos por divisa (cerrada por defecto) */}
      <Collapsible open={showSaldos} onOpenChange={setShowSaldos}>
        <Card className="mt-3">
          <CardHeader className="flex flex-row items-center justify-between py-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Saldos por divisa (en tiempo real)
              {isAdminView && (
                <Badge variant="secondary" className="ml-2">
                  Vista Admin
                </Badge>
              )}
            </CardTitle>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm">
                {showSaldos ? "Ocultar" : "Mostrar"}
              </Button>
            </CollapsibleTrigger>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="pt-0">
              <SaldosDivisasEnTiempoReal
                user={user}
                selectedPoint={selectedPoint}
                isAdminView={isAdminView}
                // Si luego quieres vista resumida primero, puedes pasar "compact"
                // compact
              />
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

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
