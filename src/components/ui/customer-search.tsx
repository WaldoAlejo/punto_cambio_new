import { useState, useEffect, useRef } from "react";
import { Search, User, Clock, FileText } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { exchangeService, ClienteEncontrado } from "@/services/exchangeService";
import { DatosCliente } from "@/types";

interface CustomerSearchProps {
  onSelectCustomer: (customer: DatosCliente) => void;
  placeholder?: string;
}

const CustomerSearch = ({
  onSelectCustomer,
  placeholder = "Buscar cliente por nombre o cédula...",
}: CustomerSearchProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [customers, setCustomers] = useState<ClienteEncontrado[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Cerrar dropdown cuando se hace clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchRef.current &&
        !searchRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Buscar clientes cuando cambia el término de búsqueda
  useEffect(() => {
    const searchCustomers = async () => {
      if (searchTerm.trim().length < 2) {
        setCustomers([]);
        setIsOpen(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const { clientes, error } = await exchangeService.searchCustomers(
          searchTerm
        );

        if (error) {
          setError(error);
          setCustomers([]);
        } else {
          setCustomers(clientes);
          setIsOpen(clientes.length > 0);
        }
      } catch {
        setError("Error al buscar clientes");
        setCustomers([]);
      } finally {
        setIsLoading(false);
      }
    };

    const timeoutId = setTimeout(searchCustomers, 300); // Debounce
    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  const handleSelectCustomer = (customer: ClienteEncontrado) => {
    const customerData: DatosCliente = {
      nombre: customer.nombre,
      apellido: customer.apellido,
      documento: customer.cedula,
      cedula: customer.cedula,
      telefono: customer.telefono,
    };

    onSelectCustomer(customerData);
    setSearchTerm(`${customer.nombre} ${customer.apellido}`);
    setIsOpen(false);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const clearSearch = () => {
    setSearchTerm("");
    setCustomers([]);
    setIsOpen(false);
    inputRef.current?.focus();
  };

  return (
    <div ref={searchRef} className="relative w-full">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
        <Input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 pr-20 h-10"
          onFocus={() => {
            if (customers.length > 0) {
              setIsOpen(true);
            }
          }}
        />
        {searchTerm && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clearSearch}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0 hover:bg-gray-100"
          >
            ×
          </Button>
        )}
      </div>

      {/* Dropdown de resultados */}
      {isOpen && (
        <Card className="absolute top-full left-0 right-0 z-50 mt-1 max-h-80 overflow-y-auto shadow-lg border">
          <CardContent className="p-0">
            {isLoading && (
              <div className="p-4 text-center text-gray-500">
                <div className="animate-spin h-5 w-5 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                Buscando clientes...
              </div>
            )}

            {error && (
              <div className="p-4 text-center text-red-500">{error}</div>
            )}

            {!isLoading &&
              !error &&
              customers.length === 0 &&
              searchTerm.length >= 2 && (
                <div className="p-4 text-center text-gray-500">
                  <User className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                  No se encontraron clientes
                </div>
              )}

            {!isLoading && !error && customers.length > 0 && (
              <div className="divide-y">
                {customers.map((customer) => (
                  <div
                    key={`${customer.fuente}-${customer.id}`}
                    className="p-3 hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => handleSelectCustomer(customer)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <User className="h-4 w-4 text-blue-500" />
                          <span className="font-medium text-gray-900">
                            {customer.nombre} {customer.apellido}
                          </span>
                          <Badge
                            variant={
                              customer.fuente === "recibo"
                                ? "default"
                                : "secondary"
                            }
                            className="text-xs"
                          >
                            {customer.fuente === "recibo"
                              ? "Completo"
                              : "Básico"}
                          </Badge>
                        </div>

                        <div className="text-sm text-gray-600 space-y-1">
                          {customer.cedula && (
                            <div>
                              <span className="font-medium">Cédula:</span>{" "}
                              {customer.cedula}
                            </div>
                          )}
                          {customer.telefono && (
                            <div>
                              <span className="font-medium">Teléfono:</span>{" "}
                              {customer.telefono}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="text-right text-xs text-gray-500 ml-4">
                        <div className="flex items-center gap-1 mb-1">
                          <Clock className="h-3 w-3" />
                          {formatDate(customer.fecha_ultima_operacion)}
                        </div>
                        {customer.numero_recibo && (
                          <div className="flex items-center gap-1">
                            <FileText className="h-3 w-3" />
                            {customer.numero_recibo}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default CustomerSearch;
