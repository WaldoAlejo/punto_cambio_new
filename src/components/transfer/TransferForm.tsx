
import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, X } from "lucide-react";
import { User, PuntoAtencion, Moneda } from '../../types';
import { transferService } from '../../services/transferService';
import { currencyService } from '../../services/currencyService';
import { pointService } from '../../services/pointService';
import { useToast } from "@/hooks/use-toast";

interface TransferFormProps {
  user: User;
  selectedPoint: PuntoAtencion | null;
  onTransferCreated: () => void;
  onCancel: () => void;
}

const TransferForm = ({ user, selectedPoint, onTransferCreated, onCancel }: TransferFormProps) => {
  const [destinationPointId, setDestinationPointId] = useState('');
  const [currencyId, setCurrencyId] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [availablePoints, setAvailablePoints] = useState<PuntoAtencion[]>([]);
  const [currencies, setCurrencies] = useState<Moneda[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    const loadData = async () => {
      try {
        // Load available points
        const { points, error: pointsError } = await pointService.getAllPoints();
        if (pointsError) {
          console.error('Error loading points:', pointsError);
          return;
        }

        // Filter out current point
        const filteredPoints = points.filter(point => point.id !== selectedPoint?.id);
        setAvailablePoints(filteredPoints);

        // Load currencies
        const { currencies: fetchedCurrencies, error: currenciesError } = await currencyService.getAllCurrencies();
        if (currenciesError) {
          console.error('Error loading currencies:', currenciesError);
          return;
        }

        // Filter only active currencies
        const activeCurrencies = fetchedCurrencies.filter(currency => currency.activo);
        setCurrencies(activeCurrencies);

      } catch (error) {
        console.error('Error in loadData:', error);
        toast({
          title: "Error",
          description: "Error al cargar datos necesarios",
          variant: "destructive"
        });
      }
    };

    loadData();
  }, [selectedPoint, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!destinationPointId || !currencyId || !amount || !description.trim()) {
      toast({
        title: "Error",
        description: "Todos los campos son obligatorios",
        variant: "destructive"
      });
      return;
    }

    if (!selectedPoint) {
      toast({
        title: "Error",
        description: "No hay punto de origen seleccionado",
        variant: "destructive"
      });
      return;
    }

    const transferAmount = parseFloat(amount);
    if (isNaN(transferAmount) || transferAmount <= 0) {
      toast({
        title: "Error",
        description: "El monto debe ser un número válido mayor a 0",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsLoading(true);
      
      const transferData = {
        punto_origen_id: selectedPoint.id,
        punto_destino_id: destinationPointId,
        moneda_id: currencyId,
        monto: transferAmount,
        descripcion: description.trim(),
        usuario_solicitante_id: user.id,
        estado: 'PENDIENTE' as const
      };

      console.warn('Creating transfer:', transferData);

      const { transfer, error } = await transferService.createTransfer(transferData);

      if (error || !transfer) {
        throw new Error(error || 'Error desconocido al crear transferencia');
      }

      toast({
        title: "Transferencia creada",
        description: `Transferencia por ${transferAmount} creada exitosamente. ID: ${transfer.id}`,
      });

      // Reset form
      setDestinationPointId('');
      setCurrencyId('');
      setAmount('');
      setDescription('');
      
      onTransferCreated();
      
    } catch (error) {
      console.warn('Error creating transfer:', error);
      toast({
        title: "Error",
        description: "Error al crear la transferencia",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const selectedCurrency = currencies.find(c => c.id === currencyId);
  const selectedDestinationPoint = availablePoints.find(p => p.id === destinationPointId);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="h-5 w-5" />
          Nueva Transferencia
        </CardTitle>
        <CardDescription>
          Complete la información para solicitar una transferencia entre puntos
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Punto de Origen</Label>
              <Input
                value={selectedPoint?.nombre || 'No seleccionado'}
                disabled
                className="bg-gray-50"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="destinationPoint">Punto de Destino *</Label>
              <Select value={destinationPointId} onValueChange={setDestinationPointId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccione punto de destino" />
                </SelectTrigger>
                <SelectContent>
                  {availablePoints.map((point) => (
                    <SelectItem key={point.id} value={point.id}>
                      {point.nombre} - {point.direccion}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="currency">Moneda *</Label>
              <Select value={currencyId} onValueChange={setCurrencyId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccione moneda" />
                </SelectTrigger>
                <SelectContent>
                  {currencies.map((currency) => (
                    <SelectItem key={currency.id} value={currency.id}>
                      {currency.codigo} - {currency.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Monto *</Label>
              <div className="flex">
                <span className="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500 text-sm">
                  {selectedCurrency?.simbolo || '$'}
                </span>
                <Input
                  id="amount"
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  step="0.01"
                  min="0.01"
                  className="rounded-l-none"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descripción/Motivo *</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describa el motivo de la transferencia..."
              rows={3}
            />
          </div>

          {/* Transfer Summary */}
          {destinationPointId && currencyId && amount && (
            <div className="p-4 bg-blue-50 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">Resumen de Transferencia</h4>
              <div className="space-y-1 text-sm text-blue-800">
                <p><strong>Desde:</strong> {selectedPoint?.nombre}</p>
                <p><strong>Hacia:</strong> {selectedDestinationPoint?.nombre}</p>
                <p><strong>Monto:</strong> {selectedCurrency?.simbolo}{amount} {selectedCurrency?.codigo}</p>
                <p><strong>Solicitante:</strong> {user.nombre}</p>
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-4">
            <Button type="submit" disabled={isLoading}>
              <Send className="mr-2 h-4 w-4" />
              {isLoading ? 'Creando...' : 'Crear Transferencia'}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              <X className="mr-2 h-4 w-4" />
              Cancelar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default TransferForm;
