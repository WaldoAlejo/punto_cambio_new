import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
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

  const handleSelect = (agenciaKey: string) => {
    if (agenciaKey === "clear") {
      setSelectedAgencia(null);
      onAgenciaSelect(null);
      return;
    }

    const agencia = agencias.find(
      (a) => `${a.nombre}-${a.ciudad}` === agenciaKey
    );
    if (agencia) {
      setSelectedAgencia(agencia);
      onAgenciaSelect(agencia);
    }
  };

  return (
    <div className="space-y-2">
      <Label>Agencia Servientrega</Label>
      <div className="flex gap-2">
        <Select
          value={
            selectedAgencia
              ? `${selectedAgencia.nombre}-${selectedAgencia.ciudad}`
              : ""
          }
          onValueChange={handleSelect}
          disabled={disabled || loading}
        >
          <SelectTrigger className="flex-1">
            <SelectValue
              placeholder={loading ? "Cargando agencias..." : placeholder}
            />
          </SelectTrigger>
          <SelectContent>
            {loading ? (
              <SelectItem value="loading" disabled>
                <div className="flex items-center">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Cargando agencias...
                </div>
              </SelectItem>
            ) : agencias.length === 0 ? (
              <SelectItem value="empty" disabled>
                No hay agencias disponibles
              </SelectItem>
            ) : (
              <>
                {selectedAgencia && (
                  <SelectItem value="clear">
                    <span className="text-gray-500">Limpiar selección</span>
                  </SelectItem>
                )}
                {agencias.map((agencia) => (
                  <SelectItem
                    key={`${agencia.nombre}-${agencia.ciudad}`}
                    value={`${agencia.nombre}-${agencia.ciudad}`}
                  >
                    <div className="flex flex-col">
                      <span className="font-medium">{agencia.nombre}</span>
                      <span className="text-sm text-gray-500">
                        {agencia.ciudad} - {agencia.direccion}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </>
            )}
          </SelectContent>
        </Select>
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
