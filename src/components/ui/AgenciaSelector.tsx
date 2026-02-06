import { useState, useEffect } from "react";
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
        console.error("❌ AgenciaSelector: Error del servicio:", error);
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
    } catch {
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
    <div className="space-y-3">
      <Label className="text-sm font-medium">Agencia Servientrega</Label>
      <Select
        value={
          selectedAgencia
            ? `${selectedAgencia.nombre}-${selectedAgencia.ciudad}-${selectedAgencia.tipo_cs}`
            : ""
        }
        onValueChange={handleSelect}
        disabled={disabled || loading}
      >
        <SelectTrigger className="w-full">
          <SelectValue
            placeholder={loading ? "Cargando agencias..." : placeholder}
          />
        </SelectTrigger>
        <SelectContent className="max-h-[300px] max-w-[500px]">
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
                  <span className="text-gray-500 italic">
                    Limpiar selección
                  </span>
                </SelectItem>
              )}
              {agencias.map((agencia) => {
                // Verificar si hay otras agencias con el mismo nombre
                const duplicateCount = agencias.filter(
                  (a) => a.nombre === agencia.nombre
                ).length;
                const isDuplicate = duplicateCount > 1;

                return (
                  <SelectItem
                    key={`${agencia.nombre}-${agencia.ciudad}-${agencia.tipo_cs}`}
                    value={`${agencia.nombre}-${agencia.ciudad}-${agencia.tipo_cs}`}
                    className="py-3"
                  >
                    <div className="flex flex-col gap-1 w-full max-w-[400px]">
                      <div className="flex items-start gap-2">
                        <span className="font-medium text-sm leading-tight flex-1 min-w-0">
                          {agencia.nombre}
                        </span>
                        {isDuplicate && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full flex-shrink-0">
                            {duplicateCount}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-600 flex items-center gap-1">
                        <span>📍</span>
                        <span className="truncate">
                          {agencia.ciudad.trim()}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 line-clamp-2 leading-tight">
                        {agencia.direccion.trim()}
                      </div>
                      <div className="text-xs text-blue-600 font-mono">
                        {agencia.tipo_cs.trim()}
                      </div>
                    </div>
                  </SelectItem>
                );
              })}
            </>
          )}
        </SelectContent>
      </Select>

      {selectedAgencia && (
        <div className="text-sm bg-blue-50 border border-blue-200 rounded-lg p-3 max-w-full">
          <div className="font-medium text-blue-900 mb-2 flex items-center gap-2">
            <span className="text-green-600">✅</span>
            <span>Agencia seleccionada</span>
          </div>
          <div className="space-y-2 text-blue-800">
            <div className="break-words">
              <strong className="text-blue-900">Nombre:</strong>
              <br />
              <span className="text-sm">{selectedAgencia.nombre}</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <strong className="text-blue-900">Ciudad:</strong>
                <br />
                <span className="text-sm">{selectedAgencia.ciudad.trim()}</span>
              </div>
              <div>
                <strong className="text-blue-900">Código:</strong>
                <br />
                <code className="bg-blue-100 px-2 py-1 rounded text-xs font-mono">
                  {selectedAgencia.tipo_cs.trim()}
                </code>
              </div>
            </div>
            <div className="break-words">
              <strong className="text-blue-900">Dirección:</strong>
              <br />
              <span className="text-sm leading-relaxed">
                {selectedAgencia.direccion.trim()}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
