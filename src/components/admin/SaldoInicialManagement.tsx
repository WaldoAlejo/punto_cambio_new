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
  const [cantidad, setCantidad] = useState<string>("");
  const [loadingAsignacion, setLoadingAsignacion] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setLoadingData(true);
      console.log("🔍 SaldoInicialManagement: Iniciando carga de datos...");

      const [pointsResponse, vistaSaldosResponse] = await Promise.all([
        pointService.getPointsForBalanceManagement(),
        saldoInicialService.getVistaSaldosPorPunto(),
      ]);

      console.log(
        "📍 SaldoInicialManagement - Respuesta de puntos:",
        pointsResponse
      );
      console.log(
        "💰 SaldoInicialManagement - Respuesta de saldos:",
        vistaSaldosResponse
      );

      // Validar respuestas
      if (pointsResponse.error) {
        console.error("❌ Error en respuesta de puntos:", pointsResponse.error);
        toast.error(`Error al cargar puntos: ${pointsResponse.error}`);
        return;
      }

      if (vistaSaldosResponse.error) {
        console.error(
          "❌ Error en respuesta de saldos:",
          vistaSaldosResponse.error
        );
        toast.error(`Error al cargar saldos: ${vistaSaldosResponse.error}`);
      }

      const puntosObtenidos = pointsResponse.points || [];
      const saldosObtenidos = vistaSaldosResponse.saldos || [];

      console.log(
        `📍 SaldoInicialManagement - Puntos cargados: ${puntosObtenidos.length}`
      );
      puntosObtenidos.forEach((punto, index) => {
        console.log(
          `  ${index + 1}. ${punto.nombre} - ${punto.ciudad}, ${
            punto.provincia
          } (ID: ${punto.id})`
        );
      });

      console.log(
        `💰 SaldoInicialManagement - Saldos cargados: ${saldosObtenidos.length}`
      );
      saldosObtenidos.forEach((saldo, index) => {
        console.log(
          `  ${index + 1}. Punto: ${saldo.punto_nombre} | Moneda: ${
            saldo.moneda_codigo
          } | Saldo: ${saldo.moneda_simbolo}${saldo.saldo_actual}`
        );
      });

      setPoints(puntosObtenidos);
      setVistaSaldos(saldosObtenidos);

      // Auto-seleccionar el primer punto si no hay uno seleccionado
      if (puntosObtenidos.length > 0 && !selectedPointId) {
        const primerPunto = puntosObtenidos[0];
        console.log(
          `🎯 Auto-seleccionando primer punto: ${primerPunto.nombre} (${primerPunto.id})`
        );
        setSelectedPointId(primerPunto.id);
      }

      console.log("✅ SaldoInicialManagement - Carga de datos completada");
    } catch (error) {
      console.error(
        "❌ SaldoInicialManagement - Error crítico al cargar datos:",
        error
      );
      toast.error("Error al cargar datos");
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
    console.log(
      `💱 Monedas disponibles para punto ${puntoId}:`,
      monedas.length,
      monedas.map(
        (m) => `${m.moneda_codigo} (${m.moneda_simbolo}${m.saldo_actual})`
      )
    );
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
    console.log(`🎯 Cambiando a punto: ${pointId}`);
    setSelectedPointId(pointId);
    setSelectedCurrency("");
    setCantidad("");

    const punto = points.find((p) => p.id === pointId);
    if (punto) {
      console.log(
        `📍 Punto seleccionado: ${punto.nombre} - ${punto.ciudad}, ${punto.provincia}`
      );
      const monedas = getMonedasPorPunto(pointId);
      console.log(
        `💱 Monedas disponibles para ${punto.nombre}: ${monedas.length}`
      );
    }
  };

  // Asignar saldo inicial
  const handleAsignarSaldo = async () => {
    if (!selectedPointId || !selectedCurrency || !cantidad) {
      toast.error("Seleccione punto, moneda y cantidad");
      return;
    }

    const cantidadNum = parseFloat(cantidad);
    if (isNaN(cantidadNum) || cantidadNum <= 0) {
      toast.error("La cantidad debe ser un número positivo");
      return;
    }

    const punto = selectedPoint;
    const monedaInfo = getMonedaInfo(selectedPointId, selectedCurrency);

    if (!punto || !monedaInfo) {
      toast.error("Error: No se encontró información del punto o moneda");
      return;
    }

    showConfirmation(
      "Confirmar asignación de saldo inicial",
      `¿Está seguro de asignar ${
        monedaInfo.moneda_simbolo
      }${cantidadNum.toLocaleString()} de ${
        monedaInfo.moneda_nombre
      } al punto "${punto.nombre}"?`,
      async () => {
        setLoadingAsignacion(true);

        try {
          console.log(
            `💰 SaldoInicialManagement - Asignando saldo: ${cantidadNum} ${monedaInfo.moneda_codigo} al punto ${punto.nombre} (${punto.id})`
          );

          const response = await saldoInicialService.asignarSaldoInicial({
            punto_atencion_id: selectedPointId,
            moneda_id: selectedCurrency,
            cantidad_inicial: cantidadNum,
          });

          console.log(
            "📋 SaldoInicialManagement - Respuesta de asignación:",
            response
          );

          if (response.error) {
            console.error("❌ Error al asignar saldo:", response.error);
            toast.error(`Error: ${response.error}`);
          } else {
            console.log("✅ Saldo asignado correctamente:", response.saldo);
            toast.success(
              `✅ Saldo de ${
                monedaInfo.moneda_simbolo
              }${cantidadNum.toLocaleString()} asignado correctamente a ${
                punto.nombre
              }`
            );

            // Limpiar formulario
            setCantidad("");
            setSelectedCurrency("");

            // Recargar datos
            await loadInitialData();
          }
        } catch (error) {
          console.error(
            "❌ SaldoInicialManagement - Error inesperado al asignar saldo:",
            error
          );
          toast.error("Error inesperado al asignar saldo");
        } finally {
          setLoadingAsignacion(false);
        }
      }
    );
  };

  // Obtener monedas del punto seleccionado
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
                          value={saldo.moneda_id}
                        >
                          {saldo.moneda_codigo} - {saldo.moneda_nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Input de Cantidad */}
                <div>
                  <Label className="text-sm font-medium text-gray-700">
                    Cantidad
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={cantidad}
                    onChange={(e) => setCantidad(e.target.value)}
                    placeholder="0.00"
                    className="mt-1"
                    disabled={!selectedCurrency}
                  />
                </div>

                {/* Botón de Asignación */}
                <div className="flex items-end">
                  <Button
                    onClick={handleAsignarSaldo}
                    disabled={
                      loadingAsignacion ||
                      !selectedCurrency ||
                      !cantidad.trim() ||
                      parseFloat(cantidad) <= 0
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
