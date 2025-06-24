import { useState, useEffect } from 'react';
import { User, PuntoAtencion, Moneda, Transferencia } from '../../types';
import { toast } from "@/hooks/use-toast";
import { apiService } from '../../services/apiService';
import { transferService } from '../../services/transferService';
import TransferForm from './TransferForm';
import TransferList from './TransferList';

interface TransferManagementProps {
  user: User;
  selectedPoint: PuntoAtencion | null;
}

interface ApiResponse {
  transfers?: Transferencia[];
  currencies?: Moneda[];
  points?: PuntoAtencion[];
  success?: boolean;
  error?: string;
}

const TransferManagement = ({ user, selectedPoint }: TransferManagementProps) => {
  const [transfers, setTransfers] = useState<Transferencia[]>([]);
  const [currencies, setCurrencies] = useState<Moneda[]>([]);
  const [points, setPoints] = useState<PuntoAtencion[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        console.warn('Cargando datos de transferencias...');
        
        // Cargar datos reales desde la API
        const [transfersResponse, currenciesResponse, pointsResponse] = await Promise.all([
          transferService.getAllTransfers(),
          apiService.get<ApiResponse>('/currencies'),
          apiService.get<ApiResponse>('/points')
        ]);

        console.warn('Respuestas obtenidas:', {
          transfers: transfersResponse,
          currencies: currenciesResponse,
          points: pointsResponse
        });

        if (transfersResponse.transfers) {
          console.warn(`Cargando ${transfersResponse.transfers.length} transferencias`);
          setTransfers(transfersResponse.transfers);
        } else if (transfersResponse.error) {
          console.error('Error cargando transferencias:', transfersResponse.error);
          toast({
            title: "Error",
            description: transfersResponse.error,
            variant: "destructive"
          });
        }

        if (currenciesResponse && currenciesResponse.currencies) {
          setCurrencies(currenciesResponse.currencies);
        }

        if (pointsResponse && pointsResponse.points) {
          // Incluir todos los puntos para las transferencias
          setPoints(pointsResponse.points);
        }
        
      } catch (error) {
        console.error('Error loading transfer data:', error);
        toast({
          title: "Error",
          description: "Error al cargar los datos de transferencias",
          variant: "destructive"
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [selectedPoint]);

  const handleTransferCreated = async (transfer: Transferencia) => {
    try {
      console.warn('Nueva transferencia creada:', transfer);
      
      // Actualizar la lista local inmediatamente
      setTransfers(prev => [transfer, ...prev]);
      
      // Recargar todas las transferencias para asegurar sincronización
      const { transfers: updatedTransfers, error } = await transferService.getAllTransfers();
      if (updatedTransfers && !error) {
        setTransfers(updatedTransfers);
      }
      
      toast({
        title: "✅ Transferencia creada",
        description: `Transferencia de ${transfer.monto} creada exitosamente y guardada en la base de datos`,
      });
    } catch (error) {
      console.error('Error processing transfer creation:', error);
      toast({
        title: "Error",
        description: "Error al procesar la transferencia",
        variant: "destructive"
      });
    }
  };

  const handleTransferApproved = async (transferId: string) => {
    try {
      console.warn('Aprobando transferencia:', transferId);
      
      // Aprobar la transferencia usando el servicio
      const { transfer: approvedTransfer, error } = await transferService.approveTransfer(transferId);
      
      if (error) {
        toast({
          title: "Error",
          description: error,
          variant: "destructive"
        });
        return;
      }

      if (approvedTransfer) {
        // Actualizar la lista local
        setTransfers(prev => prev.map(t => 
          t.id === transferId 
            ? { ...approvedTransfer, estado: 'APROBADO', aprobado_por: user.id }
            : t
        ));
        
        toast({
          title: "✅ Transferencia aprobada",
          description: "La transferencia ha sido aprobada exitosamente",
        });
      }
    } catch (error) {
      console.error('Error approving transfer:', error);
      toast({
        title: "Error",
        description: "Error al aprobar la transferencia",
        variant: "destructive"
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
        <h1 className="text-2xl font-bold text-gray-800">Gestión de Transferencias</h1>
        <div className="text-sm text-gray-500">
          {selectedPoint ? `Punto: ${selectedPoint.nombre}` : 'Panel Administrativo'}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <TransferForm
          user={user}
          selectedPoint={selectedPoint}
          currencies={currencies}
          points={points}
          onTransferCreated={handleTransferCreated}
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
