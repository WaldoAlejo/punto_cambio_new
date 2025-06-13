
import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { User, PuntoAtencion, Moneda, Transferencia } from '../../types';

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

    if ((formData.type === 'ENTRE_PUNTOS') && !formData.toPointId) {
      toast({
        title: "Error", 
        description: "Debe seleccionar el punto de destino",
        variant: "destructive"
      });
      return;
    }

    const newTransfer: Transferencia = {
      id: Date.now().toString(),
      origen_id: formData.type === 'ENTRE_PUNTOS' ? selectedPoint?.id : undefined,
      destino_id: formData.type === 'ENTRE_PUNTOS' ? formData.toPointId : selectedPoint?.id || '',
      moneda_id: formData.currencyId,
      monto: parseFloat(formData.amount),
      tipo_transferencia: formData.type as any,
      estado: 'PENDIENTE',
      solicitado_por: user.id,
      fecha: new Date().toISOString(),
      descripcion: formData.notes,
      numero_recibo: `TR-${Date.now()}`
    };

    onTransferCreated(newTransfer);
    
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
      description: "La transferencia ha sido enviada para aprobación",
    });
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
              onValueChange={(value) => setFormData(prev => ({ ...prev, type: value }))}
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
                  </>
                )}
              </SelectContent>
            </Select>
          </div>

          {formData.type === 'ENTRE_PUNTOS' && (
            <div className="space-y-2">
              <Label>Punto de Destino</Label>
              <Select 
                value={formData.toPointId} 
                onValueChange={(value) => setFormData(prev => ({ ...prev, toPointId: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar punto" />
                </SelectTrigger>
                <SelectContent>
                  {points.map(point => (
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
