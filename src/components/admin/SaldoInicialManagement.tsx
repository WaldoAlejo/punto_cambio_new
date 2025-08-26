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

  const [points, setPoints] = useState<PuntoAtencion[]>([]);
  const [vistaSaldos, setVistaSaldos] = useState<VistaSaldosPorPunto[]>([]);
  const [selectedCurrencyByPoint, setSelectedCurrencyByPoint] = useState<
    Record<string, string>
  >({});
  const [cantidadByPoint, setCantidadByPoint] = useState<
    Record<string, string>
  >({});
  const [loadingByPoint, setLoadingByPoint] = useState<Record<string, boolean>>(
    {}
  );
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setLoadingData(true);
      console.log("🔍 Cargando datos iniciales...");

      const [pointsResponse, vistaSaldosResponse] = await Promise.all([
        pointService.getAllPoints(),
        saldoInicialService.getVistaSaldosPorPunto(),
      ]);

      console.log("📍 Respuesta de puntos:", pointsResponse);
      console.log("💰 Respuesta de saldos:", vistaSaldosResponse);

      const puntosObtenidos = pointsResponse.points || [];
      const saldosObtenidos = vistaSaldosResponse.saldos || [];

      console.log(
        `📍 Puntos cargados: ${puntosObtenidos.length}`,
        puntosObtenidos
      );
      console.log(
        `💰 Saldos cargados: ${saldosObtenidos.length}`,
        saldosObtenidos
      );

      setPoints(puntosObtenidos);
      setVistaSaldos(saldosObtenidos);

      if (pointsResponse.error) {
        toast.error(`Error al cargar puntos: ${pointsResponse.error}`);
      }
      if (vistaSaldosResponse.error) {
        toast.error(`Error al cargar saldos: ${vistaSaldosResponse.error}`);
      }
    } catch (error) {
      console.error("❌ Error al cargar datos:", error);
      toast.error("Error al cargar datos");
    } finally {
      setLoadingData(false);
    }
  };

  // Filtra las monedas que tienen saldo para cada punto
  const getMonedasPorPunto = (puntoId: string) =>
    vistaSaldos.filter((s) => s.punto_atencion_id === puntoId);

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

  // Asignar saldo inicial
  const handleAsignarSaldo = async (puntoId: string) => {
    const monedaId = selectedCurrencyByPoint[puntoId];
    const cantidad = cantidadByPoint[puntoId];

    if (!monedaId || !cantidad) {
      toast.error("Seleccione moneda y cantidad");
      return;
    }

    const cantidadNum = parseFloat(cantidad);
    if (isNaN(cantidadNum) || cantidadNum <= 0) {
      toast.error("La cantidad debe ser un número positivo");
      return;
    }

    const punto = points.find((p) => p.id === puntoId);
    const monedaInfo = vistaSaldos.find(
      (s) => s.punto_atencion_id === puntoId && s.moneda_id === monedaId
    );

    showConfirmation(
      "Confirmar asignación de saldo",
      `¿Está seguro de asignar ${
        monedaInfo?.moneda_simbolo || ""
      }${cantidadNum.toLocaleString()} al punto "${punto?.nombre}"?`,
      async () => {
        setLoadingByPoint((prev) => ({ ...prev, [puntoId]: true }));

        try {
          console.log(
            `💰 Asignando saldo: ${cantidadNum} ${monedaInfo?.moneda_codigo} al punto ${punto?.nombre}`
          );

          const response = await saldoInicialService.asignarSaldoInicial({
            punto_atencion_id: puntoId,
            moneda_id: monedaId,
            cantidad_inicial: cantidadNum,
          });

          if (response.error) {
            console.error("❌ Error al asignar saldo:", response.error);
            toast.error(`Error: ${response.error}`);
          } else {
            console.log("✅ Saldo asignado correctamente:", response.saldo);
            toast.success(
              `✅ Saldo de ${
                monedaInfo?.moneda_simbolo || ""
              }${cantidadNum.toLocaleString()} asignado correctamente a ${
                punto?.nombre
              }`
            );
            setCantidadByPoint((prev) => ({ ...prev, [puntoId]: "" }));
            loadInitialData();
          }
        } catch (error) {
          console.error("❌ Error inesperado al asignar saldo:", error);
          toast.error("Error inesperado al asignar saldo");
        } finally {
          setLoadingByPoint((prev) => ({ ...prev, [puntoId]: false }));
        }
      }
    );
  };

  // Supón que recibes el punto de atención de la sesión por props o contexto
  const puntoSesionId = "ID_DEL_PUNTO_NORTE"; // Reemplaza por tu lógica real

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
      <div className="flex justify-between items-center mb-4">
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
            {points.length} puntos cargados
          </div>
        </div>
      </div>

      {/* Grid de puntos de atención */}
      {points.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-gray-400 text-6xl mb-4">📍</div>
          <h3 className="text-lg font-semibold text-gray-600 mb-2">
            No se encontraron puntos de atención
          </h3>
          <p className="text-gray-500 mb-4">
            Verifica que existan puntos de atención activos en el sistema
          </p>
          <Button
            variant="outline"
            onClick={loadInitialData}
            className="mx-auto"
          >
            🔄 Recargar puntos
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {points.map((point) => {
            const monedasDelPunto = getMonedasPorPunto(point.id);
            const esPuntoSesion = point.id === puntoSesionId;
            const selectedCurrency = selectedCurrencyByPoint[point.id];
            const cantidadInput = cantidadByPoint[point.id] || "";
            const isLoading = loadingByPoint[point.id] || false;

            return (
              <div
                key={point.id}
                className="border rounded-lg p-6 bg-white shadow-sm space-y-4"
              >
                <div className="mb-2">
                  <span className="font-semibold text-lg">{point.nombre}</span>
                  <span className="ml-2 text-gray-500">
                    {point.ciudad}, {point.provincia}
                  </span>
                  {esPuntoSesion && (
                    <span className="ml-2 text-red-500 font-semibold text-xs bg-red-100 px-2 py-1 rounded-full">
                      Sesión actual
                    </span>
                  )}
                </div>

                {/* Información de monedas disponibles */}
                {monedasDelPunto.length > 0 && (
                  <div className="mb-4">
                    <Label className="text-sm font-medium text-gray-600 mb-2 block">
                      Monedas disponibles ({monedasDelPunto.length})
                    </Label>
                    <div className="flex flex-wrap gap-2">
                      {monedasDelPunto.map((saldo) => (
                        <div
                          key={saldo.moneda_id}
                          className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full"
                        >
                          {saldo.moneda_codigo}: {saldo.moneda_simbolo}
                          {saldo.saldo_actual}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {/* Selector de moneda */}
                <div>
                  <Label className="text-sm font-medium text-gray-600">
                    Seleccionar Moneda
                  </Label>
                  <Select
                    value={selectedCurrency || ""}
                    onValueChange={(value) =>
                      setSelectedCurrencyByPoint((prev) => ({
                        ...prev,
                        [point.id]: value,
                      }))
                    }
                    disabled={esPuntoSesion || monedasDelPunto.length === 0}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue
                        placeholder={
                          monedasDelPunto.length === 0
                            ? "No hay monedas disponibles"
                            : "Seleccionar moneda"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {monedasDelPunto.map((saldo) => (
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

                {/* Saldo actual y asignación */}
                {selectedCurrency && (
                  <>
                    <div>
                      <Label className="text-sm font-medium text-gray-600">
                        Saldo Actual
                      </Label>
                      <div className="font-semibold text-lg text-green-700 mb-2">
                        {getMonedaSimbolo(point.id, selectedCurrency)}
                        {getSaldoActual(
                          point.id,
                          selectedCurrency
                        ).toLocaleString()}
                      </div>
                    </div>

                    {/* Asignación de saldo */}
                    <div>
                      <Label className="text-sm font-medium text-gray-600">
                        Asignar Saldo Inicial
                      </Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={cantidadInput}
                        onChange={(e) =>
                          setCantidadByPoint((prev) => ({
                            ...prev,
                            [point.id]: e.target.value,
                          }))
                        }
                        placeholder="0.00"
                        disabled={esPuntoSesion}
                        className="mt-1"
                      />
                    </div>

                    <Button
                      className="w-full"
                      onClick={() => handleAsignarSaldo(point.id)}
                      disabled={
                        isLoading || esPuntoSesion || !cantidadInput.trim()
                      }
                    >
                      {esPuntoSesion
                        ? "🚫 No puedes asignar saldo aquí"
                        : isLoading
                        ? "⏳ Asignando..."
                        : "💰 Asignar Saldo"}
                    </Button>
                  </>
                )}

                {/* Mensaje cuando no hay monedas */}
                {monedasDelPunto.length === 0 && (
                  <div className="text-center py-4 text-gray-500">
                    <div className="text-2xl mb-2">💱</div>
                    <p className="text-sm">
                      No hay monedas configuradas para este punto
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Diálogo de confirmación */}
      <ConfirmationDialog />
    </div>
  );
};

export default SaldoInicialManagement;
