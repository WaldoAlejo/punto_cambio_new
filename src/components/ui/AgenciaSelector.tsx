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
      // Buscar por nombre exacto primero
      let agencia = agencias.find((a) => a.nombre === value);

      // Si no se encuentra por nombre exacto, buscar por nombre que contenga el valor
      if (!agencia) {
        agencia = agencias.find((a) =>
          a.nombre.toLowerCase().includes(value.toLowerCase())
        );
      }

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

      // Detectar agencias duplicadas para debugging
      const duplicates = fetchedAgencias.filter(
        (agencia, index, arr) =>
          arr.findIndex(
            (a) => a.nombre === agencia.nombre && a.ciudad === agencia.ciudad
          ) !== index
      );

      if (duplicates.length > 0) {
        console.warn("⚠️ Agencias duplicadas detectadas:", duplicates);
      }

      // Ordenar agencias por nombre y ciudad para mejor UX
      const sortedAgencias = fetchedAgencias.sort((a, b) => {
        const nameCompare = a.nombre.localeCompare(b.nombre);
        if (nameCompare !== 0) return nameCompare;
        return a.ciudad.localeCompare(b.ciudad);
      });

      setAgencias(sortedAgencias);
      console.log(`✅ ${sortedAgencias.length} agencias cargadas y ordenadas`);
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

    // Usar una clave más específica que incluya tipo_cs para evitar duplicados
    const agencia = agencias.find(
      (a) => `${a.nombre}-${a.ciudad}-${a.tipo_cs}` === agenciaKey
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
              ? `${selectedAgencia.nombre}-${selectedAgencia.ciudad}-${selectedAgencia.tipo_cs}`
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
                {agencias.map((agencia, index) => {
                  // Verificar si hay otras agencias con el mismo nombre
                  const duplicateCount = agencias.filter(
                    (a) => a.nombre === agencia.nombre
                  ).length;
                  const isDuplicate = duplicateCount > 1;

                  return (
                    <SelectItem
                      key={`${agencia.nombre}-${agencia.ciudad}-${agencia.tipo_cs}`}
                      value={`${agencia.nombre}-${agencia.ciudad}-${agencia.tipo_cs}`}
                    >
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{agencia.nombre}</span>
                          {isDuplicate && (
                            <span className="text-xs bg-yellow-100 text-yellow-800 px-1 rounded">
                              {duplicateCount} ubicaciones
                            </span>
                          )}
                        </div>
                        <span className="text-sm text-gray-500">
                          {agencia.ciudad} - {agencia.direccion}
                        </span>
                        <span className="text-xs text-blue-600">
                          Código: {agencia.tipo_cs}
                        </span>
                      </div>
                    </SelectItem>
                  );
                })}
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
          <br />
          <strong>Código:</strong> {selectedAgencia.tipo_cs}
        </div>
      )}
    </div>
  );
}
