
import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { User, Transferencia, Moneda, PuntoAtencion } from '../../types';

interface TransferApprovalsProps {
  user: User;
}

const TransferApprovals = ({ user }: TransferApprovalsProps) => {
  const [pendingTransfers, setPendingTransfers] = useState<Transferencia[]>([]);
  const [currencies, setCurrencies] = useState<Moneda[]>([]);
  const [points, setPoints] = useState<PuntoAtencion[]>([]);

  // Mock data - En producción esto vendría de la API
  const mockCurrencies: Moneda[] = [
    { id: '1', codigo: 'USD', nombre: 'Dólar Estadounidense', simbolo: '$', activo: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: '2', codigo: 'EUR', nombre: 'Euro', simbolo: '€', activo: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: '3', codigo: 'VES', nombre: 'Bolívar Venezolano', simbolo: 'Bs', activo: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
  ];

  const mockPoints: PuntoAtencion[] = [
    { id: '1', nombre: 'Punto Centro', direccion: 'Centro', ciudad: 'Caracas', provincia: 'DC', telefono: '', activo: true, created_at: '', updated_at: '' },
    { id: '2', nombre: 'Punto Norte', direccion: 'Norte', ciudad: 'Caracas', provincia: 'DC', telefono: '', activo: true, created_at: '', updated_at: '' },
    { id: '3', nombre: 'Matriz', direccion: 'Oficina Principal', ciudad: 'Caracas', provincia: 'DC', telefono: '', activo: true, created_at: '', updated_at: '' }
  ];

  const mockPendingTransfers: Transferencia[] = [
    {
      id: '1',
      origen_id: '1',
      destino_id: '2',
      moneda_id: '1',
      monto: 1000,
      tipo_transferencia: 'ENTRE_PUNTOS',
      estado: 'PENDIENTE',
      solicitado_por: 'user1',
      fecha: new Date().toISOString(),
      descripcion: 'Transferencia de operación diaria',
      numero_recibo: 'TR-001',
      detalle_divisas: {
        billetes: 800,
        monedas: 200,
        total: 1000
      }
    },
    {
      id: '2',
      destino_id: '1',
      moneda_id: '2',
      monto: 500,
      tipo_transferencia: 'DEPOSITO_MATRIZ',
      estado: 'PENDIENTE',
      solicitado_por: 'user2',
      fecha: new Date().toISOString(),
      descripcion: 'Solicitud de euros para operaciones',
      numero_recibo: 'TR-002',
      detalle_divisas: {
        billetes: 400,
        monedas: 100,
        total: 500
      }
    }
  ];

  useEffect(() => {
    setCurrencies(mockCurrencies);
    setPoints(mockPoints);
    setPendingTransfers(mockPendingTransfers);
  }, []);

  const getCurrencyName = (currencyId: string) => {
    const currency = currencies.find(c => c.id === currencyId);
    return currency ? currency.codigo : '';
  };

  const getPointName = (pointId: string) => {
    const point = points.find(p => p.id === pointId);
    return point ? point.nombre : '';
  };

  const getTransferTypeLabel = (type: string) => {
    const types = {
      'ENTRE_PUNTOS': 'Entre Puntos',
      'DEPOSITO_MATRIZ': 'Depósito Matriz',
      'RETIRO_GERENCIA': 'Retiro Gerencia',
      'DEPOSITO_GERENCIA': 'Depósito Gerencia'
    };
    return types[type as keyof typeof types] || type;
  };

  const handleApprove = (transferId: string) => {
    setPendingTransfers(prev => prev.map(t => 
      t.id === transferId 
        ? { 
            ...t, 
            estado: 'APROBADO', 
            aprobado_por: user.id,
            fecha_aprobacion: new Date().toISOString()
          }
        : t
    ));

    toast({
      title: "Transferencia aprobada",
      description: "La transferencia ha sido aprobada exitosamente",
    });
  };

  const handleReject = (transferId: string) => {
    setPendingTransfers(prev => prev.map(t => 
      t.id === transferId 
        ? { 
            ...t, 
            estado: 'RECHAZADO', 
            aprobado_por: user.id,
            fecha_aprobacion: new Date().toISOString()
          }
        : t
    ));

    toast({
      title: "Transferencia rechazada",
      description: "La transferencia ha sido rechazada",
      variant: "destructive"
    });
  };

  const pendingOnly = pendingTransfers.filter(t => t.estado === 'PENDIENTE');

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Aprobación de Transferencias</h1>
        <Badge variant="secondary">
          {pendingOnly.length} transferencias pendientes
        </Badge>
      </div>

      {pendingOnly.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <div className="text-center py-8 text-gray-500">
              No hay transferencias pendientes de aprobación
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {pendingOnly.map(transfer => (
            <Card key={transfer.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">
                      {getTransferTypeLabel(transfer.tipo_transferencia)}
                    </CardTitle>
                    <CardDescription>
                      Recibo: {transfer.numero_recibo}
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="bg-yellow-50 text-yellow-800">
                    {transfer.estado}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-4 mb-4">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-700">Detalles de la Transferencia</p>
                    <div className="text-sm space-y-1">
                      <p>
                        <span className="font-medium">Monto:</span> {transfer.monto} {getCurrencyName(transfer.moneda_id)}
                      </p>
                      {transfer.tipo_transferencia === 'ENTRE_PUNTOS' && (
                        <p>
                          <span className="font-medium">De:</span> {getPointName(transfer.origen_id || '')} 
                          <span className="mx-2">→</span>
                          <span className="font-medium">A:</span> {getPointName(transfer.destino_id)}
                        </p>
                      )}
                      {transfer.tipo_transferencia !== 'ENTRE_PUNTOS' && (
                        <p>
                          <span className="font-medium">Destino:</span> {getPointName(transfer.destino_id)}
                        </p>
                      )}
                      <p>
                        <span className="font-medium">Fecha:</span> {new Date(transfer.fecha).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  
                  {transfer.descripcion && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-gray-700">Descripción</p>
                      <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                        {transfer.descripcion}
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-4 border-t">
                  <Button 
                    onClick={() => handleApprove(transfer.id)}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    Aprobar
                  </Button>
                  <Button 
                    variant="destructive"
                    onClick={() => handleReject(transfer.id)}
                  >
                    Rechazar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default TransferApprovals;
