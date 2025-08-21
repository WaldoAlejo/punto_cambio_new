import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DatosCliente } from "../../types";

interface CustomerDataFormProps {
  onCustomerData: (data: DatosCliente) => void;
  initialData?: DatosCliente;
}

const emptyCustomer: DatosCliente = {
  nombre: "",
  apellido: "",
  documento: "",
  cedula: "",
  telefono: "",
};

const CustomerDataForm = ({
  onCustomerData,
  initialData,
}: CustomerDataFormProps) => {
  // Blindaje: siempre todos los campos iniciales definidos
  const [customerData, setCustomerData] = useState<DatosCliente>({
    ...emptyCustomer,
    ...initialData,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCustomerData(customerData);
  };

  const isFormValid = () => {
    return !!(
      customerData.nombre &&
      customerData.apellido &&
      customerData.cedula
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Datos del Cliente</CardTitle>
        <CardDescription>
          Ingrese los datos del cliente para el cambio de divisas
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-sm font-medium">Nombre *</Label>
              <Input
                value={customerData.nombre}
                onChange={(e) =>
                  setCustomerData((prev) => ({
                    ...prev,
                    nombre: e.target.value,
                  }))
                }
                placeholder="Nombre"
                className="h-9"
                required
              />
            </div>
            <div className="space-y-1">
              <Label className="text-sm font-medium">Apellido *</Label>
              <Input
                value={customerData.apellido}
                onChange={(e) =>
                  setCustomerData((prev) => ({
                    ...prev,
                    apellido: e.target.value,
                  }))
                }
                placeholder="Apellido"
                className="h-9"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-sm font-medium">Cédula *</Label>
              <Input
                value={customerData.cedula}
                onChange={(e) =>
                  setCustomerData((prev) => ({
                    ...prev,
                    cedula: e.target.value,
                    documento: e.target.value,
                  }))
                }
                placeholder="Número de cédula"
                className="h-9"
                required
              />
            </div>
            <div className="space-y-1">
              <Label className="text-sm font-medium">Teléfono</Label>
              <Input
                value={customerData.telefono}
                onChange={(e) =>
                  setCustomerData((prev) => ({
                    ...prev,
                    telefono: e.target.value,
                  }))
                }
                placeholder="Número de teléfono"
                className="h-9"
              />
            </div>
          </div>

          <Button
            type="submit"
            className="w-full h-10"
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
