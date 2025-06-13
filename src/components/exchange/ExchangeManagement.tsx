import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { User, PuntoAtencion, Moneda, CambioDivisa } from '../../types';
import { ReceiptService } from '../../services/receiptService';

interface ExchangeManagementProps {
  user: User;
  selectedPoint: PuntoAtencion | null;
}

const ExchangeManagement = ({ user, selectedPoint }: ExchangeManagementProps) => {
  const [exchanges, setExchanges] = useState<CambioDivisa[]>([]);
  const [currencies, setCurrencies] = useState<Moneda[]>([]);
  const [formData, setFormData] = useState({
    fromCurrencyId: '',
    toCurrencyId: '',
    fromAmount: '',
    exchangeRate: '',
    type: 'COMPRA' as 'COMPRA' | 'VENTA',
    notes: ''
  });

  // Mock data
  const mockCurrencies: Moneda[] = [
    { id: '1', codigo: 'USD', nombre: 'Dólar Estadounidense', simbolo: '$', activo: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: '2', codigo: 'EUR', nombre: 'Euro', simbolo: '€', activo: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: '3', codigo: 'VES', nombre: 'Bolívar Venezolano', simbolo: 'Bs', activo: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: '4', codigo: 'COP', nombre: 'Peso Colombiano', simbolo: '$', activo: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
  ];

  useEffect(() => {
    setCurrencies(mockCurrencies);
    setExchanges([]);
  }, []);

  const calculateToAmount = () => {
    const fromAmount = parseFloat(formData.fromAmount);
    const rate = parseFloat(formData.exchangeRate);
    if (fromAmount && rate) {
      return fromAmount * rate;
    }
    return 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.fromCurrencyId || !formData.toCurrencyId || !formData.fromAmount || !formData.exchangeRate) {
      toast({
        title: "Error",
        description: "Todos los campos son obligatorios",
        variant: "destructive"
      });
      return;
    }

    if (formData.fromCurrencyId === formData.toCurrencyId) {
      toast({
        title: "Error", 
        description: "Las monedas de origen y destino deben ser diferentes",
        variant: "destructive"
      });
      return;
    }

    const numeroRecibo = ReceiptService.generateReceiptNumber('CAMBIO_DIVISA');

    const newExchange: CambioDivisa = {
      id: Date.now().toString(),
      fecha: new Date().toISOString(),
      monto_origen: parseFloat(formData.fromAmount),
      monto_destino: calculateToAmount(),
      tasa_cambio: parseFloat(formData.exchangeRate),
      tipo_operacion: formData.type,
      moneda_origen_id: formData.fromCurrencyId,
      moneda_destino_id: formData.toCurrencyId,
      usuario_id: user.id,
      punto_atencion_id: selectedPoint?.id || '',
      observacion: formData.notes,
      numero_recibo: numeroRecibo,
      estado: 'COMPLETADO',
      // Agregamos las referencias a las monedas para el recibo
      monedaOrigen: currencies.find(c => c.id === formData.fromCurrencyId),
      monedaDestino: currencies.find(c => c.id === formData.toCurrencyId)
    };

    setExchanges(prev => [newExchange, ...prev]);

    // Generar e imprimir recibo
    const receiptData = ReceiptService.generateCurrencyExchangeReceipt(
      newExchange,
      selectedPoint?.nombre || 'Sistema',
      user.nombre
    );
    ReceiptService.printReceipt(receiptData, 2);
    
    // Reset form
    setFormData({
      fromCurrencyId: '',
      toCurrencyId: '',
      fromAmount: '',
      exchangeRate: '',
      type: 'COMPRA',
      notes: ''
    });

    toast({
      title: "Cambio registrado",
      description: "El cambio de divisa ha sido registrado exitosamente y se ha generado el recibo",
    });
  };

  const getCurrencyName = (currencyId: string) => {
    const currency = currencies.find(c => c.id === currencyId);
    return currency ? currency.codigo : '';
  };

  const getPointName = () => {
    return selectedPoint ? selectedPoint.nombre : '';
  };

  if (!selectedPoint) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">Debe seleccionar un punto de atención para realizar cambios</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Cambio de Divisas</h1>
        <div className="text-sm text-gray-500">
          {selectedPoint ? `Punto: ${selectedPoint.nombre}` : 'Panel Administrativo'}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Form */}
        <Card>
          <CardHeader>
            <CardTitle>Nuevo Cambio</CardTitle>
            <CardDescription>Registrar una nueva operación de cambio</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Tipo de Operación</Label>
                <Select 
                  value={formData.type} 
                  onValueChange={(value: 'COMPRA' | 'VENTA') => setFormData(prev => ({ ...prev, type: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="COMPRA">Compra</SelectItem>
                    <SelectItem value="VENTA">Venta</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Moneda Origen</Label>
                  <Select 
                    value={formData.fromCurrencyId} 
                    onValueChange={(value) => setFormData(prev => ({ ...prev, fromCurrencyId: value }))}
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
                  <Label>Moneda Destino</Label>
                  <Select 
                    value={formData.toCurrencyId} 
                    onValueChange={(value) => setFormData(prev => ({ ...prev, toCurrencyId: value }))}
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
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Monto Origen</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.fromAmount}
                    onChange={(e) => setFormData(prev => ({ ...prev, fromAmount: e.target.value }))}
                    placeholder="0.00"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Tasa de Cambio</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.exchangeRate}
                    onChange={(e) => setFormData(prev => ({ ...prev, exchangeRate: e.target.value }))}
                    placeholder="0.00"
                  />
                </div>
              </div>

              {formData.fromAmount && formData.exchangeRate && (
                <div className="bg-blue-50 p-3 rounded">
                  <p className="text-sm text-blue-800">
                    Monto a recibir: <span className="font-bold">{calculateToAmount().toFixed(2)}</span>
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label>Observaciones (Opcional)</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Comentarios adicionales..."
                  rows={3}
                />
              </div>

              <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700">
                Registrar Cambio
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Exchanges List */}
        <Card>
          <CardHeader>
            <CardTitle>Cambios Recientes</CardTitle>
            <CardDescription>Últimas operaciones realizadas</CardDescription>
          </CardHeader>
          <CardContent>
            {exchanges.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No hay cambios registrados
              </div>
            ) : (
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {exchanges.map(exchange => (
                  <div key={exchange.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        exchange.tipo_operacion === 'COMPRA' 
                          ? 'bg-green-100 text-green-800'
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {exchange.tipo_operacion}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(exchange.fecha).toLocaleDateString()} {exchange.hora}
                      </span>
                    </div>
                    <div className="text-sm space-y-1">
                      <p className="font-medium">
                        {exchange.monto_origen} {getCurrencyName(exchange.moneda_origen_id)} → {exchange.monto_destino} {getCurrencyName(exchange.moneda_destino_id)}
                      </p>
                      <p className="text-gray-600">
                        Tasa: {exchange.tasa_cambio}
                      </p>
                      {exchange.observacion && (
                        <p className="text-gray-600 text-xs">
                          Obs: {exchange.observacion}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ExchangeManagement;
