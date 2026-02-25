import { useState, useEffect } from "react";
import { User, PuntoAtencion, Moneda, Transferencia } from "../../types";
import { toast } from "@/hooks/use-toast";
import { apiService } from "../../services/apiService";
import { transferService } from "../../services/transferService";
import { useAuth } from "@/hooks/useAuth";
import { pointService } from "../../services/pointService";
import TransferForm from "./TransferForm";
import TransferList from "./TransferList";
import { Loader2 } from "lucide-react";

interface TransferManagementProps {
  user: User;
}

interface ApiResponse {
  transfers?: Transferencia[];
  currencies?: Moneda[];
  points?: PuntoAtencion[];
  success?: boolean;
  error?: string;
}

const TransferManagement = ({ user }: TransferManagementProps) => {
  const [transfers, setTransfers] = useState<Transferencia[]>([]);
  const [currencies, setCurrencies] = useState<Moneda[]>([]);
  const [points, setPoints] = useState<PuntoAtencion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCancelling, setIsCancelling] = useState(false);

  // Para encontrar el punto seleccionado, usar el contexto de autenticación
  const { selectedPoint } = useAuth();

  // Refresca solo transferencias
  const fetchTransfers = async () => {
    try {
      const { transfers: updatedTransfers } =
        await transferService.getAllTransfers();
      setTransfers(updatedTransfers || []);
    } catch {
      toast({
        title: "Error",
        description: "Error al recargar las transferencias",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);

        const [transfersResponse, currenciesResponse, pointsResponse] =
          await Promise.all([
            transferService.getAllTransfers(),
            apiService.get<ApiResponse>("/currencies"),
            pointService.getActivePointsForTransfers(),
          ]);

        setTransfers(transfersResponse.transfers || []);
        setCurrencies(currenciesResponse.currencies || []);
        setPoints(pointsResponse.points || []);
      } catch {
        toast({
          title: "Error",
          description: "Error al cargar los datos de transferencias",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
    const interval = setInterval(fetchTransfers, 30000); // Aumentado a 30 segundos
    return () => clearInterval(interval);
  }, []); // Solo al montar

  const handleTransferCreated = async () => {
    await fetchTransfers();
    toast({
      title: "✅ Transferencia creada",
      description:
        "Transferencia creada exitosamente y guardada en la base de datos",
    });
  };

  const handleTransferApproved = async (transferId: string) => {
    try {
      const { error } = await transferService.approveTransfer(transferId);
      if (error) {
        toast({
          title: "Error",
          description: error,
          variant: "destructive",
        });
        return;
      }
      await fetchTransfers();

      toast({
        title: "✅ Transferencia aprobada",
        description: "La transferencia ha sido aprobada exitosamente",
      });

      // Disparar evento para actualizar saldos
      window.dispatchEvent(new CustomEvent("transferApproved"));
    } catch {
      toast({
        title: "Error",
        description: "Error al aprobar la transferencia",
        variant: "destructive",
      });
    }
  };

  const handleTransferCancelled = async (transferId: string) => {
    try {
      setIsCancelling(true);
      const { error } = await transferService.cancelTransfer(
        transferId,
        "Anulada por el solicitante"
      );
      if (error) {
        toast({
          title: "Error",
          description: error,
          variant: "destructive",
        });
        return;
      }
      await fetchTransfers();

      toast({
        title: "✅ Transferencia anulada",
        description: "La transferencia ha sido anulada exitosamente. El monto ha sido devuelto al punto de origen.",
      });

      // Disparar evento para actualizar saldos
      window.dispatchEvent(new CustomEvent("transferCancelled"));
    } catch {
      toast({
        title: "Error",
        description: "Error al anular la transferencia",
        variant: "destructive",
      });
    } finally {
      setIsCancelling(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-3 sm:p-6">
        <div className="text-center py-8 sm:py-12">
          <div className="animate-spin rounded-full h-16 w-16 sm:h-32 sm:w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-3 sm:mt-4 text-sm sm:text-base text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6">
      {/* Header Responsive */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-800">
          Transferencias
        </h1>
        <div className="text-xs sm:text-sm text-gray-500">
          {selectedPoint
            ? `Punto: ${selectedPoint.nombre}`
            : "Panel Admin"}
        </div>
      </div>

      {/* Grid Responsive */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <TransferForm
          user={user}
          selectedPoint={selectedPoint}
          onTransferCreated={handleTransferCreated}
          onCancel={() => {}}
        />
        <TransferList
          user={user}
          selectedPoint={selectedPoint}
          transfers={transfers}
          currencies={currencies}
          points={points}
          onTransferApproved={handleTransferApproved}
          onTransferCancelled={handleTransferCancelled}
        />
      </div>
    </div>
  );
};

export default TransferManagement;
