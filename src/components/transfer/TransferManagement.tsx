
import { useState, useEffect } from 'react';
import { User, PuntoAtencion, Moneda, Transferencia } from '../../types';
import { toast } from "@/hooks/use-toast";
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

  // Mock data
  const mockCurrencies: Moneda[] = [
    { id: '1', codigo: 'USD', nombre: 'Dólar Estadounidense', simbolo: '$', activo: true, orden_display: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: '2', codigo: 'EUR', nombre: 'Euro', simbolo: '€', activo: true, orden_display: 2, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: '3', codigo: 'VES', nombre: 'Bolívar Venezolano', simbolo: 'Bs', activo: true, orden_display: 3, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
  ];

  const mockPoints: PuntoAtencion[] = [
    { id: '1', nombre: 'Punto Centro', direccion: 'Centro', ciudad: 'Caracas', provincia: 'DC', telefono: '', activo: true, created_at: '', updated_at: '' },
    { id: '2', nombre: 'Punto Norte', direccion: 'Norte', ciudad: 'Caracas', provincia: 'DC', telefono: '', activo: true, created_at: '', updated_at: '' },
    { id: '3', nombre: 'Punto Sur', direccion: 'Sur', ciudad: 'Caracas', provincia: 'DC', telefono: '', activo: true, created_at: '', updated_at: '' }
  ];

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        
        // Simulate loading
        await new Promise(resolve => setTimeout(resolve, 500));
        
        setCurrencies(mockCurrencies);
        setPoints(mockPoints.filter(p => p.id !== selectedPoint?.id));
        setTransfers([]);
        
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
