
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { User, PuntoAtencion, Moneda, Transferencia } from '../../types';

interface TransferListProps {
  user: User;
  selectedPoint: PuntoAtencion | null;
  transfers: Transferencia[];
  currencies: Moneda[];
  points: PuntoAtencion[];
  onTransferApproved: (transferId: string) => void;
}

const TransferList = ({ user, transfers, currencies, points, selectedPoint, onTransferApproved }: TransferListProps) => {
  const getCurrencyName = (currencyId: string) => {
    const currency = currencies.find(c => c.id === currencyId);
    return currency ? currency.codigo : '';
  };

  const getPointName = (pointId: string) => {
    const point = [...points, selectedPoint].find(p => p?.id === pointId);
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

  const approveTransfer = (transferId: string) => {
    if (user.rol !== 'ADMIN' && user.rol !== 'SUPER_USUARIO') {
      toast({
        title: "Sin permisos",
        description: "Solo los administradores pueden aprobar transferencias",
        variant: "destructive"
      });
      return;
    }

    onTransferApproved(transferId);

    toast({
      title: "Transferencia aprobada",
      description: "La transferencia ha sido aprobada exitosamente",
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Transferencias Recientes</CardTitle>
        <CardDescription>Últimas transferencias solicitadas</CardDescription>
      </CardHeader>
      <CardContent>
        {transfers.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No hay transferencias registradas
          </div>
        ) : (
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {transfers.map(transfer => (
              <div key={transfer.id} className="border rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    transfer.estado === 'PENDIENTE' 
                      ? 'bg-yellow-100 text-yellow-800'
                      : transfer.estado === 'APROBADO'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}>
                    {transfer.estado}
                  </span>
                  <span className="text-xs text-gray-500">
                    {new Date(transfer.fecha).toLocaleDateString()}
                  </span>
                </div>
                <div className="text-sm space-y-1">
                  <p className="font-medium">
                    {getTransferTypeLabel(transfer.tipo_transferencia)}
                  </p>
                  <p className="text-gray-600">
                    Monto: {transfer.monto} {getCurrencyName(transfer.moneda_id)}
                  </p>
                  {transfer.tipo_transferencia === 'ENTRE_PUNTOS' && (
                    <p className="text-gray-600">
                      De: {getPointName(transfer.origen_id || '')} → A: {getPointName(transfer.destino_id)}
                    </p>
                  )}
                  {transfer.descripcion && (
                    <p className="text-gray-600 text-xs">
                      Notas: {transfer.descripcion}
                    </p>
                  )}
                </div>
                {transfer.estado === 'PENDIENTE' && (user.rol === 'ADMIN' || user.rol === 'SUPER_USUARIO') && (
                  <Button
                    size="sm"
                    onClick={() => approveTransfer(transfer.id)}
                    className="mt-2 bg-green-600 hover:bg-green-700"
                  >
                    Aprobar
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TransferList;
