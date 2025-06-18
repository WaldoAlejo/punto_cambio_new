
import { useState, useEffect } from 'react';
import { User, PuntoAtencion, Moneda, Transferencia } from '../../types';
import { toast } from "@/hooks/use-toast";
import { apiService } from '../../services/apiService';
import TransferForm from './TransferForm';
import TransferList from './TransferList';

interface TransferManagementProps {
  user: User;
  selectedPoint: PuntoAtencion | null;
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
        
        // Cargar datos reales desde la API
        const [transfersResponse, currenciesResponse, pointsResponse] = await Promise.all([
          apiService.get('/transfers'),
          apiService.get('/currencies'),
          apiService.get('/points')
        ]);

        if (transfersResponse?.transfers) {
          setTransfers(transfersResponse.transfers);
        }

        if (currenciesResponse?.currencies) {
          setCurrencies(currenciesResponse.currencies);
        }

        if (pointsResponse?.points) {
          // Filtrar el punto actual para las transferencias
          const availablePoints = pointsResponse.points.filter((p: PuntoAtencion) => p.id !== selectedPoint?.id);
          setPoints(availablePoints);
        }
        
        toast({
          title: "Datos cargados",
          description: "Información de transferencias actualizada",
        });
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

  const handleTransferCreated = (transfer: Transferencia) => {
    try {
      setTransfers(prev => [transfer, ...prev]);
      toast({
        title: "Transferencia creada",
        description: `Transferencia de ${transfer.monto} creada exitosamente`,
      });
    } catch (error) {
      console.error('Error creating transfer:', error);
      toast({
        title: "Error",
        description: "Error al procesar la transferencia",
        variant: "destructive"
      });
    }
  };

  const handleTransferApproved = (transferId: string) => {
    try {
      setTransfers(prev => prev.map(t => 
        t.id === transferId 
          ? { ...t, estado: 'APROBADO', aprobado_por: user.id }
          : t
      ));
      
      toast({
        title: "Transferencia aprobada",
        description: "La transferencia ha sido aprobada exitosamente",
      });
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
