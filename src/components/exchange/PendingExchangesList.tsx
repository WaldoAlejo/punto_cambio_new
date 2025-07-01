import React, { useEffect, useState, useCallback } from "react";
import { CambioDivisa, PuntoAtencion, User } from "../../types";
import { exchangeService } from "../../services/exchangeService";
import { ReceiptService } from "../../services/receiptService";
import { toast } from "@/hooks/use-toast";

interface PendingExchangesListProps {
  user: User;
  selectedPoint: PuntoAtencion | null;
  onCloseSuccess?: () => void;
}

const PendingExchangesList: React.FC<PendingExchangesListProps> = ({
  user,
  selectedPoint,
  onCloseSuccess,
}) => {
  const [pendingExchanges, setPendingExchanges] = useState<CambioDivisa[]>([]);
  const [loading, setLoading] = useState(false);

  const loadPendingExchanges = useCallback(async () => {
    if (!selectedPoint) return;
    setLoading(true);
    const { exchanges, error } =
      await exchangeService.getPendingExchangesByPoint(selectedPoint.id);
    if (error) {
      toast({
        title: "Error",
        description: error,
        variant: "destructive",
      });
      setPendingExchanges([]);
    } else {
      setPendingExchanges(exchanges);
    }
    setLoading(false);
  }, [selectedPoint]);

  useEffect(() => {
    loadPendingExchanges();
  }, [loadPendingExchanges]);

  const handleCloseExchange = async (exchangeId: string) => {
    if (!user) return;
    setLoading(true);
    const { exchange, error } = await exchangeService.closePendingExchange(
      exchangeId
    );
    if (error) {
      toast({
        title: "Error",
        description: error,
        variant: "destructive",
      });
      setLoading(false);
      return;
    }
    toast({
      title: "Cambio cerrado",
      description: `Cambio ${exchange?.numero_recibo} cerrado con éxito`,
    });

    if (exchange) {
      const receiptData = ReceiptService.generateCurrencyExchangeReceipt(
        exchange,
        selectedPoint?.nombre || "N/A",
        user.nombre
      );
      try {
        ReceiptService.printReceipt(receiptData, 2);
      } catch {
        toast({
          title: "Advertencia",
          description:
            "El recibo se generó pero hubo un problema con la impresión",
          variant: "default",
        });
      }
    }

    await loadPendingExchanges();
    setLoading(false);

    if (onCloseSuccess) onCloseSuccess();
  };

  if (!selectedPoint) {
    return (
      <div className="p-4 text-center">
        Seleccione un punto para ver cambios pendientes.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-4 text-center">Cargando cambios pendientes...</div>
    );
  }

  if (pendingExchanges.length === 0) {
    return (
      <div className="p-4 text-center">
        No hay cambios pendientes en este punto.
      </div>
    );
  }

  return (
    <div className="p-4">
      <h2 className="mb-4 font-semibold text-lg">Cambios Pendientes</h2>
      <ul>
        {pendingExchanges.map((exchange) => (
          <li
            key={exchange.id}
            className="mb-3 p-3 border rounded flex justify-between items-center"
          >
            <div>
              <div>
                <strong>Recibo:</strong> {exchange.numero_recibo}
              </div>
              <div>
                <strong>Cliente:</strong> {exchange.datos_cliente?.nombre}{" "}
                {exchange.datos_cliente?.apellido}
              </div>
              <div>
                <strong>Monto Origen:</strong> {exchange.monto_origen}{" "}
                {exchange.monedaOrigen?.codigo}
              </div>
              <div>
                <strong>Monto Destino:</strong> {exchange.monto_destino}{" "}
                {exchange.monedaDestino?.codigo}
              </div>
              <div>
                <strong>Fecha:</strong>{" "}
                {new Date(exchange.fecha).toLocaleString()}
              </div>
            </div>
            <button
              disabled={loading}
              onClick={() => handleCloseExchange(exchange.id)}
              className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 disabled:opacity-50"
            >
              Cerrar Cambio
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default PendingExchangesList;
