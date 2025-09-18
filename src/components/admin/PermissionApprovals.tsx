import { useEffect, useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { permissionService } from "@/services/permissionService";
import type { Permiso, EstadoPermiso } from "@/types";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";

type EstadoFiltro = EstadoPermiso | "TODOS";

export default function PermissionApprovals() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Permiso[]>([]);
  const [estado, setEstado] = useState<EstadoFiltro>("TODOS");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  const canModerate =
    user && (user.rol === "ADMIN" || user.rol === "SUPER_USUARIO");

  const load = async () => {
    setLoading(true);
    try {
      const { permisos } = await permissionService.list();
      setItems(permisos);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onApprove = async (id: string) => {
    await permissionService.approve(id);
    await load();
  };

  const onReject = async (id: string) => {
    await permissionService.reject(id);
    await load();
  };

  // 🔹 Filtros aplicados en el frontend
  const filteredItems = useMemo(() => {
    return items.filter((p) => {
      const matchEstado = estado === "TODOS" ? true : p.estado === estado;
      const matchFrom =
        fromDate === "" ? true : new Date(p.fecha_inicio) >= new Date(fromDate);
      const matchTo =
        toDate === "" ? true : new Date(p.fecha_fin) <= new Date(toDate);
      return matchEstado && matchFrom && matchTo;
    });
  }, [items, estado, fromDate, toDate]);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-lg sm:text-xl">
          Permisos Solicitados
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Filtros */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Estado</label>
            <Select
              value={estado}
              onValueChange={(v) => setEstado(v as EstadoFiltro)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TODOS">Todos</SelectItem>
                <SelectItem value="PENDIENTE">Pendiente</SelectItem>
                <SelectItem value="APROBADO">Aprobado</SelectItem>
                <SelectItem value="RECHAZADO">Rechazado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Desde</label>
            <Input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Hasta</label>
            <Input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>
          <div className="flex items-end">
            <Button
              variant="outline"
              onClick={() => {
                setEstado("TODOS");
                setFromDate("");
                setToDate("");
              }}
            >
              Limpiar Filtros
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-32 text-gray-500 gap-2">
            <Loader2 className="h-5 w-5 animate-spin" /> Cargando solicitudes...
          </div>
        ) : (
          <div className="space-y-3">
            {filteredItems.map((p) => (
              <div
                key={p.id}
                className="p-3 border rounded-lg bg-white shadow-sm"
              >
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div className="space-y-1">
                    <div className="font-semibold text-base">
                      {p.usuario?.nombre || p.usuario_id} – {p.tipo}
                    </div>
                    <div className="text-sm text-gray-600">
                      {new Date(p.fecha_inicio).toLocaleDateString()} →{" "}
                      {new Date(p.fecha_fin).toLocaleDateString()} · Estado:{" "}
                      <span
                        className={`font-medium ${
                          p.estado === "PENDIENTE"
                            ? "text-yellow-600"
                            : p.estado === "APROBADO"
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {p.estado}
                      </span>
                    </div>
                    {p.descripcion && (
                      <div className="text-sm mt-1 text-gray-700">
                        {p.descripcion}
                      </div>
                    )}
                    {p.archivo_url && (
                      <a
                        className="text-blue-600 text-sm underline"
                        href={p.archivo_url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Ver archivo{" "}
                        {p.archivo_nombre ? `(${p.archivo_nombre})` : ""}
                      </a>
                    )}
                  </div>

                  {canModerate && p.estado === "PENDIENTE" && (
                    <div className="flex gap-2 justify-end">
                      <Button
                        variant="outline"
                        onClick={() => onReject(p.id)}
                        className="hover:bg-red-50 text-red-700 border-red-200"
                      >
                        Rechazar
                      </Button>
                      <Button
                        onClick={() => onApprove(p.id)}
                        className="bg-green-600 hover:bg-green-700 text-white"
                      >
                        Aprobar
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {filteredItems.length === 0 && !loading && (
              <div className="text-sm text-gray-500 text-center py-8">
                No hay solicitudes
              </div>
            )}

            <Separator />
            <div className="text-xs text-gray-500 text-right">
              Última actualización: {new Date().toLocaleString()}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
