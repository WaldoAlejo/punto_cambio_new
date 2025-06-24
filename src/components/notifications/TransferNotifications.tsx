
import { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { transferService } from '../../services/transferService';
import { User, Transferencia } from '../../types';

interface TransferNotificationsProps {
  user: User;
  onNotificationClick: () => void;
}

const TransferNotifications = ({ user, onNotificationClick }: TransferNotificationsProps) => {
  const [pendingTransfers, setPendingTransfers] = useState<Transferencia[]>([]);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (user.rol !== 'ADMIN' && user.rol !== 'SUPER_USUARIO') return;

    const checkPendingTransfers = async () => {
      try {
        console.log('Verificando transferencias pendientes para notificaciones...');
        const { transfers, error } = await transferService.getPendingTransfers();
        
        if (error) {
          console.error('Error obteniendo transferencias pendientes:', error);
          setPendingTransfers([]);
        } else {
          console.log(`${transfers.length} transferencias pendientes encontradas`);
          setPendingTransfers(transfers);
        }
      } catch (error) {
        console.error('Error loading pending transfers:', error);
        setPendingTransfers([]);
      }
    };

    // Verificar al cargar
    checkPendingTransfers();
    
    // Verificar cada 30 segundos
    const interval = setInterval(checkPendingTransfers, 30000);

    return () => clearInterval(interval);
  }, [user.rol]);

  const handleNotificationClick = () => {
    setIsOpen(false);
    onNotificationClick();
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

  if (user.rol !== 'ADMIN' && user.rol !== 'SUPER_USUARIO') {
    return null;
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="relative">
          <Bell className="h-5 w-5" />
          {pendingTransfers.length > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs animate-pulse"
            >
              {pendingTransfers.length}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <Card className="border-0 shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Transferencias Pendientes</CardTitle>
            <CardDescription>
              {pendingTransfers.length === 0 
                ? 'No hay transferencias pendientes de aprobación'
                : `${pendingTransfers.length} transferencia(s) esperando aprobación`
              }
            </CardDescription>
          </CardHeader>
          {pendingTransfers.length > 0 && (
            <CardContent className="space-y-2">
              {pendingTransfers.slice(0, 3).map(transfer => (
                <div key={transfer.id} className="p-3 bg-yellow-50 rounded border-l-4 border-yellow-400">
                  <p className="text-sm font-medium">
                    {getTransferTypeLabel(transfer.tipo_transferencia)}
                  </p>
                  <p className="text-xs text-gray-600">
                    Monto: {transfer.monto} {transfer.moneda?.codigo || ''}
                  </p>
                  <p className="text-xs text-gray-600">
                    {transfer.destino?.nombre || 'Destino desconocido'}
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Date(transfer.fecha).toLocaleDateString('es-ES', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                </div>
              ))}
              {pendingTransfers.length > 3 && (
                <p className="text-xs text-gray-500 text-center pt-2">
                  +{pendingTransfers.length - 3} transferencias más...
                </p>
              )}
              <Button 
                onClick={handleNotificationClick}
                className="w-full mt-3"
                size="sm"
              >
                Ver Todas las Transferencias
              </Button>
            </CardContent>
          )}
        </Card>
      </PopoverContent>
    </Popover>
  );
};

export default TransferNotifications;
