
import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { User, PuntoAtencion, Moneda, CambioDivisa, DatosCliente, DetalleDivisasSimple } from '../../types';
import { ReceiptService } from '../../services/receiptService';
import CurrencySearchSelect from '../ui/currency-search-select';
import CustomerDataForm from './CustomerDataForm';
import CurrencyDetailForm from './CurrencyDetailForm';

interface ExchangeManagementProps {
  user: User;
  selectedPoint: PuntoAtencion | null;
}

const ExchangeManagement = ({ user, selectedPoint }: ExchangeManagementProps) => {
  const [step, setStep] = useState<'customer' | 'exchange' | 'details'>('customer');
  const [operationType, setOperationType] = useState<'COMPRA' | 'VENTA'>('COMPRA');
  const [rate, setRate] = useState('');
  const [fromCurrency, setFromCurrency] = useState('');
  const [toCurrency, setToCurrency] = useState('');
  const [amount, setAmount] = useState('');
  const [destinationAmount, setDestinationAmount] = useState(0);
  const [observation, setObservation] = useState('');
  const [exchanges, setExchanges] = useState<CambioDivisa[]>([]);
  const [currencies, setCurrencies] = useState<Moneda[]>([]);
  
  // New state for customer and currency details
  const [customerData, setCustomerData] = useState<DatosCliente>({
    nombre: '',
    apellido: '',
    cedula: '',
    telefono: ''
  });
  const [divisasEntregadas, setDivisasEntregadas] = useState<DetalleDivisasSimple>({
    billetes: 0,
    monedas: 0,
    total: 0
  });
  const [divisasRecibidas, setDivisasRecibidas] = useState<DetalleDivisasSimple>({
    billetes: 0,
    monedas: 0,
    total: 0
  });

  // Mock currencies
  const mockCurrencies: Moneda[] = [
    { id: '1', codigo: 'USD', nombre: 'Dólar Estadounidense', simbolo: '$', activo: true, orden_display: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: '2', codigo: 'EUR', nombre: 'Euro', simbolo: '€', activo: true, orden_display: 2, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
    { id: '3', codigo: 'VES', nombre: 'Bolívar Venezolano', simbolo: 'Bs', activo: true, orden_display: 3, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
  ];

  useEffect(() => {
    setCurrencies(mockCurrencies);
  }, []);

  useEffect(() => {
    if (rate && amount) {
      const rateValue = parseFloat(rate) || 0;
      setDestinationAmount(parseFloat(amount) * rateValue);
    }
  }, [amount, rate]);

  const getCurrencyName = (currencyId: string) => {
    const currency = currencies.find(c => c.id === currencyId);
    return currency ? currency.codigo : '';
  };

  const getCurrency = (currencyId: string) => {
    return currencies.find(c => c.id === currencyId);
  };

  const generateReceiptAndPrint = (exchange: CambioDivisa) => {
    const receiptData = ReceiptService.generateCurrencyExchangeReceipt(
      exchange,
      selectedPoint?.nombre || 'N/A',
      user.nombre
    );
    
    ReceiptService.printReceipt(receiptData, 2);
  };

  const handleCustomerDataSubmit = (data: DatosCliente) => {
    setCustomerData(data);
    setStep('exchange');
  };

  const handleExchangeFormSubmit = () => {
    if (!fromCurrency || !toCurrency) {
      toast({
        title: "Error",
        description: "Debe seleccionar las monedas",
        variant: "destructive"
      });
      return;
    }

    if (!amount || !rate) {
      toast({
        title: "Error",
        description: "Debe ingresar el monto y la tasa de cambio",
        variant: "destructive"
      });
      return;
    }

    setStep('details');
  };

  const performExchange = () => {
    if (!selectedPoint) {
      toast({
        title: "Error",
        description: "Debe seleccionar un punto de atención",
        variant: "destructive"
      });
      return;
    }

    const rateValue = parseFloat(rate) || 0;

    const newExchange: CambioDivisa = {
      id: Date.now().toString(),
      fecha: new Date().toISOString(),
      monto_origen: parseFloat(amount),
      monto_destino: destinationAmount,
      tasa_cambio: rateValue,
      tipo_operacion: operationType,
      moneda_origen_id: fromCurrency,
      moneda_destino_id: toCurrency,
      usuario_id: user.id,
      punto_atencion_id: selectedPoint.id,
      observacion: observation,
      numero_recibo: ReceiptService.generateReceiptNumber('CAMBIO_DIVISA'),
      estado: 'COMPLETADO',
      datos_cliente: customerData,
      divisas_entregadas: divisasEntregadas,
      divisas_recibidas: divisasRecibidas,
      monedaOrigen: getCurrency(fromCurrency),
      monedaDestino: getCurrency(toCurrency)
    };

    setExchanges([newExchange, ...exchanges]);
    generateReceiptAndPrint(newExchange);
    
    // Reset form to start
    resetForm();

    toast({
      title: "Cambio realizado",
      description: `Cambio completado y recibo generado`,
    });
  };

  const resetForm = () => {
    setStep('customer');
    setAmount('');
    setRate('');
    setObservation('');
    setCustomerData({ nombre: '', apellido: '', cedula: '', telefono: '' });
    setDivisasEntregadas({ billetes: 0, monedas: 0, total: 0 });
    setDivisasRecibidas({ billetes: 0, monedas: 0, total: 0 });
  };

  // Solo operadores y concesiones pueden realizar cambios de divisas
  if (user.rol === 'ADMIN' || user.rol === 'SUPER_USUARIO') {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">
            Los cambios de divisas solo pueden ser realizados por operadores y concesiones
          </p>
        </div>
      </div>
    );
  }

  if (!selectedPoint) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">Debe seleccionar un punto de atención</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Cambio de Divisas</h1>
        <div className="text-sm text-gray-500">
          Punto: {selectedPoint?.nombre}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          {step === 'customer' && (
            <CustomerDataForm
              onCustomerData={handleCustomerDataSubmit}
              initialData={customerData}
            />
          )}

          {step === 'exchange' && (
            <Card>
              <CardHeader>
                <CardTitle>Datos del Cambio</CardTitle>
                <CardDescription>Configure los detalles de la operación</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Tipo de Operación</Label>
                      <Select value={operationType} onValueChange={(value: 'COMPRA' | 'VENTA') => setOperationType(value)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="COMPRA">Compra</SelectItem>
                          <SelectItem value="VENTA">Venta</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Tasa de Cambio</Label>
                      <Input
                        type="number"
                        step="0.0001"
                        value={rate}
                        onChange={(e) => setRate(e.target.value)}
                        placeholder="Ingrese tasa"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <CurrencySearchSelect
                      currencies={currencies}
                      value={fromCurrency}
                      onValueChange={setFromCurrency}
                      placeholder="Moneda origen"
                      label="Moneda Origen"
                    />
                    <CurrencySearchSelect
                      currencies={currencies}
                      value={toCurrency}
                      onValueChange={setToCurrency}
                      placeholder="Moneda destino"
                      label="Moneda Destino"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Monto a Cambiar</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0.00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Monto Resultante</Label>
                      <div className="h-10 px-3 py-2 border rounded-md bg-gray-50 flex items-center font-bold">
                        {destinationAmount.toFixed(2)}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Observaciones (Opcional)</Label>
                    <Input
                      value={observation}
                      onChange={(e) => setObservation(e.target.value)}
                      placeholder="Observaciones adicionales"
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setStep('customer')}>
                      Atrás
                    </Button>
                    <Button 
                      onClick={handleExchangeFormSubmit}
                      disabled={!fromCurrency || !toCurrency || !amount || !rate}
                      className="flex-1"
                    >
                      Continuar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {step === 'details' && (
            <div className="space-y-4">
              {fromCurrency && (
                <CurrencyDetailForm
                  currency={getCurrency(fromCurrency)!}
                  title="Divisas Entregadas"
                  onDetailData={setDivisasEntregadas}
                  initialData={divisasEntregadas}
                />
              )}
              
              {toCurrency && (
                <CurrencyDetailForm
                  currency={getCurrency(toCurrency)!}
                  title="Divisas Recibidas"
                  onDetailData={setDivisasRecibidas}
                  initialData={divisasRecibidas}
                />
              )}

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep('exchange')}>
                  Atrás
                </Button>
                <Button onClick={performExchange} className="flex-1">
                  Completar Cambio
                </Button>
              </div>
            </div>
          )}
        </div>

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
                        {new Date(exchange.fecha).toLocaleString()}
                      </span>
                    </div>
                    <div className="text-sm space-y-1">
                      <p className="font-medium">
                        {exchange.datos_cliente?.nombre} {exchange.datos_cliente?.apellido}
                      </p>
                      <p>
                        {exchange.monto_origen} {getCurrencyName(exchange.moneda_origen_id)} → {' '}
                        {exchange.monto_destino.toFixed(2)} {getCurrencyName(exchange.moneda_destino_id)}
                      </p>
                      <p className="text-gray-600">
                        Tasa: {exchange.tasa_cambio}
                      </p>
                      {exchange.numero_recibo && (
                        <p className="text-gray-600 text-xs">
                          Recibo: {exchange.numero_recibo}
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
