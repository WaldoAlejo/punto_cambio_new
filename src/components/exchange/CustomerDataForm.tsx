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
import { Separator } from "@/components/ui/separator";
import CustomerSearch from "@/components/ui/customer-search";
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
  // Siempre iniciamos con todos los campos definidos para evitar undefined/null
  const [customerData, setCustomerData] = useState<DatosCliente>({
    ...emptyCustomer,
    ...initialData,
    // Normalizamos por si initialData trae nulls
    nombre: (initialData?.nombre ?? "").trim(),
    apellido: (initialData?.apellido ?? "").trim(),
    cedula: (initialData?.cedula ?? "").trim(),
    telefono: (initialData?.telefono ?? "") || "",
    documento:
      (initialData?.documento ?? "").trim() ||
      (initialData?.cedula ?? "").trim() ||
      "",
  });

  const isFormValid = () => {
    return (
      customerData.nombre.trim().length > 0 &&
      customerData.apellido.trim().length > 0 &&
      customerData.cedula.trim().length > 0
    );
  };

  const handleCustomerSelect = (selected: DatosCliente) => {
    // Blindaje: mezclamos con empty y normalizamos documento = cedula si viene vacío
    const normalized: DatosCliente = {
      ...emptyCustomer,
      ...selected,
      nombre: (selected.nombre ?? "").trim(),
      apellido: (selected.apellido ?? "").trim(),
      cedula: (selected.cedula ?? "").trim(),
      telefono: (selected.telefono ?? "") || "",
      documento:
        (selected.documento ?? "").trim() ||
        (selected.cedula ?? "").trim() ||
        "",
    };
    setCustomerData(normalized);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Normalizamos antes de enviar al backend (evita “faltan datos” por strings vacíos/espacios)
    const sanitized: DatosCliente = {
      nombre: customerData.nombre.trim(),
      apellido: customerData.apellido.trim(),
      cedula: customerData.cedula.trim(),
      telefono: (customerData.telefono ?? "").trim(),
      documento:
        (customerData.documento ?? "").trim() ||
        customerData.cedula.trim() ||
        "",
    };

    // Validación final en el cliente (coincide con las reglas del backend)
    if (!sanitized.nombre || !sanitized.apellido || !sanitized.cedula) {
      return;
    }

    onCustomerData(sanitized);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>👤 Datos del Cliente</CardTitle>
        <CardDescription>
          Busque un cliente existente o ingrese los datos manualmente
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Búsqueda de clientes */}
        <div className="space-y-3 mb-4">
          <Label className="text-sm font-medium">
            Buscar Cliente Existente
          </Label>
          <CustomerSearch
            onSelectCustomer={handleCustomerSelect}
            placeholder="Buscar por nombre o cédula..."
          />
        </div>

        <Separator className="my-4" />

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="nombre" className="text-sm font-medium">
                Nombre *
              </Label>
              <Input
                id="nombre"
                value={customerData.nombre}
                onChange={(e) =>
                  setCustomerData((prev) => ({
                    ...prev,
                    nombre: e.target.value,
                  }))
                }
                placeholder="Nombre"
                className="h-9"
                autoComplete="given-name"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="apellido" className="text-sm font-medium">
                Apellido *
              </Label>
              <Input
                id="apellido"
                value={customerData.apellido}
                onChange={(e) =>
                  setCustomerData((prev) => ({
                    ...prev,
                    apellido: e.target.value,
                  }))
                }
                placeholder="Apellido"
                className="h-9"
                autoComplete="family-name"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="cedula" className="text-sm font-medium">
                Cédula *
              </Label>
              <Input
                id="cedula"
                inputMode="numeric"
                value={customerData.cedula}
                onChange={(e) => {
                  const value = e.target.value;
                  setCustomerData((prev) => ({
                    ...prev,
                    cedula: value,
                    // Alineado con el backend: si documento está vacío, lo igualamos a la cédula
                    documento:
                      prev.documento && prev.documento.trim()
                        ? prev.documento
                        : value,
                  }));
                }}
                placeholder="Número de cédula"
                className="h-9"
                autoComplete="off"
                required
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="telefono" className="text-sm font-medium">
                Teléfono
              </Label>
              <Input
                id="telefono"
                inputMode="tel"
                value={customerData.telefono || ""}
                onChange={(e) =>
                  setCustomerData((prev) => ({
                    ...prev,
                    telefono: e.target.value,
                  }))
                }
                placeholder="Número de teléfono"
                className="h-9"
                autoComplete="tel"
              />
            </div>
          </div>

          {/* Campo documento oculto para mantener consistencia con el backend */}
          <input
            type="hidden"
            value={
              (customerData.documento ?? "").trim() ||
              customerData.cedula.trim() ||
              ""
            }
            readOnly
          />

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
