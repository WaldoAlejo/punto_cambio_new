import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Agencia } from "../../types";
import { servientregaService } from "../../services/servientregaService";
import { toast } from "@/hooks/use-toast";

interface AgenciaSelectorProps {
  value?: string;
  onAgenciaSelect: (agencia: Agencia | null) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function AgenciaSelector({
  value = "",
  onAgenciaSelect,
  placeholder = "Seleccionar agencia...",
  disabled = false,
}: AgenciaSelectorProps) {
  const [open, setOpen] = useState(false);
  const [agencias, setAgencias] = useState<Agencia[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedAgencia, setSelectedAgencia] = useState<Agencia | null>(null);

  // Cargar agencias al montar el componente
  useEffect(() => {
    loadAgencias();
  }, []);

  // Buscar la agencia seleccionada cuando cambia el value
  useEffect(() => {
    if (value && agencias.length > 0) {
      const agencia = agencias.find((a) => a.nombre === value);
      setSelectedAgencia(agencia || null);
    } else {
      setSelectedAgencia(null);
    }
  }, [value, agencias]);

  const loadAgencias = async () => {
    setLoading(true);
    try {
      const { agencias: fetchedAgencias, error } =
        await servientregaService.getAgencias();
      if (error) {
        toast({
          title: "Error",
          description: error,
          variant: "destructive",
        });
        return;
      }
      setAgencias(fetchedAgencias);
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al cargar agencias de Servientrega",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (agencia: Agencia) => {
    setSelectedAgencia(agencia);
    onAgenciaSelect(agencia);
    setOpen(false);
  };

  const handleClear = () => {
    setSelectedAgencia(null);
    onAgenciaSelect(null);
  };

  return (
    <div className="space-y-2">
      <Label>Agencia Servientrega</Label>
      <div className="flex gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="flex-1 justify-between"
              disabled={disabled || loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Cargando...
                </>
              ) : selectedAgencia ? (
                <span className="truncate">
                  {selectedAgencia.nombre} - {selectedAgencia.ciudad}
                </span>
              ) : (
                placeholder
              )}
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-full p-0" align="start">
            <Command>
              <CommandInput placeholder="Buscar agencia..." />
              <CommandList>
                <CommandEmpty>No se encontraron agencias.</CommandEmpty>
                <CommandGroup>
                  {agencias.map((agencia) => (
                    <CommandItem
                      key={`${agencia.nombre}-${agencia.ciudad}`}
                      value={`${agencia.nombre} ${agencia.ciudad} ${agencia.direccion}`}
                      onSelect={() => handleSelect(agencia)}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          selectedAgencia?.nombre === agencia.nombre
                            ? "opacity-100"
                            : "opacity-0"
                        )}
                      />
                      <div className="flex flex-col">
                        <span className="font-medium">{agencia.nombre}</span>
                        <span className="text-sm text-gray-500">
                          {agencia.ciudad} - {agencia.direccion}
                        </span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        {selectedAgencia && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleClear}
            disabled={disabled}
          >
            Limpiar
          </Button>
        )}
      </div>
      {selectedAgencia && (
        <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
          <strong>Seleccionada:</strong> {selectedAgencia.nombre}
          <br />
          <strong>Ciudad:</strong> {selectedAgencia.ciudad}
          <br />
          <strong>Dirección:</strong> {selectedAgencia.direccion}
        </div>
      )}
    </div>
  );
}
