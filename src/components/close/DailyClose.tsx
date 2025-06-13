
import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { User, AttentionPoint, Currency, DailyClose as DailyCloseType } from '../../types';

interface DailyCloseProps {
  user: User;
  selectedPoint: AttentionPoint | null;
}

const DailyClose = ({ user, selectedPoint }: DailyCloseProps) => {
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [balances, setBalances] = useState<{ [key: string]: { bills: string, coins: string } }>({});
  const [todayClose, setTodayClose] = useState<DailyCloseType | null>(null);

  // Mock currencies
  const mockCurrencies: Currency[] = [
    { id: '1', code: 'USD', name: 'Dólar Estadounidense', symbol: '$', is_active: true, created_at: new Date().toISOString() },
    { id: '2', code: 'EUR', name: 'Euro', symbol: '€', is_active: true, created_at: new Date().toISOString() },
    { id: '3', code: 'VES', name: 'Bolívar Venezolano', symbol: 'Bs', is_active: true, created_at: new Date().toISOString() }
  ];

  useEffect(() => {
    setCurrencies(mockCurrencies);
    
    // Initialize balances
    const initialBalances: { [key: string]: { bills: string, coins: string } } = {};
    mockCurrencies.forEach(currency => {
      initialBalances[currency.id] = { bills: '', coins: '' };
    });
    setBalances(initialBalances);

    // Check if there's already a close for today
    setTodayClose(null);
  }, [selectedPoint]);

  const handleBalanceChange = (currencyId: string, type: 'bills' | 'coins', value: string) => {
    setBalances(prev => ({
      ...prev,
      [currencyId]: {
        ...prev[currencyId],
        [type]: value
      }
    }));
  };

  const calculateTotalBalance = (currencyId: string) => {
    const bills = parseFloat(balances[currencyId]?.bills || '0');
    const coins = parseFloat(balances[currencyId]?.coins || '0');
    return bills + coins;
  };

  const performDailyClose = () => {
    if (!selectedPoint) {
      toast({
        title: "Error",
        description: "Debe seleccionar un punto de atención",
        variant: "destructive"
      });
      return;
    }

    // Validate that all balances are filled
    const incompleteBalances = currencies.some(currency => 
      !balances[currency.id]?.bills || !balances[currency.id]?.coins
    );

    if (incompleteBalances) {
      toast({
        title: "Error",
        description: "Debe completar todos los saldos antes del cierre",
        variant: "destructive"
      });
      return;
    }

    // Create daily close
    const newClose: DailyCloseType = {
      id: Date.now().toString(),
      point_id: selectedPoint.id,
      date: new Date().toISOString().split('T')[0],
      user_id: user.id,
      currency_balances: currencies.map(currency => ({
        currency_id: currency.id,
        currency: currency,
        opening_balance: 10000, // Mock opening balance
        closing_balance: calculateTotalBalance(currency.id),
        bills_count: parseFloat(balances[currency.id]?.bills || '0'),
        coins_count: parseFloat(balances[currency.id]?.coins || '0'),
        calculated_balance: calculateTotalBalance(currency.id),
        difference: calculateTotalBalance(currency.id) - 10000 // Mock difference
      })),
      total_exchanges: 15, // Mock data
      total_transfers_in: 2,
      total_transfers_out: 1,
      status: 'cerrado',
      closed_at: new Date().toISOString()
    };

    setTodayClose(newClose);

    toast({
      title: "Cierre realizado",
      description: "El cierre diario se ha completado exitosamente",
    });
  };

  const generateCloseReport = () => {
    if (!todayClose) return;

    // In a real application, this would generate and download a report
    toast({
      title: "Reporte generado",
      description: "El reporte de cierre diario se ha generado",
    });
  };

  if (!selectedPoint) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">Debe seleccionar un punto de atención para realizar el cierre</p>
        </div>
      </div>
    );
  }

  if (user.role !== 'operador' && user.role !== 'concesion') {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-red-500 text-lg">Solo operadores y concesiones pueden realizar cierres diarios</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Cierre Diario</h1>
        <div className="text-sm text-gray-500">
          Punto: {selectedPoint.name} - {new Date().toLocaleDateString()}
        </div>
      </div>

      {!todayClose ? (
        <Card>
          <CardHeader>
            <CardTitle>Cuadre de Caja</CardTitle>
            <CardDescription>Ingrese los saldos de billetes y monedas por cada divisa</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {currencies.map(currency => (
                <div key={currency.id} className="border rounded-lg p-4">
                  <h3 className="font-semibold text-lg mb-4">
                    {currency.code} - {currency.name}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Billetes</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={balances[currency.id]?.bills || ''}
                        onChange={(e) => handleBalanceChange(currency.id, 'bills', e.target.value)}
                        placeholder="0.00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Monedas</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={balances[currency.id]?.coins || ''}
                        onChange={(e) => handleBalanceChange(currency.id, 'coins', e.target.value)}
                        placeholder="0.00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Total</Label>
                      <div className="h-10 px-3 py-2 border rounded-md bg-gray-50 flex items-center">
                        {calculateTotalBalance(currency.id).toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              <Button 
                onClick={performDailyClose}
                className="w-full bg-green-600 hover:bg-green-700 text-white py-3"
                size="lg"
              >
                Realizar Cierre Diario
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Cierre Completado</CardTitle>
            <CardDescription>
              Cierre diario realizado el {new Date(todayClose.closed_at!).toLocaleString()}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-blue-700">Total Cambios</h4>
                  <p className="text-2xl font-bold text-blue-600">{todayClose.total_exchanges}</p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-green-700">Transferencias Entrada</h4>
                  <p className="text-2xl font-bold text-green-600">{todayClose.total_transfers_in}</p>
                </div>
                <div className="bg-orange-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-orange-700">Transferencias Salida</h4>
                  <p className="text-2xl font-bold text-orange-600">{todayClose.total_transfers_out}</p>
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Moneda</TableHead>
                    <TableHead>Saldo Inicial</TableHead>
                    <TableHead>Billetes</TableHead>
                    <TableHead>Monedas</TableHead>
                    <TableHead>Total Final</TableHead>
                    <TableHead>Diferencia</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {todayClose.currency_balances.map(balance => (
                    <TableRow key={balance.currency_id}>
                      <TableCell className="font-medium">{balance.currency.code}</TableCell>
                      <TableCell>{balance.opening_balance.toFixed(2)}</TableCell>
                      <TableCell>{balance.bills_count.toFixed(2)}</TableCell>
                      <TableCell>{balance.coins_count.toFixed(2)}</TableCell>
                      <TableCell>{balance.closing_balance.toFixed(2)}</TableCell>
                      <TableCell className={balance.difference >= 0 ? 'text-green-600' : 'text-red-600'}>
                        {balance.difference.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="flex justify-end">
                <Button 
                  onClick={generateCloseReport}
                  variant="outline"
                  className="border-blue-600 text-blue-600 hover:bg-blue-50"
                >
                  Generar Reporte
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default DailyClose;
