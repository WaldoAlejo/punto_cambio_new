import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useConfirmationDialog } from "@/components/ui/confirmation-dialog";
import { toast } from "sonner";
import { PuntoAtencion, VistaSaldosPorPunto } from "../../types";
import { pointService } from "../../services/pointService";
import { saldoInicialService } from "../../services/saldoInicialService";

const SaldoInicialManagement = () => {
  const { showConfirmation, ConfirmationDialog } = useConfirmationDialog();

  // Estados principales
  const [points, setPoints] = useState<PuntoAtencion[]>([]);
  const [vistaSaldos, setVistaSaldos] = useState<VistaSaldosPorPunto[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Estados del filtro de punto
  const [selectedPointId, setSelectedPointId] = useState<string>("");

  // Estados por punto seleccionado
  const [selectedCurrency, setSelectedCurrency] = useState<string>("");
  const [billetes, setBilletes] = useState<string>("");
  const [monedas, setMonedas] = useState<string>("");
  const [loadingAsignacion, setLoadingAsignacion] = useState(false);

  useEffect(() => {
    loadInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadInitialData = async () => {
    try {
      setLoadingData(true);

      const [pointsResponse, vistaSaldosResponse] = await Promise.all([
        pointService.getPointsForBalanceManagement(),
        saldoInicialService.getVistaSaldosPorPunto(),
      ]);

      if (pointsResponse.error) {
        const msg = pointsResponse.error || "Error al cargar puntos";
        console.error("❌ Error en respuesta de puntos:", msg);
        toast.error(`Error al cargar puntos: ${msg}`);
        setPoints([]);
      } else {
        setPoints(pointsResponse.points || []);
      }

      if (vistaSaldosResponse.error) {
        const msg = vistaSaldosResponse.error || "Error al cargar saldos";
        console.error("❌ Error en respuesta de saldos:", msg);
        toast.error(`Error al cargar saldos: ${msg}`);
        setVistaSaldos([]);
      } else {
        setVistaSaldos(vistaSaldosResponse.saldos || []);
      }

      const puntosObtenidos = pointsResponse.points || [];
      if (puntosObtenidos.length > 0 && !selectedPointId) {
        const primerPunto = puntosObtenidos[0];
        setSelectedPointId(primerPunto.id);
      }
    } catch (error) {
      console.error("❌ Error crítico al cargar datos:", error);
      toast.error(
        error instanceof Error ? error.message : "Error al cargar datos"
      );
      setPoints([]);
      setVistaSaldos([]);
    } finally {
      setLoadingData(false);
    }
  };

  // Obtiene el punto seleccionado
  const selectedPoint = points.find((p) => p.id === selectedPointId);

  // Obtiene TODAS las monedas disponibles para el punto seleccionado
  const getMonedasPorPunto = (puntoId: string) => {
    const monedas = vistaSaldos.filter((s) => s.punto_atencion_id === puntoId);
    return monedas;
  };

  // Obtiene el saldo actual para el punto y moneda seleccionada
  const getSaldoActual = (puntoId: string, monedaId: string) => {
    const saldo = vistaSaldos.find(
      (s) => s.punto_atencion_id === puntoId && s.moneda_id === monedaId
    );
    return saldo ? saldo.saldo_actual : 0;
  };

  // Obtiene el símbolo de la moneda seleccionada
  const getMonedaSimbolo = (puntoId: string, monedaId: string) => {
    const saldo = vistaSaldos.find(
      (s) => s.punto_atencion_id === puntoId && s.moneda_id === monedaId
    );
    return saldo ? saldo.moneda_simbolo : "";
  };

  // Obtiene información completa de la moneda seleccionada
  const getMonedaInfo = (puntoId: string, monedaId: string) => {
    return vistaSaldos.find(
      (s) => s.punto_atencion_id === puntoId && s.moneda_id === monedaId
    );
  };

  // Maneja el cambio de punto seleccionado
  const handlePointChange = (pointId: string) => {
    setSelectedPointId(pointId);
    setSelectedCurrency("");
    setBilletes("");
    setMonedas("");
  };

  // Asignar saldo inicial (incremento)
  const handleAsignarSaldo = async () => {
    if (!selectedPointId || !selectedCurrency) {
      toast.error("Seleccione punto y moneda");
      return;
    }

    const billetesNum = Number.parseFloat(billetes || "0");
    const monedasNum = Number.parseFloat(monedas || "0");

    if (
      Number.isNaN(billetesNum) ||
      billetesNum < 0 ||
      Number.isNaN(monedasNum) ||
      monedasNum < 0
    ) {
      toast.error("Billetes/Monedas deben ser números válidos (>= 0)");
      return;
    }

    const cantidadNum = +(billetesNum + monedasNum).toFixed(2);
    if (cantidadNum <= 0) {
      toast.error("El total (billetes + monedas) debe ser mayor a 0");
      return;
    }

    const punto = selectedPoint;
    const monedaInfo = getMonedaInfo(selectedPointId, selectedCurrency);

    if (!punto || !monedaInfo) {
      toast.error("Error: No se encontró información del punto o moneda");
      return;
    }

    showConfirmation(
      "Confirmar asignación de saldo",
      `¿Asignar ${
        monedaInfo.moneda_simbolo
      }${cantidadNum.toLocaleString()} (${billetesNum.toLocaleString()} billetes + ${monedasNum.toLocaleString()} monedas) de ${
        monedaInfo.moneda_nombre
      } al punto "${punto.nombre}"?`,
      async () => {
        setLoadingAsignacion(true);

        // Payload EXACTO para la API (incremento)
        const payload = {
          punto_atencion_id: selectedPointId, // UUID del punto
          moneda_id: selectedCurrency, // UUID de la moneda (value del Select)
          cantidad_inicial: cantidadNum, // total (backend también acepta desglose)
          billetes: billetesNum,
          monedas_fisicas: monedasNum,
        };

        try {
          // Llamada al servicio
          const res = await saldoInicialService.asignarSaldoInicial(payload);

          // Soporta ambos estilos: retorno con error o lanzar throw
          if (res.error) {
            console.error(
              "❌ Error al asignar saldo (respuesta controlada):",
              res.error
            );
            toast.error(res.error);
            return;
          }
          toast.success(
            `✅ Saldo de ${
              monedaInfo.moneda_simbolo
            }${cantidadNum.toLocaleString()} asignado correctamente a ${
              punto.nombre
            }`
          );

          // Limpiar formulario + recargar data
          setBilletes("");
          setMonedas("");
          setSelectedCurrency("");
          await loadInitialData();
        } catch (e: unknown) {
          // Aquí llegan los errores lanzados por apiService con el message del backend
          const msg =
            e instanceof Error
              ? e.message
              : "Error inesperado al asignar saldo";
          console.error("❌ Error al asignar saldo (throw):", e);
          toast.error(msg);
        } finally {
          setLoadingAsignacion(false);
        }
      }
    );
  };

  // Monedas del punto seleccionado
  const monedasDelPuntoSeleccionado = selectedPointId
    ? getMonedasPorPunto(selectedPointId)
    : [];

  if (loadingData) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
            💱 Gestión de Saldos de Divisas
          </h1>
        </div>
        <div className="text-center py-12">
          <div className="text-gray-400 text-6xl mb-4">⏳</div>
          <h3 className="text-lg font-semibold text-gray-600 mb-2">
            Cargando datos...
          </h3>
          <p className="text-gray-500">
            Obteniendo puntos de atención y saldos de divisas
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
          💱 Gestión de Saldos de Divisas
        </h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadInitialData}
            className="text-xs"
          >
            🔄 Actualizar
          </Button>
          <div className="text-sm text-gray-500 px-2 py-1 bg-gray-100 rounded">
            {points.length} puntos disponibles
          </div>
        </div>
      </div>

      {/* Filtro de Punto de Atención */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            📍 Seleccionar Punto de Atención
          </CardTitle>
        </CardHeader>
        <CardContent>
          {points.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-gray-400 text-4xl mb-4">📍</div>
              <h3 className="text-lg font-semibold text-gray-600 mb-2">
                No se encontraron puntos de atención
              </h3>
              <p className="text-gray-500 mb-4">
                Verifica que existan puntos de atención activos en el sistema
              </p>
              <Button variant="outline" onClick={loadInitialData}>
                🔄 Recargar puntos
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium text-gray-700">
                  Punto de Atención
                </Label>
                <Select
                  value={selectedPointId}
                  onValueChange={handlePointChange}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Seleccione un punto de atención" />
                  </SelectTrigger>
                  <SelectContent>
                    {points.map((point) => (
                      <SelectItem key={point.id} value={point.id}>
                        {point.nombre} - {point.ciudad}, {point.provincia}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedPoint && (
                <div className="p-4 bg-blue-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-blue-600 font-semibold">
                      📍 {selectedPoint.nombre}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600">
                    <p>📍 {selectedPoint.direccion}</p>
                    <p>
                      🏙️ {selectedPoint.ciudad}, {selectedPoint.provincia}
                    </p>
                    {selectedPoint.telefono && (
                      <p>📞 {selectedPoint.telefono}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Panel de Gestión de Saldos */}
      {selectedPointId && selectedPoint && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              💰 Gestión de Saldos - {selectedPoint.nombre}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Monedas Disponibles */}
            {monedasDelPuntoSeleccionado.length > 0 && (
              <div>
                <Label className="text-sm font-medium text-gray-700 mb-3 block">
                  💱 Monedas Disponibles ({monedasDelPuntoSeleccionado.length})
                </Label>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {monedasDelPuntoSeleccionado.map((saldo) => (
                    <div
                      key={saldo.moneda_id}
                      className="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg"
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <span className="font-semibold text-blue-800">
                            {saldo.moneda_codigo}
                          </span>
                          <p className="text-xs text-gray-600">
                            {saldo.moneda_nombre}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-green-700">
                            {saldo.moneda_simbolo}
                            {saldo.saldo_actual.toLocaleString()}
                          </span>
                          <p className="text-xs text-gray-500">Saldo actual</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Formulario de Asignación */}
            <div className="border-t pt-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">
                ➕ Asignar Nuevo Saldo
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Selector de Moneda */}
                <div>
                  <Label className="text-sm font-medium text-gray-700">
                    Moneda
                  </Label>
                  <Select
                    value={selectedCurrency}
                    onValueChange={setSelectedCurrency}
                    disabled={monedasDelPuntoSeleccionado.length === 0}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue
                        placeholder={
                          monedasDelPuntoSeleccionado.length === 0
                            ? "No hay monedas disponibles"
                            : "Seleccionar moneda"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {monedasDelPuntoSeleccionado.map((saldo) => (
                        <SelectItem
                          key={saldo.moneda_id}
                          value={saldo.moneda_id} // UUID de moneda
                        >
                          {saldo.moneda_codigo} - {saldo.moneda_nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Inputs: Billetes y Monedas */}
                <div>
                  <Label className="text-sm font-medium text-gray-700">
                    Billetes
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={billetes}
                    onChange={(e) => setBilletes(e.target.value)}
                    placeholder="0.00"
                    className="mt-1"
                    disabled={!selectedCurrency}
                    inputMode="decimal"
                  />
                </div>

                <div>
                  <Label className="text-sm font-medium text-gray-700">
                    Monedas
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={monedas}
                    onChange={(e) => setMonedas(e.target.value)}
                    placeholder="0.00"
                    className="mt-1"
                    disabled={!selectedCurrency}
                    inputMode="decimal"
                  />
                </div>

                {/* Botón de Asignación */}
                <div className="flex items-end">
                  <Button
                    onClick={handleAsignarSaldo}
                    disabled={
                      loadingAsignacion ||
                      !selectedCurrency ||
                      Number.parseFloat(billetes || "0") +
                        Number.parseFloat(monedas || "0") <=
                        0
                    }
                    className="w-full"
                  >
                    {loadingAsignacion ? (
                      <>
                        <span className="animate-spin mr-2">⏳</span>
                        Asignando...
                      </>
                    ) : (
                      <>💰 Asignar Saldo</>
                    )}
                  </Button>
                </div>
              </div>

              {/* Información del Saldo Actual */}
              {selectedCurrency && (
                <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700">
                      Saldo actual de{" "}
                      {
                        getMonedaInfo(selectedPointId, selectedCurrency)
                          ?.moneda_nombre
                      }
                      :
                    </span>
                    <span className="font-bold text-green-700 text-lg">
                      {getMonedaSimbolo(selectedPointId, selectedCurrency)}
                      {getSaldoActual(
                        selectedPointId,
                        selectedCurrency
                      ).toLocaleString()}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Mensaje cuando no hay monedas */}
            {monedasDelPuntoSeleccionado.length === 0 && (
              <div className="text-center py-8">
                <div className="text-gray-400 text-4xl mb-4">💱</div>
                <h3 className="text-lg font-semibold text-gray-600 mb-2">
                  No hay monedas configuradas
                </h3>
                <p className="text-gray-500">
                  Este punto de atención no tiene monedas configuradas para
                  gestionar saldos
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Diálogo de confirmación */}
      <ConfirmationDialog />
    </div>
  );
};

export default SaldoInicialManagement;
