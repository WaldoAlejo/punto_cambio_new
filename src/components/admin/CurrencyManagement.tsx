
import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { User, Moneda } from '../../types';

interface CurrencyManagementProps {
  user: User;
}

const CurrencyManagement = ({ user }: CurrencyManagementProps) => {
  const [currencies, setCurrencies] = useState<Moneda[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    codigo: '',
    nombre: '',
    simbolo: ''
  });

  useEffect(() => {
    // Load mock currencies
    const mockCurrencies: Moneda[] = [
      { id: '1', codigo: 'USD', nombre: 'Dólar Estadounidense', simbolo: '$', activo: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: '2', codigo: 'EUR', nombre: 'Euro', simbolo: '€', activo: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: '3', codigo: 'VES', nombre: 'Bolívar Venezolano', simbolo: 'Bs', activo: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
      { id: '4', codigo: 'COP', nombre: 'Peso Colombiano', simbolo: '$', activo: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
    ];
    setCurrencies(mockCurrencies);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.codigo || !formData.nombre || !formData.simbolo) {
      toast({
        title: "Error",
        description: "Todos los campos son obligatorios",
        variant: "destructive"
      });
      return;
    }

    // Check if currency code exists
    if (currencies.some(c => c.codigo.toLowerCase() === formData.codigo.toLowerCase())) {
      toast({
        title: "Error",
        description: "El código de moneda ya existe",
        variant: "destructive"
      });
      return;
    }

    const newCurrency: Moneda = {
      id: Date.now().toString(),
      codigo: formData.codigo.toUpperCase(),
      nombre: formData.nombre,
      simbolo: formData.simbolo,
      activo: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    setCurrencies(prev => [...prev, newCurrency]);
    
    // Reset form
    setFormData({
      codigo: '',
      nombre: '',
      simbolo: ''
    });
    setShowForm(false);

    toast({
      title: "Moneda creada",
      description: `Moneda ${newCurrency.nombre} creada exitosamente`,
    });
  };

  const toggleCurrencyStatus = (currencyId: string) => {
    setCurrencies(prev => prev.map(c => 
      c.id === currencyId ? { ...c, activo: !c.activo } : c
    ));
    
    const targetCurrency = currencies.find(c => c.id === currencyId);
    toast({
      title: "Estado actualizado",
      description: `Moneda ${targetCurrency?.nombre} ${targetCurrency?.activo ? 'desactivada' : 'activada'}`,
    });
  };

  if (user.rol !== 'ADMIN' && user.rol !== 'SUPER_USUARIO') {
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
                    value={formData.codigo}
                    onChange={(e) => setFormData(prev => ({ ...prev, codigo: e.target.value.toUpperCase() }))}
                    placeholder="USD"
                    maxLength={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Símbolo</Label>
                  <Input
                    value={formData.simbolo}
                    onChange={(e) => setFormData(prev => ({ ...prev, simbolo: e.target.value }))}
                    placeholder="$"
                    maxLength={5}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Nombre Completo</Label>
                <Input
                  value={formData.nombre}
                  onChange={(e) => setFormData(prev => ({ ...prev, nombre: e.target.value }))}
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
                  <TableCell className="font-medium">{currency.codigo}</TableCell>
                  <TableCell>{currency.nombre}</TableCell>
                  <TableCell>{currency.simbolo}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      currency.activo 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {currency.activo ? 'Activa' : 'Inactiva'}
                    </span>
                  </TableCell>
                  <TableCell>
                    {new Date(currency.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant={currency.activo ? "destructive" : "default"}
                      onClick={() => toggleCurrencyStatus(currency.id)}
                    >
                      {currency.activo ? 'Desactivar' : 'Activar'}
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
