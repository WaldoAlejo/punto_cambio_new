
import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { User, PuntoAtencion, Moneda, Transferencia, ResponsableMovilizacion } from '../../types';
import { ReceiptService } from '../../services/receiptService';
import CurrencySearchSelect from '../ui/currency-search-select';

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
    notes: '',
    billetes: '',
    monedas: ''
  });

  const [responsable, setResponsable] = useState<ResponsableMovilizacion>({
    nombre: '',
    cedula: '',
    telefono: ''
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

    // Validar responsable para transferencias entre puntos
    if (formData.type === 'ENTRE_PUNTOS' && (!responsable.nombre || !responsable.cedula)) {
      toast({
        title: "Error",
        description: "Debe completar los datos del responsable de movilización",
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
    const billetes = parseFloat(formData.billetes) || 0;
    const monedas = parseFloat(formData.monedas) || 0;
    const total = billetes + monedas;

    // Validar que el total coincida con el monto
    if (Math.abs(total - parseFloat(formData.amount)) > 0.01) {
      toast({
        title: "Error",
        description: "El total de billetes y monedas debe coincidir con el monto total",
        variant: "destructive"
      });
      return;
    }

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
      numero_recibo: numeroRecibo,
      detalle_divisas: {
        billetes: billetes,
        monedas: monedas,
        total: total
      },
      responsable_movilizacion: formData.type === 'ENTRE_PUNTOS' ? responsable : undefined
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
      notes: '',
      billetes: '',
      monedas: ''
    });
    setResponsable({ nombre: '', cedula: '', telefono: '' });

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
        // Para depósitos de matriz, mostrar todos los puntos
        return points;
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

  const getTransferOptions = () => {
    // Operadores y Concesiones pueden solicitar transferencias
    if (user.rol === 'OPERADOR' || user.rol === 'CONCESION') {
      return [
        { value: 'ENTRE_PUNTOS', label: 'Transferencia entre Puntos' },
        { value: 'DEPOSITO_MATRIZ', label: 'Solicitar Depósito de Matriz' },
        { value: 'RETIRO_GERENCIA', label: 'Retiro de Gerencia' },
        { value: 'DEPOSITO_GERENCIA', label: 'Depósito de Gerencia' }
      ];
    }
    
    // Administradores pueden aprobar/realizar depósitos de matriz y transferencias
    if (user.rol === 'ADMIN' || user.rol === 'SUPER_USUARIO') {
      return [
        { value: 'DEPOSITO_MATRIZ', label: 'Depósito de Matriz' },
        { value: 'ENTRE_PUNTOS', label: 'Transferencia entre Puntos' },
        { value: 'RETIRO_GERENCIA', label: 'Retiro de Gerencia' },
        { value: 'DEPOSITO_GERENCIA', label: 'Depósito de Gerencia' }
      ];
    }

    return [];
  };

  const calculateTotal = () => {
    const billetes = parseFloat(formData.billetes) || 0;
    const monedas = parseFloat(formData.monedas) || 0;
    return billetes + monedas;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nueva Transferencia</CardTitle>
        <CardDescription>
          {user.rol === 'ADMIN' || user.rol === 'SUPER_USUARIO' 
            ? 'Realizar una nueva transferencia' 
            : 'Solicitar una nueva transferencia'
          }
        </CardDescription>
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
                {getTransferOptions().map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
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

          <CurrencySearchSelect
            currencies={currencies}
            value={formData.currencyId}
            onValueChange={(value) => setFormData(prev => ({ ...prev, currencyId: value }))}
            placeholder="Seleccionar moneda"
            label="Moneda"
          />

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Billetes</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.billetes}
                onChange={(e) => setFormData(prev => ({ ...prev, billetes: e.target.value }))}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label>Monedas</Label>
              <Input
                type="number"
                step="0.01"
                value={formData.monedas}
                onChange={(e) => setFormData(prev => ({ ...prev, monedas: e.target.value }))}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label>Total</Label>
              <div className="h-10 px-3 py-2 border rounded-md bg-gray-50 flex items-center font-bold">
                {calculateTotal().toFixed(2)}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Monto Total</Label>
            <Input
              type="number"
              step="0.01"
              value={formData.amount}
              onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
              placeholder="0.00"
            />
          </div>

          {formData.type === 'ENTRE_PUNTOS' && (
            <div className="border rounded-lg p-4 space-y-4">
              <h4 className="font-medium text-gray-800">Responsable de Movilización</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nombre Completo</Label>
                  <Input
                    value={responsable.nombre}
                    onChange={(e) => setResponsable(prev => ({ ...prev, nombre: e.target.value }))}
                    placeholder="Nombre del responsable"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Cédula</Label>
                  <Input
                    value={responsable.cedula}
                    onChange={(e) => setResponsable(prev => ({ ...prev, cedula: e.target.value }))}
                    placeholder="Número de cédula"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Teléfono</Label>
                <Input
                  value={responsable.telefono}
                  onChange={(e) => setResponsable(prev => ({ ...prev, telefono: e.target.value }))}
                  placeholder="Número de teléfono"
                />
              </div>
            </div>
          )}

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
            {user.rol === 'ADMIN' || user.rol === 'SUPER_USUARIO' 
              ? 'Realizar Transferencia' 
              : 'Solicitar Transferencia'
            }
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default TransferForm;
