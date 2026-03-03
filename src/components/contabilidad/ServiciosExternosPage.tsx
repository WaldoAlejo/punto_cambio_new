import React, { useState, useEffect, useCallback } from "react";
import ServiciosExternosForm from "./ServiciosExternosForm";
import ServiciosExternosHistory from "./ServiciosExternosHistory";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import {
  obtenerSaldosAsignados,
  obtenerSaldoInicialDiario,
  SaldoAsignado,
  SaldoInicialServicio,
} from "@/services/externalServicesService";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Info, TrendingUp, TrendingDown, Minus } from "lucide-react";

const SERVICIOS_LABELS: Record<string, string> = {
  YAGANASTE: "YaGanaste",
  BANCO_GUAYAQUIL: "Banco Guayaquil",
  WESTERN: "Western Union",
  PRODUBANCO: "Produbanco",
  BANCO_PACIFICO: "Banco del Pacífico",
  SERVIENTREGA: "Servientrega",
  INSUMOS_OFICINA: "Insumos de oficina",
  INSUMOS_LIMPIEZA: "Insumos de limpieza",
  OTROS: "Otros",
};

export default function ServiciosExternosPage() {
  const { user } = useAuth();
  const [saldosAsignados, setSaldosAsignados] = useState<SaldoAsignado[]>([]);
  const [saldosIniciales, setSaldosIniciales] = useState<SaldoInicialServicio[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingIniciales, setLoadingIniciales] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [fechaActual, setFechaActual] = useState<string>("");

  const cargarSaldos = useCallback(async () => {
    if (!user?.punto_atencion_id) return;

    setLoading(true);
    setLoadingIniciales(true);
    try {
      // Cargar saldos actuales
      const response = await obtenerSaldosAsignados();
      setSaldosAsignados(response.saldos_asignados || []);

      // Cargar saldos iniciales del día
      const responseInicial = await obtenerSaldoInicialDiario();
      if (responseInicial.success) {
        setSaldosIniciales(responseInicial.saldos_iniciales || []);
        setFechaActual(responseInicial.fecha);
      }
    } catch (error) {
      console.error("Error al cargar saldos:", error);
      toast.error("Error al cargar saldos");
    } finally {
      setLoading(false);
      setLoadingIniciales(false);
    }
  }, [user?.punto_atencion_id]);

  useEffect(() => {
    cargarSaldos();
  }, [cargarSaldos, refreshKey]);

  const handleRefresh = () => {
    setRefreshKey((prev) => prev + 1);
  };

  // Filtrar solo servicios con saldo inicial o movimientos
  const serviciosActivos = saldosIniciales.filter(
    (s) => s.saldo_inicial > 0 || s.saldo_actual > 0 || s.movimientos_hoy !== 0
  );

  return (
    <TooltipProvider>
      <div className="p-4 md:p-6 h-full flex flex-col gap-4 overflow-auto">
        {/* Encabezado de la página - Compacto */}
        <div className="flex items-center justify-between gap-4 flex-shrink-0">
          <div>
            <h2 className="text-lg md:text-xl font-semibold">Servicios Externos (USD)</h2>
            <p className="text-xs md:text-sm text-gray-600">
              Registre ingresos/egresos de servicios externos e insumos
            </p>
          </div>
          <Badge variant="outline" className="text-xs md:text-sm">
            USD
          </Badge>
        </div>

        {/* Saldo Inicial del Día - NUEVO */}
        {user?.punto_atencion_id && (
          <Card className="border flex-shrink-0 bg-blue-50/50">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-sm font-semibold">
                    📅 Saldo Inicial del Día {fechaActual ? `(${fechaActual})` : ""}
                  </CardTitle>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-sm">
                      <p className="text-xs">
                        El saldo inicial se calcula como:
                      </p>
                      <ul className="text-xs list-disc list-inside mt-1">
                        <li>Si hay cierre del día anterior: usa el saldo validado</li>
                        <li>Si no hay cierre: Saldo actual - Movimientos de hoy</li>
                      </ul>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRefresh}
                  disabled={loadingIniciales}
                  className="h-7 text-xs"
                >
                  {loadingIniciales ? "⏳" : "🔄"} Actualizar
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {loadingIniciales && saldosIniciales.length === 0 ? (
                <p className="text-xs text-gray-500">Cargando saldos iniciales...</p>
              ) : serviciosActivos.length === 0 ? (
                <p className="text-xs text-gray-500">
                  No hay servicios con saldo inicial para hoy
                </p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 md:gap-3">
                  {serviciosActivos.map((saldo) => {
                    const diferencia = saldo.diferencia_dia;
                    const tendencia =
                      diferencia > 0.01
                        ? "up"
                        : diferencia < -0.01
                        ? "down"
                        : "neutral";

                    return (
                      <div
                        key={saldo.servicio}
                        className="p-2 md:p-3 border rounded-lg bg-white hover:bg-gray-50 transition-colors relative"
                      >
                        {/* Indicador de método de cálculo */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div
                              className={`absolute top-1 right-1 w-2 h-2 rounded-full ${
                                saldo.tiene_cierre_anterior
                                  ? "bg-green-500"
                                  : "bg-amber-500"
                              }`}
                            />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-xs">
                              {saldo.tiene_cierre_anterior
                                ? "Basado en cierre anterior"
                                : "Calculado automáticamente"}
                            </p>
                          </TooltipContent>
                        </Tooltip>

                        <p
                          className="text-xs font-medium text-gray-600 truncate"
                          title={SERVICIOS_LABELS[saldo.servicio] || saldo.servicio}
                        >
                          {SERVICIOS_LABELS[saldo.servicio] || saldo.servicio}
                        </p>

                        {/* Saldo Inicial */}
                        <div className="mt-1">
                          <p className="text-[10px] text-gray-500">Inicio día:</p>
                          <p className="text-sm md:text-base font-bold text-blue-600">
                            ${saldo.saldo_inicial.toFixed(2)}
                          </p>
                        </div>

                        {/* Saldo Actual */}
                        <div className="mt-1">
                          <p className="text-[10px] text-gray-500">Actual:</p>
                          <p
                            className={`text-sm font-semibold ${
                              tendencia === "up"
                                ? "text-green-600"
                                : tendencia === "down"
                                ? "text-red-600"
                                : "text-gray-700"
                            }`}
                          >
                            ${saldo.saldo_actual.toFixed(2)}
                          </p>
                        </div>

                        {/* Diferencia con icono */}
                        {tendencia !== "neutral" && (
                          <div className="flex items-center gap-1 mt-1">
                            {tendencia === "up" ? (
                              <TrendingUp className="h-3 w-3 text-green-600" />
                            ) : (
                              <TrendingDown className="h-3 w-3 text-red-600" />
                            )}
                            <span
                              className={`text-[10px] font-medium ${
                                tendencia === "up"
                                  ? "text-green-600"
                                  : "text-red-600"
                              }`}
                            >
                              {tendencia === "up" ? "+" : ""}
                              {diferencia.toFixed(2)}
                            </span>
                          </div>
                        )}

                        {/* Movimientos del día */}
                        {saldo.movimientos_hoy !== 0 && (
                          <div className="mt-1 pt-1 border-t">
                            <p className="text-[10px] text-gray-500">
                              Mov. hoy: {" "}
                              <span
                                className={`font-medium ${
                                  saldo.movimientos_hoy > 0
                                    ? "text-green-600"
                                    : "text-red-600"
                                }`}
                              >
                                {saldo.movimientos_hoy > 0 ? "+" : ""}
                                {saldo.movimientos_hoy.toFixed(2)}
                              </span>
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Leyenda */}
              <div className="flex items-center gap-4 mt-3 text-[10px] text-gray-500">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <span>Con cierre anterior</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-full bg-amber-500" />
                  <span>Calculado</span>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Saldos Asignados - Card compacto */}
        {user?.punto_atencion_id && (
          <Card className="border flex-shrink-0">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">
                  💰 Saldos Asignados (Disponibles)
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRefresh}
                  disabled={loading}
                  className="h-7 text-xs"
                >
                  {loading ? "⏳" : "🔄"} Actualizar
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {loading && saldosAsignados.length === 0 ? (
                <p className="text-xs text-gray-500">Cargando saldos...</p>
              ) : saldosAsignados.length === 0 ? (
                <p className="text-xs text-gray-500">
                  No hay saldos asignados para este punto
                </p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 gap-2 md:gap-3">
                  {saldosAsignados.map((saldo) => (
                    <div
                      key={saldo.servicio}
                      className="p-2 md:p-3 border rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                    >
                      <p
                        className="text-xs font-medium text-gray-600 truncate"
                        title={SERVICIOS_LABELS[saldo.servicio] || saldo.servicio}
                      >
                        {SERVICIOS_LABELS[saldo.servicio] || saldo.servicio}
                      </p>
                      <p className="text-sm md:text-base font-bold text-green-600 mt-1">
                        ${(Number(saldo.saldo_asignado) || 0).toFixed(2)}
                      </p>
                      <div className="text-[10px] md:text-xs text-gray-500 mt-1 space-y-0.5">
                        <div>
                          Billetes:{" "}
                          <b>${(Number(saldo.billetes) || 0).toFixed(2)}</b>
                        </div>
                        <div>
                          Monedas:{" "}
                          <b>${(Number(saldo.monedas_fisicas) || 0).toFixed(2)}</b>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Dos columnas en desktop, una columna en mobile - Con altura controlada */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 flex-shrink-0">
          {/* Columna izquierda: Formulario */}
          <Card className="border flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm md:text-base font-semibold">
                📝 Nuevo movimiento
              </CardTitle>
              <p className="text-xs md:text-sm text-muted-foreground">
                Completa los campos y guarda para registrar un movimiento
              </p>
            </CardHeader>
            <CardContent className="pt-0">
              <ServiciosExternosForm onMovimientoCreado={handleRefresh} />
            </CardContent>
          </Card>

          {/* Columna derecha: Historial */}
          <Card className="border flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm md:text-base font-semibold">
                📊 Últimos movimientos
              </CardTitle>
              <p className="text-xs md:text-sm text-muted-foreground">
                Revisa y exporta tus registros recientes
              </p>
            </CardHeader>
            <CardContent className="pt-0">
              <ServiciosExternosHistory />
            </CardContent>
          </Card>
        </div>
      </div>
    </TooltipProvider>
  );
}
