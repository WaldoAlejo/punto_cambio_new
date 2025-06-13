
import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { User, Currency } from '../../types';

interface CurrencyManagementProps {
  user: User;
}

const CurrencyManagement = ({ user }: CurrencyManagementProps) => {
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    code: '',
    name: '',
    symbol: ''
  });

  useEffect(() => {
    // Load mock currencies
    const mockCurrencies: Currency[] = [
      { id: '1', code: 'USD', name: 'Dólar Estadounidense', symbol: '$', is_active: true, created_at: new Date().toISOString() },
      { id: '2', code: 'EUR', name: 'Euro', symbol: '€', is_active: true, created_at: new Date().toISOString() },
      { id: '3', code: 'VES', name: 'Bolívar Venezolano', symbol: 'Bs', is_active: true, created_at: new Date().toISOString() },
      { id: '4', code: 'COP', name: 'Peso Colombiano', symbol: '$', is_active: true, created_at: new Date().toISOString() }
    ];
    setCurrencies(mockCurrencies);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.code || !formData.name || !formData.symbol) {
      toast({
        title: "Error",
        description: "Todos los campos son obligatorios",
        variant: "destructive"
      });
      return;
    }

    // Check if currency code exists
    if (currencies.some(c => c.code.toLowerCase() === formData.code.toLowerCase())) {
      toast({
        title: "Error",
        description: "El código de moneda ya existe",
        variant: "destructive"
      });
      return;
    }

    const newCurrency: Currency = {
      id: Date.now().toString(),
      code: formData.code.toUpperCase(),
      name: formData.name,
      symbol: formData.symbol,
      is_active: true,
      created_at: new Date().toISOString()
    };

    setCurrencies(prev => [...prev, newCurrency]);
    
    // Reset form
    setFormData({
      code: '',
      name: '',
      symbol: ''
    });
    setShowForm(false);

    toast({
      title: "Moneda creada",
      description: `Moneda ${newCurrency.name} creada exitosamente`,
    });
  };

  const toggleCurrencyStatus = (currencyId: string) => {
    setCurrencies(prev => prev.map(c => 
      c.id === currencyId ? { ...c, is_active: !c.is_active } : c
    ));
    
    const targetCurrency = currencies.find(c => c.id === currencyId);
    toast({
      title: "Estado actualizado",
      description: `Moneda ${targetCurrency?.name} ${targetCurrency?.is_active ? 'desactivada' : 'activada'}`,
    });
  };

  if (user.role !== 'administrador' && user.role !== 'super_usuario') {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-red-500 text-lg">No tiene permisos para acceder a esta sección</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Gestión de Monedas</h1>
        <Button 
          onClick={() => setShowForm(!showForm)}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {showForm ? 'Cancelar' : 'Nueva Moneda'}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Crear Nueva Moneda</CardTitle>
            <CardDescription>Complete la información de la nueva moneda</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Código</Label>
                  <Input
                    value={formData.code}
                    onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                    placeholder="USD"
                    maxLength={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Símbolo</Label>
                  <Input
                    value={formData.symbol}
                    onChange={(e) => setFormData(prev => ({ ...prev, symbol: e.target.value }))}
                    placeholder="$"
                    maxLength={5}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Nombre Completo</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Dólar Estadounidense"
                />
              </div>

              <div className="flex gap-2">
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700">
                  Crear Moneda
                </Button>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setShowForm(false)}
                >
                  Cancelar
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Monedas del Sistema</CardTitle>
          <CardDescription>Lista de todas las monedas registradas</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Símbolo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Fecha Creación</TableHead>
                <TableHead>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {currencies.map((currency) => (
                <TableRow key={currency.id}>
                  <TableCell className="font-medium">{currency.code}</TableCell>
                  <TableCell>{currency.name}</TableCell>
                  <TableCell>{currency.symbol}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      currency.is_active 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {currency.is_active ? 'Activa' : 'Inactiva'}
                    </span>
                  </TableCell>
                  <TableCell>
                    {new Date(currency.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant={currency.is_active ? "destructive" : "default"}
                      onClick={() => toggleCurrencyStatus(currency.id)}
                    >
                      {currency.is_active ? 'Desactivar' : 'Activar'}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default CurrencyManagement;
