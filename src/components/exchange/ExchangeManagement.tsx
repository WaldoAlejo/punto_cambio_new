
import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { User, AttentionPoint, Currency, CurrencyExchange } from '../../types';

interface ExchangeManagementProps {
  user: User;
  selectedPoint: AttentionPoint | null;
}

const ExchangeManagement = ({ user, selectedPoint }: ExchangeManagementProps) => {
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [exchanges, setExchanges] = useState<CurrencyExchange[]>([]);
  const [formData, setFormData] = useState({
    fromCurrency: '',
    toCurrency: '',
    amount: '',
    rate: '',
    transactionType: 'venta' as 'compra' | 'venta'
  });

  // Mock currencies
  const mockCurrencies: Currency[] = [
    { id: '1', code: 'USD', name: 'Dólar Estadounidense', symbol: '$', is_active: true, created_at: new Date().toISOString() },
    { id: '2', code: 'EUR', name: 'Euro', symbol: '€', is_active: true, created_at: new Date().toISOString() },
    { id: '3', code: 'VES', name: 'Bolívar Venezolano', symbol: 'Bs', is_active: true, created_at: new Date().toISOString() },
    { id: '4', code: 'COP', name: 'Peso Colombiano', symbol: '$', is_active: true, created_at: new Date().toISOString() }
  ];

  useEffect(() => {
    setCurrencies(mockCurrencies);
    // Load recent exchanges
    setExchanges([]);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedPoint) {
      toast({
        title: "Error",
        description: "Debe seleccionar un punto de atención",
        variant: "destructive"
      });
      return;
    }

    if (!formData.fromCurrency || !formData.toCurrency || !formData.amount || !formData.rate) {
      toast({
        title: "Error",
        description: "Todos los campos son obligatorios",
        variant: "destructive"
      });
      return;
    }

    if (formData.fromCurrency === formData.toCurrency) {
      toast({
        title: "Error",
        description: "Las monedas de origen y destino deben ser diferentes",
        variant: "destructive"
      });
      return;
    }

    const amount = parseFloat(formData.amount);
    const rate = parseFloat(formData.rate);
    const toAmount = amount * rate;

    const newExchange: CurrencyExchange = {
      id: Date.now().toString(),
      point_id: selectedPoint.id,
      user_id: user.id,
      from_currency_id: formData.fromCurrency,
      to_currency_id: formData.toCurrency,
      from_amount: amount,
      to_amount: toAmount,
      exchange_rate: rate,
      transaction_type: formData.transactionType,
      date: new Date().toISOString().split('T')[0],
      time: new Date().toTimeString().split(' ')[0],
      status: 'completado'
    };

    setExchanges(prev => [newExchange, ...prev]);
    
    // Reset form
    setFormData({
      fromCurrency: '',
      toCurrency: '',
      amount: '',
      rate: '',
      transactionType: 'venta'
    });

    toast({
      title: "Cambio registrado",
      description: `Cambio de ${amount} ${getCurrencyName(formData.fromCurrency)} por ${toAmount.toFixed(2)} ${getCurrencyName(formData.toCurrency)} completado`,
    });
  };

  const getCurrencyName = (currencyId: string) => {
    const currency = currencies.find(c => c.id === currencyId);
    return currency ? currency.code : '';
  };

  const calculateToAmount = () => {
    if (formData.amount && formData.rate) {
      return (parseFloat(formData.amount) * parseFloat(formData.rate)).toFixed(2);
    }
    return '0.00';
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
          Punto: {selectedPoint.name}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Form */}
        <Card>
          <CardHeader>
            <CardTitle>Nuevo Cambio</CardTitle>
            <CardDescription>Registre un nuevo cambio de divisas</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo de Transacción</Label>
                  <Select 
                    value={formData.transactionType} 
                    onValueChange={(value: 'compra' | 'venta') => setFormData(prev => ({ ...prev, transactionType: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="compra">Compra</SelectItem>
                      <SelectItem value="venta">Venta</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Moneda Origen</Label>
                  <Select 
                    value={formData.fromCurrency} 
                    onValueChange={(value) => setFormData(prev => ({ ...prev, fromCurrency: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent>
                      {currencies.map(currency => (
                        <SelectItem key={currency.id} value={currency.id}>
                          {currency.code} - {currency.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Moneda Destino</Label>
                  <Select 
                    value={formData.toCurrency} 
                    onValueChange={(value) => setFormData(prev => ({ ...prev, toCurrency: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent>
                      {currencies.map(currency => (
                        <SelectItem key={currency.id} value={currency.id}>
                          {currency.code} - {currency.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
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

                <div className="space-y-2">
                  <Label>Tasa de Cambio</Label>
                  <Input
                    type="number"
                    step="0.0001"
                    value={formData.rate}
                    onChange={(e) => setFormData(prev => ({ ...prev, rate: e.target.value }))}
                    placeholder="0.0000"
                  />
                </div>
              </div>

              {formData.amount && formData.rate && (
                <div className="p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-blue-700">
                    <span className="font-medium">Monto final:</span> {calculateToAmount()} {getCurrencyName(formData.toCurrency)}
                  </p>
                </div>
              )}

              <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700">
                Registrar Cambio
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Recent Exchanges */}
        <Card>
          <CardHeader>
            <CardTitle>Cambios Recientes</CardTitle>
            <CardDescription>Últimos cambios realizados hoy</CardDescription>
          </CardHeader>
          <CardContent>
            {exchanges.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                No hay cambios registrados hoy
              </div>
            ) : (
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {exchanges.map(exchange => (
                  <div key={exchange.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        exchange.transaction_type === 'compra' 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {exchange.transaction_type.toUpperCase()}
                      </span>
                      <span className="text-xs text-gray-500">{exchange.time}</span>
                    </div>
                    <div className="text-sm">
                      <p className="font-medium">
                        {exchange.from_amount} {getCurrencyName(exchange.from_currency_id)} → {exchange.to_amount.toFixed(2)} {getCurrencyName(exchange.to_currency_id)}
                      </p>
                      <p className="text-gray-600">Tasa: {exchange.exchange_rate}</p>
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
