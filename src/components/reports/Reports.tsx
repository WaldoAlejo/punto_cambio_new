import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { User, Usuario } from "../../types";

interface ReportsProps {
  user: User;
  selectedPoint?: any; // Mantener compatibilidad
}

const Reports = ({ user: _user }: ReportsProps) => {
  const [reportType, setReportType] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<any[]>([]);
  const [users, setUsers] = useState<Usuario[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [points, setPoints] = useState<{ id: string; nombre: string }[]>([]);
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);

  useEffect(() => {
    // Cargar usuarios y puntos para el selector cuando el tipo sea worktime
    const loadUsers = async () => {
      try {
        const res = await (
          await import("@/services/userService")
        ).userService.getAllUsers();
        if (!res.error) setUsers(res.users);
      } catch (e) {
        console.warn("No se pudieron cargar usuarios para el filtro", e);
      }
    };
    const loadPoints = async () => {
      try {
        const { pointService } = await import("@/services/pointService");
        const res = await pointService.getAllPoints();
        if (!res.error)
          setPoints(res.points.map((p) => ({ id: p.id, nombre: p.nombre })));
      } catch (e) {
        console.warn("No se pudieron cargar puntos para el filtro", e);
      }
    };
    if (reportType === "worktime") {
      if (users.length === 0) loadUsers();
      if (points.length === 0) loadPoints();
    }
  }, [reportType]);

  const filteredUsers = users.filter((u) => {
    const term = userSearch.trim().toLowerCase();
    if (!term) return true;
    return (
      u.nombre.toLowerCase().includes(term) ||
      u.username.toLowerCase().includes(term)
    );
  });

  const generateReport = async () => {
    if (!reportType || !dateFrom || !dateTo) {
      toast({
        title: "Error",
        description: "Debe completar todos los campos",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem("authToken");
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || "http://35.238.95.118/api"}/reports`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            reportType,
            dateFrom,
            dateTo,
            // Para reporte de tiempos, permitimos filtrar por usuario y punto (selectores)
            ...(reportType === "worktime" && selectedUserId
              ? { userId: selectedUserId }
              : {}),
            ...(reportType === "worktime" && selectedPointId
              ? { pointId: selectedPointId }
              : {}),
          }),
        }
      );

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Error al generar reporte");
      }

      setReportData(data.data);
      toast({
        title: "Reporte generado",
        description: `Se generó el reporte exitosamente`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Error al generar reporte",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Reportes</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Generar Reporte</CardTitle>
          <CardDescription>
            Configure los parámetros para generar el reporte deseado
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
            <div className="space-y-2">
              <Label>Tipo de Reporte</Label>
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="exchanges">Cambios de Divisa</SelectItem>
                  <SelectItem value="transfers">Transferencias</SelectItem>
                  <SelectItem value="balances">Saldos</SelectItem>
                  <SelectItem value="users">Actividad Usuarios</SelectItem>
                  <SelectItem value="worktime">Tiempo de Trabajo</SelectItem>
                  <SelectItem value="summary">Resumen General</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Fecha Desde</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Fecha Hasta</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>

            {/* Filtro de usuario para control de horarios */}
            <div className="space-y-2">
              <Label>Usuario (opcional)</Label>
              {reportType === "worktime" ? (
                <div className="space-y-2">
                  <Input
                    type="text"
                    placeholder="Buscar por nombre o username"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                  />
                  <Select
                    value={selectedUserId || ""}
                    onValueChange={(v) => setSelectedUserId(v || null)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar usuario" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Todos</SelectItem>
                      {filteredUsers.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.nombre} (@{u.username})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <Input disabled placeholder="Seleccione 'Tiempo de Trabajo'" />
              )}
            </div>

            {/* Filtro de punto de atención */}
            <div className="space-y-2">
              <Label>Punto (opcional)</Label>
              {reportType === "worktime" ? (
                <Select
                  value={selectedPointId || ""}
                  onValueChange={(v) => setSelectedPointId(v || null)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar punto" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todos</SelectItem>
                    {points.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input disabled placeholder="Seleccione 'Tiempo de Trabajo'" />
              )}
            </div>

            <div className="flex items-end col-span-2">
              <Button
                onClick={generateReport}
                disabled={loading}
                className="w-full"
              >
                {loading ? "Generando..." : "Generar Reporte"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {reportData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Resultados del Reporte</CardTitle>
            <CardDescription>
              {reportData.length} registros encontrados
            </CardDescription>
          </CardHeader>
          <CardContent>
            {reportType === "worktime" ? (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-gray-300">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="border border-gray-300 px-4 py-2 text-left font-semibold">
                        Fecha
                      </th>
                      <th className="border border-gray-300 px-4 py-2 text-left font-semibold">
                        Punto
                      </th>
                      <th className="border border-gray-300 px-4 py-2 text-left font-semibold">
                        Usuario
                      </th>
                      <th className="border border-gray-300 px-4 py-2 text-left font-semibold">
                        Username
                      </th>
                      <th className="border border-gray-300 px-4 py-2 text-left font-semibold">
                        Entrada
                      </th>
                      <th className="border border-gray-300 px-4 py-2 text-left font-semibold">
                        Almuerzo
                      </th>
                      <th className="border border-gray-300 px-4 py-2 text-left font-semibold">
                        Regreso
                      </th>
                      <th className="border border-gray-300 px-4 py-2 text-left font-semibold">
                        Salida
                      </th>
                      <th className="border border-gray-300 px-4 py-2 text-left font-semibold">
                        Almuerzo (min)
                      </th>
                      <th className="border border-gray-300 px-4 py-2 text-left font-semibold">
                        Salidas (min)
                      </th>
                      <th className="border border-gray-300 px-4 py-2 text-left font-semibold">
                        Tiempo Efectivo
                      </th>
                      <th className="border border-gray-300 px-4 py-2 text-left font-semibold">
                        Estado
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.map((row: any, index) => {
                      const fmtHM = (mins: number) => {
                        const h = Math.floor((mins || 0) / 60);
                        const m = Math.abs((mins || 0) % 60);
                        return `${h}h ${m}m`;
                      };
                      const fmtTime = (iso?: string) =>
                        iso
                          ? new Date(iso).toLocaleTimeString("es-EC", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "";
                      return (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="border border-gray-300 px-4 py-2">
                            {row.date}
                          </td>
                          <td className="border border-gray-300 px-4 py-2">
                            {row.point}
                          </td>
                          <td className="border border-gray-300 px-4 py-2">
                            {row.user}
                          </td>
                          <td className="border border-gray-300 px-4 py-2">
                            {row.username ? `@${row.username}` : ""}
                          </td>
                          <td className="border border-gray-300 px-4 py-2">
                            {fmtTime(row.entrada)}
                          </td>
                          <td className="border border-gray-300 px-4 py-2">
                            {fmtTime(row.almuerzo)}
                          </td>
                          <td className="border border-gray-300 px-4 py-2">
                            {fmtTime(row.regreso)}
                          </td>
                          <td className="border border-gray-300 px-4 py-2">
                            {fmtTime(row.salida)}
                          </td>
                          <td className="border border-gray-300 px-4 py-2">
                            {fmtHM(row.lunchMinutes)}
                          </td>
                          <td className="border border-gray-300 px-4 py-2">
                            {fmtHM(row.spontaneousMinutes)}
                          </td>
                          <td className="border border-gray-300 px-4 py-2 font-semibold">
                            {fmtHM(row.effectiveMinutes)}
                          </td>
                          <td className="border border-gray-300 px-4 py-2">
                            {row.estado || ""}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-gray-300">
                  <thead>
                    <tr className="bg-gray-50">
                      {reportData.length > 0 &&
                        Object.keys(reportData[0]).map((key) => (
                          <th
                            key={key}
                            className="border border-gray-300 px-4 py-2 text-left font-semibold"
                          >
                            {key.charAt(0).toUpperCase() + key.slice(1)}
                          </th>
                        ))}
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.map((row, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        {Object.values(row).map((value, cellIndex) => (
                          <td
                            key={cellIndex}
                            className="border border-gray-300 px-4 py-2"
                          >
                            {typeof value === "object" && value !== null
                              ? JSON.stringify(value)
                              : String(value)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Reports;
