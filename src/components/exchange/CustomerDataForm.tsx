
import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DatosCliente } from '../../types';

interface CustomerDataFormProps {
  onCustomerData: (data: DatosCliente) => void;
  initialData?: DatosCliente;
}

const CustomerDataForm = ({ onCustomerData, initialData }: CustomerDataFormProps) => {
  const [customerData, setCustomerData] = useState<DatosCliente>(
    initialData || {
      nombre: '',
      apellido: '',
      cedula: '',
      telefono: ''
    }
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCustomerData(customerData);
  };

  const isFormValid = () => {
    return customerData.nombre && customerData.apellido && customerData.cedula;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Datos del Cliente</CardTitle>
        <CardDescription>Ingrese los datos del cliente para el cambio de divisas</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nombre *</Label>
              <Input
                value={customerData.nombre}
                onChange={(e) => setCustomerData(prev => ({ ...prev, nombre: e.target.value }))}
                placeholder="Nombre del cliente"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Apellido *</Label>
              <Input
                value={customerData.apellido}
                onChange={(e) => setCustomerData(prev => ({ ...prev, apellido: e.target.value }))}
                placeholder="Apellido del cliente"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Cédula *</Label>
              <Input
                value={customerData.cedula}
                onChange={(e) => setCustomerData(prev => ({ ...prev, cedula: e.target.value }))}
                placeholder="Número de cédula"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Teléfono</Label>
              <Input
                value={customerData.telefono}
                onChange={(e) => setCustomerData(prev => ({ ...prev, telefono: e.target.value }))}
                placeholder="Número de teléfono"
              />
            </div>
          </div>

          <Button 
            type="submit" 
            className="w-full"
            disabled={!isFormValid()}
          >
            Confirmar Datos del Cliente
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export default CustomerDataForm;
