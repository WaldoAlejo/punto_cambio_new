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
import { User, PuntoAtencion, CuadreCaja } from "../../types";

interface DailyCloseProps {
  user: User;
  selectedPoint: PuntoAtencion | null;
}

interface CuadreDetalle {
  moneda_id: string;
  codigo: string;
  nombre: string;
  simbolo: string;
  saldo_apertura: number;
  saldo_cierre: number;
  conteo_fisico: number;
  billetes: number;
  monedas: number;
  ingresos_periodo: number;
  egresos_periodo: number;
  movimientos_periodo: number;
}

const DailyClose = ({ user, selectedPoint }: DailyCloseProps) => {
  const [cuadreData, setCuadreData] = useState<{
    detalles: CuadreDetalle[];
    observaciones: string;
    cuadre_id?: string;
    periodo_inicio?: string;
    totales?: {
      cambios: number;
      transferencias_entrada: number;
      transferencias_salida: number;
    };
  } | null>(null);
  const [userAdjustments, setUserAdjustments] = useState<{
    [key: string]: { bills: string; coins: string };
  }>({});
  const [todayClose, setTodayClose] = useState<CuadreCaja | null>(null);
  const [hasActiveJornada, setHasActiveJornada] = useState<boolean | null>(
    null
  );
  const [loading, setLoading] = useState(false);

  // Verificar jornada activa
  useEffect(() => {
    const checkActiveJornada = async (): Promise<void> => {
      try {
        const token = localStorage.getItem("authToken");
        console.log(
          "🔍 DailyClose - localStorage keys:",
          Object.keys(localStorage)
        );
        console.log("🔍 DailyClose - token check:", {
          tokenExists: !!token,
          tokenPreview: token ? token.substring(0, 30) + "..." : "No token",
          userInfo: { id: user.id, rol: user.rol, nombre: user.nombre },
        });

        if (!token) {
          console.log("❌ No token found for jornada check");
          setHasActiveJornada(false);
          return;
        }

        console.log("🔍 Checking active jornada for user:", user.rol);
        const response = await fetch(
          `${
            import.meta.env.VITE_API_URL || "http://35.238.95.118/api"
          }/schedules/active`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        );

        console.log("🕒 Active jornada response status:", response.status);

        if (response.ok) {
          const data = await response.json();
          console.log("🕒 Active jornada response data:", data);

          // Verificar que tenga schedule y que esté ACTIVO
          const hasJornada =
            data.success &&
            data.schedule &&
            (data.schedule.estado === "ACTIVO" ||
              data.schedule.estado === "ALMUERZO");
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
      const interval = setInterval(checkActiveJornada, 30000);
      return () => clearInterval(interval);
    } else {
      setHasActiveJornada(true);
    }
    // Ensure all code paths return void
    return;
  }, [user]);

  // Obtener datos de cuadre automático
  useEffect(() => {
    const fetchCuadreData = async () => {
      try {
        setLoading(true);
        console.log("🔄 Fetching automated cuadre data...");

        const token = localStorage.getItem("authToken");
        if (!token) {
          toast({
            title: "Sesión Expirada",
            description: "Por favor, inicie sesión nuevamente.",
            variant: "destructive",
          });
          return;
        }

        const response = await fetch(
          `${
            import.meta.env.VITE_API_URL || "http://35.238.95.118/api"
          }/cuadre-caja`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
          }
        );

        if (response.ok) {
          const data = await response.json();
          console.log("📊 Cuadre data received:", data);

          if (data.success && data.data) {
            console.log("✅ Cuadre data details:", {
              detallesCount: data.data.detalles?.length || 0,
              detalles: data.data.detalles,
              mensaje: data.data.mensaje,
              periodoInicio: data.data.periodo_inicio,
            });

            setCuadreData(data.data);

            // Inicializar ajustes del usuario con valores esperados (saldo de cierre)
            const initialAdjustments: {
              [key: string]: { bills: string; coins: string };
            } = {};
            data.data.detalles.forEach((detalle: CuadreDetalle) => {
              // Inicializar con el saldo esperado dividido entre billetes y monedas
              // Por defecto asumimos todo en billetes, pero el usuario puede ajustar
              initialAdjustments[detalle.moneda_id] = {
                bills: detalle.saldo_cierre.toFixed(2),
                coins: "0.00",
              };
            });
            setUserAdjustments(initialAdjustments);
          } else if (data.data?.mensaje) {
            // No hay movimientos hoy
            console.log("⚠️ No hay movimientos:", data.data.mensaje);
            setCuadreData({ detalles: [], observaciones: "" });
            setUserAdjustments({});
          }
        } else {
          console.error(
            "❌ Error response from cuadre API:",
            response.status,
            response.statusText
          );
          throw new Error("Error al obtener datos de cuadre");
        }
      } catch (error) {
        console.error("Error al obtener datos de cuadre:", error);
        toast({
          title: "Error",
          description: "No se pudo cargar los datos de cuadre automático.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    if (selectedPoint) {
      fetchCuadreData();
      setTodayClose(null);
    }
  }, [selectedPoint]);

  const handleUserAdjustment = (
    monedaId: string,
    type: "bills" | "coins",
    value: string
  ) => {
    // No permitir valores negativos
    const numValue = parseFloat(value);
    if (numValue < 0) return;

    setUserAdjustments((prev) => ({
      ...prev,
      [monedaId]: {
        ...prev[monedaId],
        [type]: value,
      },
    }));
  };

  const calculateUserTotal = (monedaId: string) => {
    const bills = parseFloat(userAdjustments[monedaId]?.bills || "0");
    const coins = parseFloat(userAdjustments[monedaId]?.coins || "0");
    return bills + coins;
  };

  const validateBalance = (detalle: CuadreDetalle, userTotal: number) => {
    const difference = Math.abs(userTotal - detalle.saldo_cierre);
    const tolerance = 0.01; // Tolerancia de 1 centavo
    return difference <= tolerance;
  };

  const performDailyClose = async () => {
    console.log("🔄 performDailyClose START");
    if (!selectedPoint || !cuadreData) {
      toast({
        title: "Error",
        description:
          "Debe seleccionar un punto de atención y tener datos de cuadre",
        variant: "destructive",
      });
      return;
    }

    // Validar que todos los saldos estén completos
    const incompleteBalances = cuadreData.detalles.some(
      (detalle) =>
        !userAdjustments[detalle.moneda_id]?.bills ||
        !userAdjustments[detalle.moneda_id]?.coins
    );

    if (incompleteBalances) {
      toast({
        title: "Error",
        description: "Debe completar todos los saldos antes del cierre",
        variant: "destructive",
      });
      return;
    }

    // Validar que los saldos cuadren (opcional - mostrar advertencia pero permitir continuar)
    const invalidBalances = cuadreData.detalles.filter((detalle) => {
      const userTotal = calculateUserTotal(detalle.moneda_id);
      return !validateBalance(detalle, userTotal);
    });

    if (invalidBalances.length > 0) {
      const proceed = window.confirm(
        `⚠️ Los siguientes saldos no cuadran con los movimientos del día:\n\n${invalidBalances
          .map(
            (d) =>
              `${d.codigo}: Esperado ${d.saldo_cierre.toFixed(
                2
              )}, Ingresado ${calculateUserTotal(d.moneda_id).toFixed(2)}`
          )
          .join("\n")}\n\n¿Desea continuar de todas formas?`
      );

      if (!proceed) return;
    }

    // Preparar detalles del cuadre con los datos del usuario
    const detalles = cuadreData.detalles.map((detalle) => ({
      moneda_id: detalle.moneda_id,
      conteo_fisico: calculateUserTotal(detalle.moneda_id),
      billetes: parseInt(userAdjustments[detalle.moneda_id]?.bills || "0"),
      monedas: parseInt(userAdjustments[detalle.moneda_id]?.coins || "0"),
      saldo_apertura: detalle.saldo_apertura,
      saldo_cierre: detalle.saldo_cierre,
    }));

    console.log("📊 Detalles prepared:", detalles);

    try {
      const token = localStorage.getItem("authToken");
      if (!token) {
        toast({
          title: "Sesión Expirada",
          description:
            "Su sesión ha expirado. Por favor, inicie sesión nuevamente.",
          variant: "destructive",
        });
        setTimeout(() => (window.location.href = "/login"), 2000);
        return;
      }

      const requestBody = {
        detalles,
        observaciones: cuadreData.observaciones || "",
      };

      const res = await fetch(
        `${
          import.meta.env.VITE_API_URL || "http://35.238.95.118/api"
        }/cuadre-caja`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(requestBody),
        }
      );

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
      console.error("💥 Error in performDailyClose:", error);
      toast({
        title: "Error",
        description:
          error instanceof Error
            ? error.message
            : "No se pudo guardar el cierre",
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

      {loading ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">
                Cargando datos de cuadre automático...
              </p>
            </div>
          </CardContent>
        </Card>
      ) : !todayClose ? (
        <Card>
          <CardHeader>
            <CardTitle>Cuadre de Caja Automático</CardTitle>
            <CardDescription>
              {cuadreData?.detalles.length === 0
                ? "No se han registrado movimientos de divisas hoy"
                : "Revise y ajuste los conteos físicos. Los valores están pre-calculados según los movimientos del día."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Mostrar totales del día */}
            {cuadreData?.totales && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
                <div className="text-center">
                  <h4 className="font-semibold text-blue-700">Total Cambios</h4>
                  <p className="text-2xl font-bold text-blue-600">
                    {cuadreData.totales.cambios}
                  </p>
                </div>
                <div className="text-center">
                  <h4 className="font-semibold text-green-700">
                    Transferencias Entrada
                  </h4>
                  <p className="text-2xl font-bold text-green-600">
                    {cuadreData.totales.transferencias_entrada}
                  </p>
                </div>
                <div className="text-center">
                  <h4 className="font-semibold text-orange-700">
                    Transferencias Salida
                  </h4>
                  <p className="text-2xl font-bold text-orange-600">
                    {cuadreData.totales.transferencias_salida}
                  </p>
                </div>
              </div>
            )}

            {cuadreData?.detalles.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">
                  No hay divisas para cerrar hoy. Realice algún cambio de divisa
                  primero.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {cuadreData?.detalles.map((detalle) => {
                  const userTotal = calculateUserTotal(detalle.moneda_id);
                  const isValid = validateBalance(detalle, userTotal);

                  return (
                    <div
                      key={detalle.moneda_id}
                      className={`border rounded-lg p-4 ${
                        !isValid
                          ? "border-red-200 bg-red-50"
                          : "border-gray-200"
                      }`}
                    >
                      <div className="flex justify-between items-center mb-3">
                        <h3 className="font-semibold text-lg">
                          {detalle.codigo} - {detalle.nombre}
                        </h3>
                        {!isValid && (
                          <span className="text-red-600 text-sm font-medium">
                            ⚠️ No cuadra
                          </span>
                        )}
                      </div>

                      {/* Información automática */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 text-sm">
                        <div className="bg-blue-50 p-2 rounded">
                          <label className="text-blue-700 font-medium">
                            Saldo Apertura
                          </label>
                          <p className="text-blue-800 font-bold">
                            {detalle.saldo_apertura.toFixed(2)}
                          </p>
                          <p className="text-xs text-blue-600">
                            Dinero al inicio del día
                          </p>
                        </div>
                        <div className="bg-green-50 p-2 rounded">
                          <label className="text-green-700 font-medium">
                            Ingresos (+)
                          </label>
                          <p className="text-green-800 font-bold">
                            +{detalle.ingresos_periodo.toFixed(2)}
                          </p>
                          <p className="text-xs text-green-600">
                            Divisas que recibimos
                          </p>
                        </div>
                        <div className="bg-red-50 p-2 rounded">
                          <label className="text-red-700 font-medium">
                            Egresos (-)
                          </label>
                          <p className="text-red-800 font-bold">
                            -{detalle.egresos_periodo.toFixed(2)}
                          </p>
                          <p className="text-xs text-red-600">
                            Divisas que entregamos
                          </p>
                        </div>
                        <div className="bg-purple-50 p-2 rounded">
                          <label className="text-purple-700 font-medium">
                            Saldo Esperado
                          </label>
                          <p className="text-purple-800 font-bold">
                            {detalle.saldo_cierre.toFixed(2)}
                          </p>
                          <p className="text-xs text-purple-600">
                            Lo que debe quedar
                          </p>
                        </div>
                      </div>

                      {/* Instrucciones claras */}
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                        <p className="text-sm text-yellow-800">
                          <strong>📝 Instrucciones:</strong> Ingrese el total
                          final que tiene físicamente. Ejemplo: Si tenía{" "}
                          {detalle.saldo_apertura.toFixed(2)} y los movimientos
                          suman{" "}
                          {(
                            detalle.ingresos_periodo - detalle.egresos_periodo
                          ).toFixed(2)}
                          , debe tener {detalle.saldo_cierre.toFixed(2)} en
                          total.
                        </p>
                      </div>

                      {/* Conteo físico del usuario */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">
                            💵 Billetes Físicos
                            <span className="text-xs text-gray-500 block">
                              Valor total en billetes
                            </span>
                          </Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={
                              userAdjustments[detalle.moneda_id]?.bills || ""
                            }
                            onChange={(e) =>
                              handleUserAdjustment(
                                detalle.moneda_id,
                                "bills",
                                e.target.value
                              )
                            }
                            placeholder="0.00"
                            className={!isValid ? "border-red-300" : ""}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">
                            🪙 Monedas Físicas
                            <span className="text-xs text-gray-500 block">
                              Valor total en monedas
                            </span>
                          </Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            value={
                              userAdjustments[detalle.moneda_id]?.coins || ""
                            }
                            onChange={(e) =>
                              handleUserAdjustment(
                                detalle.moneda_id,
                                "coins",
                                e.target.value
                              )
                            }
                            placeholder="0.00"
                            className={!isValid ? "border-red-300" : ""}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">
                            💰 Total Final Físico
                            <span className="text-xs text-gray-500 block">
                              Billetes + Monedas
                            </span>
                          </Label>
                          <div
                            className={`h-10 px-3 py-2 border rounded-md flex items-center font-bold ${
                              !isValid
                                ? "bg-red-50 border-red-300 text-red-700"
                                : "bg-gray-50"
                            }`}
                          >
                            {userTotal.toFixed(2)}
                            {!isValid && (
                              <span className="ml-2 text-xs">
                                (Diff:{" "}
                                {(userTotal - detalle.saldo_cierre).toFixed(2)})
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}

                <Button
                  onClick={performDailyClose}
                  className="w-full bg-green-600 hover:bg-green-700 text-white py-3"
                  size="lg"
                  disabled={!cuadreData?.detalles.length}
                >
                  Realizar Cierre Diario
                </Button>
              </div>
            )}
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
