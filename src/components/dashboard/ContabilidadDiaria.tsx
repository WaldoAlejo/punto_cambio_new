import React, { useEffect, useMemo, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  RefreshCw,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  FileText,
  CheckCircle,
  AlertTriangle,
  Eye,
  Lock,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import {
  User,
  PuntoAtencion,
  ResumenDiario,
  MovimientoDiario,
  CierreDiario,
} from "../../types";
import { contabilidadDiariaService } from "../../services/contabilidadDiariaService";
import { format } from "date-fns";
import { es } from "date-fns/locale";

/* =========================
   Props
========================= */
interface ContabilidadDiariaProps {
  user: User;
  selectedPoint: PuntoAtencion | null;
}

/* =========================
   Helpers
========================= */
const formatNumber = (n: number) =>
  new Intl.NumberFormat("es-EC", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(n || 0));

const formatMoney = (n: number, symbol = "$") => `${symbol}${formatNumber(n)}`;

const conceptoLabel = (concepto: MovimientoDiario["concepto"]) => {
  switch (concepto) {
    case "CAMBIO_COMPRA":
      return "Cambio • Compra";
    case "CAMBIO_VENTA":
      return "Cambio • Venta";
    case "TRANSFERENCIA_RECIBIDA":
      return "Transferencia recibida";
    case "TRANSFERENCIA_ENVIADA":
      return "Transferencia enviada";
    case "SALDO_INICIAL":
      return "Saldo inicial";
    default:
      return concepto;
  }
};

const conceptoPill = (concepto: MovimientoDiario["concepto"]) => {
  switch (concepto) {
    case "CAMBIO_COMPRA":
      return "bg-green-100 text-green-800";
    case "CAMBIO_VENTA":
      return "bg-blue-100 text-blue-800";
    case "TRANSFERENCIA_RECIBIDA":
      return "bg-purple-100 text-purple-800";
    case "TRANSFERENCIA_ENVIADA":
      return "bg-orange-100 text-orange-800";
    case "SALDO_INICIAL":
      return "bg-gray-100 text-gray-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
};

/* =========================
   Component
========================= */
const ContabilidadDiaria = ({
  user,
  selectedPoint,
}: ContabilidadDiariaProps) => {
  const [resumenDiario, setResumenDiario] = useState<ResumenDiario[]>([]);
  const [cierreDiario, setCierreDiario] = useState<CierreDiario | null>(null);
  const [loading, setLoading] = useState(false);
  const [fechaSeleccionada, setFechaSeleccionada] = useState(
    format(new Date(), "yyyy-MM-dd")
  );
  const [mostrarMovimientos, setMostrarMovimientos] = useState<string | null>(
    null
  );

  const cargarContabilidadDiaria = useCallback(async () => {
    if (!selectedPoint) return;
    setLoading(true);
    try {
      // Resumen
      const resumenResponse = await contabilidadDiariaService.getResumenDiario(
        selectedPoint.id,
        fechaSeleccionada
      );
      if (resumenResponse.success && resumenResponse.resumen) {
        setResumenDiario(resumenResponse.resumen);
      } else {
        setResumenDiario([]);
        toast({
          title: "Error",
          description:
            resumenResponse.error || "Error al cargar el resumen diario",
          variant: "destructive",
        });
      }
      // Cierre
      const cierreResponse = await contabilidadDiariaService.getCierreDiario(
        selectedPoint.id,
        fechaSeleccionada
      );
      if (cierreResponse.success) {
        setCierreDiario(cierreResponse.cierre || null);
      } else {
        setCierreDiario(null);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al cargar la contabilidad diaria",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [selectedPoint, fechaSeleccionada]);

  useEffect(() => {
    if (selectedPoint) cargarContabilidadDiaria();
  }, [selectedPoint, fechaSeleccionada, cargarContabilidadDiaria]);

  const realizarCierre = async () => {
    if (!selectedPoint || cierreDiario?.estado === "CERRADO") return;
    try {
      const response = await contabilidadDiariaService.realizarCierre({
        punto_atencion_id: selectedPoint.id,
        fecha: fechaSeleccionada,
        observaciones: `Cierre realizado por ${user.nombre}`,
      });
      if (response.success) {
        toast({
          title: "Cierre realizado",
          description: "El cierre diario se ha realizado correctamente.",
        });
        cargarContabilidadDiaria();
      } else {
        toast({
          title: "Error",
          description: response.error || "Error al realizar el cierre diario",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al realizar el cierre diario",
        variant: "destructive",
      });
    }
  };

  /* =========================
     Derivados para resumen
  ========================= */
  const totalIngresosDia = useMemo(
    () =>
      resumenDiario.reduce((acc, r) => acc + Number(r.total_ingresos || 0), 0),
    [resumenDiario]
  );
  const totalEgresosDia = useMemo(
    () =>
      resumenDiario.reduce((acc, r) => acc + Number(r.total_egresos || 0), 0),
    [resumenDiario]
  );
  const balanceGeneralDia = useMemo(
    () => totalIngresosDia - totalEgresosDia,
    [totalIngresosDia, totalEgresosDia]
  );

  if (!selectedPoint) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">
            Debe seleccionar un punto de atención para ver la contabilidad
            diaria.
          </p>
        </div>
      </div>
    );
  }

  const fechaBonita = format(
    new Date(fechaSeleccionada),
    "dd 'de' MMMM, yyyy",
    {
      locale: es,
    }
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">
            Contabilidad Diaria
          </h2>
          <div className="flex items-center gap-2 text-gray-600">
            <span>
              {selectedPoint.nombre} • {selectedPoint.ciudad}
            </span>
            <span className="text-xs text-gray-500">• {fechaBonita}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-600" htmlFor="fecha">
            Fecha
          </label>
          <input
            id="fecha"
            type="date"
            value={fechaSeleccionada}
            onChange={(e) => setFechaSeleccionada(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm"
            max={format(new Date(), "yyyy-MM-dd")}
          />
          <Button
            onClick={cargarContabilidadDiaria}
            disabled={loading}
            variant="outline"
            size="sm"
          >
            <RefreshCw
              className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`}
            />
            Actualizar
          </Button>
        </div>
      </div>

      {/* Estado del cierre (si existe) */}
      {cierreDiario && (
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Lock className="h-5 w-5 text-blue-600" />
                <div>
                  <p className="font-semibold text-blue-800">Día cerrado</p>
                  <p className="text-sm text-gray-600">
                    Cerrado el{" "}
                    {cierreDiario.fecha_cierre
                      ? format(
                          new Date(cierreDiario.fecha_cierre),
                          "dd/MM/yyyy 'a las' HH:mm"
                        )
                      : "--/--/----"}{" "}
                    por {cierreDiario.cerrado_por || "—"}
                  </p>
                </div>
              </div>
              <Badge variant="secondary">
                <CheckCircle className="h-3 w-3 mr-1" />
                Cerrado
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Resumen general del día */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Ingresos
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatMoney(totalIngresosDia)}
            </div>
            <p className="text-xs text-muted-foreground">
              Compras y transf. recibidas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Egresos</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatMoney(totalEgresosDia)}
            </div>
            <p className="text-xs text-muted-foreground">
              Ventas y transf. enviadas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Balance del Día
            </CardTitle>
            {balanceGeneralDia >= 0 ? (
              <TrendingUp className="h-4 w-4 text-green-600" />
            ) : (
              <TrendingDown className="h-4 w-4 text-red-600" />
            )}
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${
                balanceGeneralDia >= 0 ? "text-green-600" : "text-red-600"
              }`}
            >
              {balanceGeneralDia >= 0 ? "+" : "−"}
              {formatMoney(Math.abs(balanceGeneralDia))}
            </div>
            <p className="text-xs text-muted-foreground">
              Diferencia neta del día
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Monedas Activas
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{resumenDiario.length}</div>
            <p className="text-xs text-muted-foreground">Con movimientos</p>
          </CardContent>
        </Card>
      </div>

      {/* Detalle por moneda */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Detalle por moneda</h3>
          {!cierreDiario &&
            fechaSeleccionada === format(new Date(), "yyyy-MM-dd") && (
              <Button
                onClick={realizarCierre}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <FileText className="h-4 w-4 mr-2" />
                Realizar cierre diario
              </Button>
            )}
        </div>

        {/* Loading state */}
        {loading && resumenDiario.length === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="flex flex-col items-center" aria-live="polite">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4" />
                <p className="text-gray-600">Cargando datos del día…</p>
              </div>
            </CardContent>
          </Card>
        ) : resumenDiario.length === 0 ? (
          <Card>
            <CardContent className="flex items-center justify-center py-12">
              <div className="text-center">
                <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600 text-base">
                  No hay movimientos para esta fecha
                </p>
                <p className="text-gray-400 text-sm">
                  Los movimientos aparecerán aquí cuando se realicen operaciones
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          resumenDiario.map((resumen) => {
            const diff = Number(resumen.diferencia || 0);
            const diffPositive = diff >= 0;

            return (
              <Card
                key={resumen.moneda_id}
                className="transition-all duration-200 hover:shadow-md"
              >
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <CardTitle className="text-lg">
                        {resumen.moneda_codigo} • {resumen.moneda_simbolo}
                      </CardTitle>
                      <p className="text-sm text-gray-500">
                        {resumen.movimientos.length} movimientos registrados
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={diffPositive ? "default" : "destructive"}>
                        {diffPositive ? "+" : "−"}
                        {formatMoney(Math.abs(diff), resumen.moneda_simbolo)}
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          setMostrarMovimientos(
                            mostrarMovimientos === resumen.moneda_id
                              ? null
                              : resumen.moneda_id
                          )
                        }
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        {mostrarMovimientos === resumen.moneda_id
                          ? "Ocultar"
                          : "Ver"}{" "}
                        movimientos
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent>
                  {/* KPIs por moneda */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div className="bg-gray-50 p-3 rounded-lg border">
                      <p className="text-sm text-gray-600 font-medium">
                        Saldo inicial
                      </p>
                      <p className="text-lg font-bold text-gray-800">
                        {formatMoney(
                          resumen.saldo_inicial,
                          resumen.moneda_simbolo
                        )}
                      </p>
                    </div>

                    <div className="bg-green-50 p-3 rounded-lg border">
                      <p className="text-sm text-green-600 font-medium">
                        Ingresos
                      </p>
                      <p className="text-lg font-bold text-green-800">
                        +
                        {formatMoney(
                          resumen.total_ingresos,
                          resumen.moneda_simbolo
                        )}
                      </p>
                    </div>

                    <div className="bg-red-50 p-3 rounded-lg border">
                      <p className="text-sm text-red-600 font-medium">
                        Egresos
                      </p>
                      <p className="text-lg font-bold text-red-800">
                        −
                        {formatMoney(
                          resumen.total_egresos,
                          resumen.moneda_simbolo
                        )}
                      </p>
                    </div>

                    <div className="bg-blue-50 p-3 rounded-lg border">
                      <p className="text-sm text-blue-600 font-medium">
                        Saldo final
                      </p>
                      <p className="text-lg font-bold text-blue-800">
                        {formatMoney(
                          resumen.saldo_final,
                          resumen.moneda_simbolo
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Lista de movimientos por moneda */}
                  {mostrarMovimientos === resumen.moneda_id && (
                    <div className="border-t pt-4">
                      <h4 className="font-semibold mb-3">
                        Movimientos del día
                      </h4>
                      {resumen.movimientos.length === 0 ? (
                        <p className="text-gray-500 text-center py-4">
                          No hay movimientos registrados
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {resumen.movimientos.map((mov) => {
                            const sign = mov.tipo === "INGRESO" ? "+" : "−";
                            return (
                              <div
                                key={mov.id}
                                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border"
                              >
                                <div className="flex items-center gap-3">
                                  <div
                                    className={`px-2 py-1 rounded-full text-xs font-medium ${conceptoPill(
                                      mov.concepto
                                    )}`}
                                  >
                                    {conseptoLabelSafe(mov.concepto)}
                                  </div>
                                  <div>
                                    <p className="font-medium">
                                      {sign}
                                      {formatMoney(
                                        mov.monto,
                                        mov.moneda_simbolo
                                      )}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                      {format(new Date(mov.fecha), "HH:mm")} •{" "}
                                      {mov.usuario_nombre}
                                      {mov.numero_recibo
                                        ? ` • ${mov.numero_recibo}`
                                        : ""}
                                    </p>
                                  </div>
                                </div>
                                {mov.observaciones && (
                                  <div className="text-xs text-gray-500 max-w-xs truncate">
                                    {mov.observaciones}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
};

// Safe wrapper for labels (evita typo si el backend trae algo inesperado)
function conseptoLabelSafe(key: MovimientoDiario["concepto"]) {
  try {
    return conceptoLabel(key);
  } catch {
    return String(key);
  }
}

export default ContabilidadDiaria;
