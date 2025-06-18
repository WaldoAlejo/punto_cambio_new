
import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { apiService } from '../../services/apiService';
import { User, Transferencia, Moneda, PuntoAtencion } from '../../types';

interface TransferApprovalsProps {
  user: User;
}

interface ApiResponse {
  transfers?: Transferencia[];
  currencies?: Moneda[];
  points?: PuntoAtencion[];
  success?: boolean;
  error?: string;
}

const TransferApprovals = ({ user }: TransferApprovalsProps) => {
  const [pendingTransfers, setPendingTransfers] = useState<Transferencia[]>([]);
  const [currencies, setCurrencies] = useState<Moneda[]>([]);
  const [points, setPoints] = useState<PuntoAtencion[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        
        // Cargar datos reales desde la API
        const [transfersResponse, currenciesResponse, pointsResponse] = await Promise.all([
          apiService.get<ApiResponse>('/transfers'),
          apiService.get<ApiResponse>('/currencies'),
          apiService.get<ApiResponse>('/points')
        ]);

        if (transfersResponse && transfersResponse.transfers) {
          // Filtrar solo las transferencias pendientes
          const pending = transfersResponse.transfers.filter((t: Transferencia) => t.estado === 'PENDIENTE');
          setPendingTransfers(pending);
        }

        if (currenciesResponse && currenciesResponse.currencies) {
          setCurrencies(currenciesResponse.currencies);
        }

        if (pointsResponse && pointsResponse.points) {
          setPoints(pointsResponse.points);
        }

      } catch (error) {
        console.error('Error loading transfer approvals data:', error);
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

  const handleApprove = async (transferId: string) => {
    try {
      // Aquí iría la llamada a la API para aprobar la transferencia
      // Por ahora solo actualizamos el estado local
      setPendingTransfers(prev => prev.filter(t => t.id !== transferId));

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

  const handleReject = async (transferId: string) => {
    try {
      // Aquí iría la llamada a la API para rechazar la transferencia
      // Por ahora solo actualizamos el estado local
      setPendingTransfers(prev => prev.filter(t => t.id !== transferId));

      toast({
        title: "Transferencia rechazada",
        description: "La transferencia ha sido rechazada",
        variant: "destructive"
      });
    } catch (error) {
      console.error('Error rejecting transfer:', error);
      toast({
        title: "Error",
        description: "Error al rechazar la transferencia",
        variant: "destructive"
      });
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando transferencias pendientes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Aprobación de Transferencias</h1>
        <Badge variant="secondary">
          {pendingTransfers.length} transferencias pendientes
        </Badge>
      </div>

      {pendingTransfers.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <div className="text-center py-8 text-gray-500">
              No hay transferencias pendientes de aprobación
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {pendingTransfers.map(transfer => (
            <Card key={transfer.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">
                      {getTransferTypeLabel(transfer.tipo_transferencia)}
                    </CardTitle>
                    <CardDescription>
                      Recibo: {transfer.numero_recibo || 'Sin número'}
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
                      {transfer.tipo_transferencia === 'ENTRE_PUNTOS' && transfer.origen_id && (
                        <p>
                          <span className="font-medium">De:</span> {getPointName(transfer.origen_id)} 
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
