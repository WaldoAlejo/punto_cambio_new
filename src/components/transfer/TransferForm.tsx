
import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { User, PuntoAtencion, Moneda, Transferencia } from '../../types';
import { ReceiptService } from '../../services/receiptService';

interface TransferFormProps {
  user: User;
  selectedPoint: PuntoAtencion | null;
  currencies: Moneda[];
  points: PuntoAtencion[];
  onTransferCreated: (transfer: Transferencia) => void;
}

const TransferForm = ({ user, selectedPoint, currencies, points, onTransferCreated }: TransferFormProps) => {
  const [formData, setFormData] = useState({
    type: '',
    toPointId: '',
    currencyId: '',
    amount: '',
    notes: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.type || !formData.currencyId || !formData.amount) {
      toast({
        title: "Error",
        description: "Todos los campos obligatorios deben completarse",
        variant: "destructive"
      });
      return;
    }

    // Validar selección de destino según el tipo de transferencia
    if (formData.type === 'ENTRE_PUNTOS' && !formData.toPointId) {
      toast({
        title: "Error", 
        description: "Debe seleccionar el punto de destino",
        variant: "destructive"
      });
      return;
    }

    if (['DEPOSITO_MATRIZ', 'RETIRO_GERENCIA', 'DEPOSITO_GERENCIA'].includes(formData.type) && !formData.toPointId) {
      toast({
        title: "Error", 
        description: "Debe seleccionar el punto de destino",
        variant: "destructive"
      });
      return;
    }

    let destinoId = '';
    let origenId: string | undefined = undefined;

    switch (formData.type) {
      case 'ENTRE_PUNTOS':
        origenId = selectedPoint?.id;
        destinoId = formData.toPointId;
        break;
      case 'DEPOSITO_MATRIZ':
        // La matriz deposita al punto seleccionado
        destinoId = formData.toPointId;
        break;
      case 'RETIRO_GERENCIA':
      case 'DEPOSITO_GERENCIA':
        origenId = selectedPoint?.id;
        destinoId = formData.toPointId;
        break;
      default:
        destinoId = selectedPoint?.id || '';
    }

    const numeroRecibo = ReceiptService.generateReceiptNumber('TRANSFERENCIA');

    const newTransfer: Transferencia = {
      id: Date.now().toString(),
      origen_id: origenId,
      destino_id: destinoId,
      moneda_id: formData.currencyId,
      monto: parseFloat(formData.amount),
      tipo_transferencia: formData.type as any,
      estado: 'PENDIENTE',
      solicitado_por: user.id,
      fecha: new Date().toISOString(),
      descripcion: formData.notes,
      numero_recibo: numeroRecibo
    };

    onTransferCreated(newTransfer);

    // Generar e imprimir recibo
    const receiptData = ReceiptService.generateTransferReceipt(
      newTransfer,
      selectedPoint?.nombre || 'Sistema',
      user.nombre
    );
    ReceiptService.printReceipt(receiptData, 2);
    
    // Reset form
    setFormData({
      type: '',
      toPointId: '',
      currencyId: '',
      amount: '',
      notes: ''
    });

    toast({
      title: "Transferencia solicitada",
      description: "La transferencia ha sido enviada para aprobación y se ha generado el recibo",
    });
  };

  const getAvailablePoints = () => {
    switch (formData.type) {
      case 'ENTRE_PUNTOS':
        // Para transferencias entre puntos, mostrar todos excepto el actual
        return points.filter(p => p.id !== selectedPoint?.id);
      case 'DEPOSITO_MATRIZ':
        // Para depósitos de matriz, mostrar todos los puntos (incluyendo el actual)
        return [...points, ...(selectedPoint ? [selectedPoint] : [])];
      case 'RETIRO_GERENCIA':
      case 'DEPOSITO_GERENCIA':
        // Para operaciones de gerencia, mostrar puntos de destino
        return points;
      default:
        return points;
    }
  };

  const getDestinationLabel = () => {
    switch (formData.type) {
      case 'ENTRE_PUNTOS':
        return 'Punto de Destino';
      case 'DEPOSITO_MATRIZ':
        return 'Punto que Recibe el Depósito';
      case 'RETIRO_GERENCIA':
        return 'Punto de Destino del Retiro';
      case 'DEPOSITO_GERENCIA':
        return 'Punto de Destino del Depósito';
      default:
        return 'Punto de Destino';
    }
  };

  const shouldShowDestinationSelect = () => {
    return ['ENTRE_PUNTOS', 'DEPOSITO_MATRIZ', 'RETIRO_GERENCIA', 'DEPOSITO_GERENCIA'].includes(formData.type);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nueva Transferencia</CardTitle>
        <CardDescription>Solicitar una nueva transferencia</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Tipo de Transferencia</Label>
            <Select 
              value={formData.type} 
              onValueChange={(value) => setFormData(prev => ({ ...prev, type: value, toPointId: '' }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar tipo" />
              </SelectTrigger>
              <SelectContent>
                {(user.rol === 'OPERADOR' || user.rol === 'CONCESION') && (
                  <>
                    <SelectItem value="ENTRE_PUNTOS">Transferencia entre Puntos</SelectItem>
                    <SelectItem value="DEPOSITO_MATRIZ">Solicitar Depósito de Matriz</SelectItem>
                    <SelectItem value="RETIRO_GERENCIA">Retiro de Gerencia</SelectItem>
                    <SelectItem value="DEPOSITO_GERENCIA">Depósito de Gerencia</SelectItem>
                  </>
                )}
                {(user.rol === 'ADMIN' || user.rol === 'SUPER_USUARIO') && (
                  <>
                    <SelectItem value="DEPOSITO_MATRIZ">Depósito de Matriz</SelectItem>
                    <SelectItem value="ENTRE_PUNTOS">Transferencia entre Puntos</SelectItem>
                    <SelectItem value="RETIRO_GERENCIA">Retiro de Gerencia</SelectItem>
                    <SelectItem value="DEPOSITO_GERENCIA">Depósito de Gerencia</SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
          </div>

          {shouldShowDestinationSelect() && (
            <div className="space-y-2">
              <Label>{getDestinationLabel()}</Label>
              <Select 
                value={formData.toPointId} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, toPointId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar punto" />
                </SelectTrigger>
                <SelectContent>
                  {getAvailablePoints().map(point => (
                    <SelectItem key={point.id} value={point.id}>
                      {point.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Moneda</Label>
              <Select 
                value={formData.currencyId} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, currencyId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar" />
                </SelectTrigger>
                <SelectContent>
                  {currencies.map(currency => (
                    <SelectItem key={currency.id} value={currency.id}>
                      {currency.codigo} - {currency.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Monto</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                placeholder="0.00"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notas (Opcional)</Label>
            <Textarea
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Comentarios adicionales..."
              rows={3}
            />
          </div>

          <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700">
            Solicitar Transferencia
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default TransferForm;
