import { useState, useEffect } from "react";
import { User, PuntoAtencion, Moneda, Transferencia } from "../../types";
import { toast } from "@/hooks/use-toast";
import { apiService } from "../../services/apiService";
import { transferService } from "../../services/transferService";
import { useAuth } from "@/hooks/useAuth";
import TransferForm from "./TransferForm";
import TransferList from "./TransferList";

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
            apiService.get<ApiResponse>("/points"),
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

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando transferencias...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">
          Gestión de Transferencias
        </h1>
        <div className="text-sm text-gray-500">
          {selectedPoint
            ? `Punto: ${selectedPoint.nombre}`
            : "Panel Administrativo"}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
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
        />
      </div>
    </div>
  );
};

export default TransferManagement;
