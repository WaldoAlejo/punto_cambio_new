
import { useState, useEffect } from 'react';
import { User, PuntoAtencion, Moneda, Transferencia } from '../../types';
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

  // Mock data
  const mockCurrencies: Moneda[] = [
    { id: '1', codigo: 'USD', nombre: 'Dólar Estadounidense', simbolo: '$', activo: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: '2', codigo: 'EUR', nombre: 'Euro', simbolo: '€', activo: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: '3', codigo: 'VES', nombre: 'Bolívar Venezolano', simbolo: 'Bs', activo: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
  ];

  const mockPoints: PuntoAtencion[] = [
    { id: '1', nombre: 'Punto Centro', direccion: 'Centro', ciudad: 'Caracas', provincia: 'DC', telefono: '', activo: true, created_at: '', updated_at: '', saldos: [] },
    { id: '2', nombre: 'Punto Norte', direccion: 'Norte', ciudad: 'Caracas', provincia: 'DC', telefono: '', activo: true, created_at: '', updated_at: '', saldos: [] },
    { id: '3', nombre: 'Punto Sur', direccion: 'Sur', ciudad: 'Caracas', provincia: 'DC', telefono: '', activo: true, created_at: '', updated_at: '', saldos: [] }
  ];

  useEffect(() => {
    setCurrencies(mockCurrencies);
    setPoints(mockPoints.filter(p => p.id !== selectedPoint?.id));
    setTransfers([]);
  }, [selectedPoint]);

  const handleTransferCreated = (transfer: Transferencia) => {
    setTransfers(prev => [transfer, ...prev]);
  };

  const handleTransferApproved = (transferId: string) => {
    setTransfers(prev => prev.map(t => 
      t.id === transferId 
        ? { ...t, estado: 'APROBADO', aprobado_por: user.id }
        : t
    ));
  };

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
