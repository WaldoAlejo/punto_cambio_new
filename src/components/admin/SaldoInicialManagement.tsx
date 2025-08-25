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
import { toast } from "sonner";
import { PuntoAtencion, Moneda, VistaSaldosPorPunto } from "../../types";
import { pointService } from "../../services/pointService";
import { currencyService } from "../../services/currencyService";
import { saldoInicialService } from "../../services/saldoInicialService";

const SaldoInicialManagement = () => {
  const [points, setPoints] = useState<PuntoAtencion[]>([]);
  const [vistaSaldos, setVistaSaldos] = useState<VistaSaldosPorPunto[]>([]);
  const [selectedCurrencyByPoint, setSelectedCurrencyByPoint] = useState<Record<string, string>>({});
  const [cantidadByPoint, setCantidadByPoint] = useState<Record<string, string>>({});
  const [loadingByPoint, setLoadingByPoint] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      const [pointsResponse, vistaSaldosResponse] = await Promise.all([
        pointService.getAllPoints(),
        saldoInicialService.getVistaSaldosPorPunto(),
      ]);
      setPoints(pointsResponse.points || []);
      setVistaSaldos(vistaSaldosResponse.saldos || []);
    } catch (error) {
      toast.error("Error al cargar datos");
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

    setLoadingByPoint((prev) => ({ ...prev, [puntoId]: true }));

    try {
      const response = await saldoInicialService.asignarSaldoInicial({
        punto_atencion_id: puntoId,
        moneda_id: monedaId,
        cantidad_inicial: cantidadNum,
      });

      if (response.error) {
        toast.error(`Error: ${response.error}`);
      } else {
        toast.success("Saldo asignado correctamente");
        setCantidadByPoint((prev) => ({ ...prev, [puntoId]: "" }));
        loadInitialData();
      }
    } catch (error) {
      toast.error("Error inesperado al asignar saldo");
    } finally {
      setLoadingByPoint((prev) => ({ ...prev, [puntoId]: false }));
    }
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-gray-800 mb-4">
        Gestión de Saldos Iniciales
      </h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {points.map((point) => {
          const monedasDelPunto = getMonedasPorPunto(point.id);
          return (
            <div key={point.id} className="border rounded-lg p-6 bg-white shadow-sm space-y-4">
              <div className="mb-2">
                <span className="font-semibold text-lg">{point.nombre}</span>
                <span className="ml-2 text-gray-500">{point.ciudad}</span>
              </div>
              <div>
                <Label>Moneda</Label>
                <Select
                  value={selectedCurrencyByPoint[point.id] || ""}
                  onValueChange={(value) =>
                    setSelectedCurrencyByPoint((prev) => ({
                      ...prev,
                      [point.id]: value,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar moneda" />
                  </SelectTrigger>
                  <SelectContent>
                    {monedasDelPunto.map((saldo) => (
                      <SelectItem key={saldo.moneda_id} value={saldo.moneda_id}>
                        {saldo.moneda_codigo} - {saldo.moneda_nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedCurrencyByPoint[point.id] && (
                <div>
                  <Label>Saldo Actual</Label>
                  <div className="font-semibold text-blue-700 mb-2">
                    {getMonedaSimbolo(point.id, selectedCurrencyByPoint[point.id])}
                    {getSaldoActual(point.id, selectedCurrencyByPoint[point.id])}
                  </div>
                  <Label>Asignar Saldo Inicial</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={cantidadByPoint[point.id] || ""}
                    onChange={(e) =>
                      setCantidadByPoint((prev) => ({
                        ...prev,
                        [point.id]: e.target.value,
                      }))
                    }
                    placeholder="0.00"
                  />
                  <Button
                    className="mt-2 w-full"
                    onClick={() => handleAsignarSaldo(point.id)}
                    disabled={loadingByPoint[point.id]}
                  >
                    {loadingByPoint[point.id] ? "Asignando..." : "Asignar Saldo"}
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default SaldoInicialManagement;
