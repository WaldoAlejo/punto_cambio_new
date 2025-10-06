import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Calculator,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  DollarSign,
  Wallet,
  ArrowUpCircle,
  ArrowDownCircle,
  BarChart3,
  Calendar,
} from "lucide-react";
import { User, PuntoAtencion, Moneda } from "@/types";
import { pointService } from "@/services/pointService";
import { currencyService } from "@/services/currencyService";
import { gyeDayRangeUtcFromDate } from "@/utils/timezone";

interface ContabilidadPorPuntoProps {
  user: User;
}

interface SaldoInicial {
  id: string;
  punto_atencion_id: string;
  moneda_id: string;
  cantidad_inicial: number;
  asignado_por: string;
  observaciones?: string;
  activo: boolean;
  created_at: string;
  moneda_nombre?: string;
  moneda_codigo?: string;
  moneda_simbolo?: string;
  punto_nombre?: string;
  ciudad?: string;
}

interface MovimientoSaldo {
  id: string;
  punto_atencion_id: string;
  moneda_codigo: string;
  tipo_movimiento: string;
  monto: number;
  fecha: string;
  descripcion?: string;
  tipo_referencia?: string;
  referencia_id?: string;
}

interface SaldoActual {
  moneda_id: string;
  moneda_codigo: string | null;
  moneda_nombre: string | null;
  moneda_simbolo: string | null;
  saldo: number;
}

export const ContabilidadPorPunto = ({ user }: ContabilidadPorPuntoProps) => {
  const [points, setPoints] = useState<PuntoAtencion[]>([]);
  const [currencies, setCurrencies] = useState<Moneda[]>([]);
  const [selectedPointId, setSelectedPointId] = useState<string>("");
  const [selectedCurrency, setSelectedCurrency] = useState<string>("USD");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  // Datos
  const [saldoInicial, setSaldoInicial] = useState<number>(0);
  const [movimientos, setMovimientos] = useState<MovimientoSaldo[]>([]);
  const [saldoActual, setSaldoActual] = useState<number>(0);

  // Inicializar fechas (hoy)
  useEffect(() => {
    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];
    setStartDate(todayStr);
    setEndDate(todayStr);
  }, []);

  // Cargar puntos y monedas
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        // Cargar puntos
        const pointsData = await pointService.getAllPoints();
        setPoints(pointsData);
        if (pointsData.length > 0) {
          setSelectedPointId(pointsData[0].id);
        }

        // Cargar monedas
        const { currencies: currenciesData } =
          await currencyService.getAllCurrencies();
        setCurrencies(currenciesData);
      } catch (error) {
        console.error("Error cargando datos iniciales:", error);
      }
    };

    loadInitialData();
  }, []);

  // Cargar datos cuando cambian los filtros
  useEffect(() => {
    if (selectedPointId && selectedCurrency && startDate && endDate) {
      loadContabilidadData();
    }
  }, [selectedPointId, selectedCurrency, startDate, endDate]);

  const loadContabilidadData = async () => {
    if (!selectedPointId || !selectedCurrency) return;

    setIsLoading(true);
    try {
      // Obtener rango de fechas en UTC
      const startDateTime = new Date(startDate + "T00:00:00");
      const endDateTime = new Date(endDate + "T23:59:59");

      // 1. Obtener saldo inicial
      const saldoInicialResponse = await fetch(
        `/api/saldos-iniciales/${selectedPointId}`
      );
      if (saldoInicialResponse.ok) {
        const data = await saldoInicialResponse.json();
        const saldosIniciales: SaldoInicial[] = data.saldos || [];
        const saldoMoneda = saldosIniciales.find(
          (s) => s.moneda_codigo === selectedCurrency
        );
        setSaldoInicial(saldoMoneda?.cantidad_inicial || 0);
      }

      // 2. Obtener movimientos del período
      const movimientosResponse = await fetch(
        `/api/movimientos-saldo?puntoId=${selectedPointId}&monedaCodigo=${selectedCurrency}&fechaInicio=${startDateTime.toISOString()}&fechaFin=${endDateTime.toISOString()}`
      );
      if (movimientosResponse.ok) {
        const movimientosData: MovimientoSaldo[] =
          await movimientosResponse.json();
        setMovimientos(movimientosData);
      }

      // 3. Obtener saldo actual
      const saldoActualResponse = await fetch(
        `/api/saldos-actuales/${selectedPointId}`
      );
      if (saldoActualResponse.ok) {
        const data = await saldoActualResponse.json();
        const saldosActuales: SaldoActual[] = data.saldos || [];
        const saldoMoneda = saldosActuales.find(
          (s) => s.moneda_codigo === selectedCurrency
        );
        setSaldoActual(saldoMoneda?.saldo || 0);
      }
    } catch (error) {
      console.error("Error cargando datos de contabilidad:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Calcular estadísticas
  const estadisticas = useMemo(() => {
    const ingresos = movimientos
      .filter(
        (m) =>
          m.tipo_movimiento === "INGRESO" ||
          m.tipo_movimiento === "TRANSFERENCIA_ENTRANTE"
      )
      .reduce((sum, m) => sum + m.monto, 0);

    const egresos = movimientos
      .filter(
        (m) =>
          m.tipo_movimiento === "EGRESO" ||
          m.tipo_movimiento === "TRANSFERENCIA_SALIENTE"
      )
      .reduce((sum, m) => sum + m.monto, 0);

    const balance = ingresos - egresos;

    // Contar cambios únicos
    const cambiosSet = new Set<string>();
    movimientos.forEach((m) => {
      if (m.tipo_referencia === "CAMBIO_DIVISA" && m.referencia_id) {
        cambiosSet.add(m.referencia_id);
      }
    });

    return {
      ingresos,
      egresos,
      balance,
      cambios: cambiosSet.size,
    };
  }, [movimientos]);

  const formatCurrency = (amount: number, codigo = selectedCurrency) => {
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

  const selectedPoint = points.find((p) => p.id === selectedPointId);

  return (
    <div className="p-6 space-y-6">
      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Calculator className="h-6 w-6 text-blue-600" />
            Control de Contabilidad por Punto
          </h1>
          <p className="text-gray-600 mt-1">
            Monitoreo detallado de ingresos, egresos y saldos por punto de
            atención
          </p>
        </div>
        <Button
          onClick={loadContabilidadData}
          disabled={isLoading}
          variant="outline"
        >
          <RefreshCw
            className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`}
          />
          Actualizar
        </Button>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Filtros de Consulta
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Punto de Atención */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Punto de Atención
              </label>
              <Select
                value={selectedPointId}
                onValueChange={setSelectedPointId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar punto" />
                </SelectTrigger>
                <SelectContent>
                  {points.map((point) => (
                    <SelectItem key={point.id} value={point.id}>
                      {point.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Moneda */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Moneda
              </label>
              <Select
                value={selectedCurrency}
                onValueChange={setSelectedCurrency}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar moneda" />
                </SelectTrigger>
                <SelectContent>
                  {currencies.map((currency) => (
                    <SelectItem key={currency.codigo} value={currency.codigo}>
                      {currency.codigo} - {currency.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Fecha Inicio */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Fecha Inicio
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Fecha Fin */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">
                Fecha Fin
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Información del Punto Seleccionado */}
      {selectedPoint && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-blue-900">
                {selectedPoint.nombre}
              </h3>
              <p className="text-sm text-blue-700">
                {selectedPoint.direccion || "Sin dirección"}
              </p>
            </div>
            <Badge variant="outline" className="bg-white">
              {selectedPoint.activo ? "Activo" : "Inactivo"}
            </Badge>
          </div>
        </div>
      )}

      {/* Tarjetas de Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Saldo Inicial */}
        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-700">
                  Saldo Inicial
                </p>
                <p className="text-2xl font-bold text-purple-900">
                  {formatCurrency(saldoInicial)}
                </p>
                <p className="text-xs text-purple-600 mt-1">
                  {selectedCurrency}
                </p>
              </div>
              <Wallet className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        {/* Ingresos */}
        <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-700">Ingresos</p>
                <p className="text-2xl font-bold text-green-900">
                  {formatCurrency(estadisticas.ingresos)}
                </p>
                <p className="text-xs text-green-600 mt-1">
                  {selectedCurrency}
                </p>
              </div>
              <ArrowUpCircle className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        {/* Egresos */}
        <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-red-700">Egresos</p>
                <p className="text-2xl font-bold text-red-900">
                  {formatCurrency(estadisticas.egresos)}
                </p>
                <p className="text-xs text-red-600 mt-1">{selectedCurrency}</p>
              </div>
              <ArrowDownCircle className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>

        {/* Balance del Período */}
        <Card
          className={`bg-gradient-to-br ${
            estadisticas.balance >= 0
              ? "from-blue-50 to-blue-100 border-blue-200"
              : "from-orange-50 to-orange-100 border-orange-200"
          }`}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p
                  className={`text-sm font-medium ${
                    estadisticas.balance >= 0
                      ? "text-blue-700"
                      : "text-orange-700"
                  }`}
                >
                  Balance Período
                </p>
                <p
                  className={`text-2xl font-bold ${
                    estadisticas.balance >= 0
                      ? "text-blue-900"
                      : "text-orange-900"
                  }`}
                >
                  {formatCurrency(estadisticas.balance)}
                </p>
                <p
                  className={`text-xs mt-1 ${
                    estadisticas.balance >= 0
                      ? "text-blue-600"
                      : "text-orange-600"
                  }`}
                >
                  {selectedCurrency}
                </p>
              </div>
              {estadisticas.balance >= 0 ? (
                <TrendingUp className="h-8 w-8 text-blue-600" />
              ) : (
                <TrendingDown className="h-8 w-8 text-orange-600" />
              )}
            </div>
          </CardContent>
        </Card>

        {/* Saldo Actual */}
        <Card className="bg-gradient-to-br from-indigo-50 to-indigo-100 border-indigo-200">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-indigo-700">
                  Saldo Actual
                </p>
                <p className="text-2xl font-bold text-indigo-900">
                  {formatCurrency(saldoActual)}
                </p>
                <p className="text-xs text-indigo-600 mt-1">
                  {selectedCurrency}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-indigo-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Resumen de Operaciones */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Resumen de Operaciones</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Total Movimientos</p>
              <p className="text-3xl font-bold text-gray-900">
                {movimientos.length}
              </p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Cambios Realizados</p>
              <p className="text-3xl font-bold text-blue-600">
                {estadisticas.cambios}
              </p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Variación</p>
              <p
                className={`text-3xl font-bold ${
                  estadisticas.balance >= 0 ? "text-green-600" : "text-red-600"
                }`}
              >
                {estadisticas.balance >= 0 ? "+" : ""}
                {((estadisticas.balance / (saldoInicial || 1)) * 100).toFixed(
                  1
                )}
                %
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabla de Movimientos */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Detalle de Movimientos ({movimientos.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {movimientos.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <BarChart3 className="h-12 w-12 mx-auto mb-3 text-gray-400" />
              <p>No hay movimientos en el período seleccionado</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                      Fecha
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                      Tipo
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">
                      Descripción
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">
                      Monto
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {movimientos.map((mov) => {
                    const isIngreso =
                      mov.tipo_movimiento === "INGRESO" ||
                      mov.tipo_movimiento === "TRANSFERENCIA_ENTRANTE";
                    return (
                      <tr
                        key={mov.id}
                        className="border-b border-gray-100 hover:bg-gray-50"
                      >
                        <td className="py-3 px-4 text-sm text-gray-600">
                          {new Date(mov.fecha).toLocaleString("es-EC", {
                            year: "numeric",
                            month: "2-digit",
                            day: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="py-3 px-4">
                          <Badge
                            variant={isIngreso ? "default" : "destructive"}
                            className={
                              isIngreso
                                ? "bg-green-100 text-green-800"
                                : "bg-red-100 text-red-800"
                            }
                          >
                            {mov.tipo_movimiento.replace(/_/g, " ")}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-700">
                          {mov.descripcion || "-"}
                        </td>
                        <td
                          className={`py-3 px-4 text-sm font-semibold text-right ${
                            isIngreso ? "text-green-600" : "text-red-600"
                          }`}
                        >
                          {isIngreso ? "+" : "-"}
                          {formatCurrency(Math.abs(mov.monto))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ContabilidadPorPunto;
