import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Download, FileText, Clock } from "lucide-react";
import { User, PuntoAtencion, Usuario } from "../../types";
import { useToast } from "@/hooks/use-toast";
import { userService } from "@/services/userService";
import { pointService } from "@/services/pointService";

interface TimeReportsProps {
  _user: User;
  selectedPoint: PuntoAtencion | null;
}

const TimeReports = ({ selectedPoint }: TimeReportsProps) => {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [reportData, setReportData] = useState<WorktimeRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  // Filtros adicionales
  const [users, setUsers] = useState<Usuario[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [points, setPoints] = useState<{ id: string; nombre: string }[]>([]);
  const [selectedPointId, setSelectedPointId] = useState<string>("");

  useEffect(() => {
    // Cargar usuarios y puntos (una vez)
    (async () => {
      try {
        const u = await userService.getAllUsers();
        if (!u.error) setUsers(u.users);
      } catch {}
      try {
        const p = await pointService.getAllPoints();
        if (!p.error)
          setPoints(p.points.map((x) => ({ id: x.id, nombre: x.nombre })));
      } catch {}
    })();
  }, []);

  const filteredUsers = useMemo(() => {
    const term = userSearch.trim().toLowerCase();
    if (!term) return users;
    return users.filter(
      (u) =>
        u.nombre.toLowerCase().includes(term) ||
        u.username.toLowerCase().includes(term)
    );
  }, [users, userSearch]);

  // Datos recibidos desde backend (/reports worktime)
  interface WorktimeRow {
    date: string; // YYYY-MM-DD (día GYE)
    point: string;
    user: string;
    username?: string;
    entrada: string; // ISO
    almuerzo?: string; // ISO
    regreso?: string; // ISO
    salida: string; // ISO | ""
    estado?: string;
    lunchMinutes: number;
    spontaneousMinutes: number;
    effectiveMinutes: number;
  }

  const generateReport = async () => {
    if (!dateFrom || !dateTo) {
      toast({
        title: "Error",
        description: "Por favor seleccione las fechas del reporte",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
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
            reportType: "worktime",
            dateFrom,
            dateTo,
            // Mostrar todos por defecto: solo filtrar si se elige manualmente
            ...(selectedUserId ? { userId: selectedUserId } : {}),
            ...(selectedPointId ? { pointId: selectedPointId } : {}),
          }),
        }
      );

      const data = await response.json();
      if (!data.success)
        throw new Error(data.error || "Error al generar reporte");

      setReportData(data.data as WorktimeRow[]);

      toast({
        title: "Reporte generado",
        description: "El reporte de tiempo se ha generado exitosamente",
      });
    } catch (error) {
      console.error("Error generating time report:", error);
      toast({
        title: "Error",
        description: "Error al generar el reporte de tiempo",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatMinutes = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  // Exporta el informe visible a CSV (mismo comportamiento movido desde Usuarios Activos)
  const exportReportCSV = () => {
    try {
      const header = [
        "Fecha",
        "Punto",
        "Usuario",
        "Username",
        "Entrada",
        "Almuerzo",
        "Regreso",
        "Salida",
        "Almuerzo (min)",
        "Salidas (min)",
        "Tiempo Efectivo (min)",
        "Estado",
      ];
      const rows = reportData.map((r) => [
        r.date,
        r.point,
        r.user,
        r.username ? `@${r.username}` : "",
        r.entrada
          ? new Date(r.entrada).toLocaleTimeString("es-EC", {
              hour: "2-digit",
              minute: "2-digit",
            })
          : "",
        r.almuerzo
          ? new Date(r.almuerzo).toLocaleTimeString("es-EC", {
              hour: "2-digit",
              minute: "2-digit",
            })
          : "",
        r.regreso
          ? new Date(r.regreso).toLocaleTimeString("es-EC", {
              hour: "2-digit",
              minute: "2-digit",
            })
          : "",
        r.salida
          ? new Date(r.salida).toLocaleTimeString("es-EC", {
              hour: "2-digit",
              minute: "2-digit",
            })
          : "",
        r.lunchMinutes,
        r.spontaneousMinutes,
        r.effectiveMinutes,
        r.estado ?? "",
      ]);
      // Totales al final
      const totalLunch = reportData.reduce(
        (s, r) => s + (r.lunchMinutes || 0),
        0
      );
      const totalSpont = reportData.reduce(
        (s, r) => s + (r.spontaneousMinutes || 0),
        0
      );
      const totalEffective = reportData.reduce(
        (s, r) => s + (r.effectiveMinutes || 0),
        0
      );
      rows.push([
        "",
        "",
        "",
        "",
        "",
        "",
        "",
        "Totales:",
        totalLunch,
        totalSpont,
        totalEffective,
        "",
      ]);

      const csv = [header, ...rows]
        .map((cols) =>
          cols
            .map((c) => {
              const v = String(c ?? "");
              return v.includes(",") || v.includes("\n") || v.includes('"')
                ? `"${v.replaceAll('"', '""')}"`
                : v;
            })
            .join(",")
        )
        .join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const today = new Date().toISOString().slice(0, 10);
      a.download = `reporte_horarios_${today}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast({
        title: "Error",
        description: "No se pudo exportar el informe",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Reporte de Horarios
          </CardTitle>
          <CardDescription>
            Informe administrativo de horarios por usuario y punto
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-6 gap-4 mb-4">
            <div className="space-y-2">
              <Label htmlFor="dateFrom">Fecha Desde</Label>
              <Input
                id="dateFrom"
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dateTo">Fecha Hasta</Label>
              <Input
                id="dateTo"
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Usuario (opcional)</Label>
              <Input
                placeholder="Buscar nombre o username"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
              />
              <Select
                value={selectedUserId}
                onValueChange={(v) =>
                  setSelectedUserId(v === "__all__" ? "" : v)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos</SelectItem>
                  {filteredUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.nombre} (@{u.username})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Punto (opcional)</Label>
              <Select
                value={selectedPointId}
                onValueChange={(v) =>
                  setSelectedPointId(v === "__all__" ? "" : v)
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos</SelectItem>
                  {points.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end col-span-2">
              <Button
                onClick={generateReport}
                disabled={isLoading}
                className="w-full"
              >
                <FileText className="mr-2 h-4 w-4" />
                {isLoading ? "Generando..." : "Generar"}
              </Button>
            </div>
          </div>

          {selectedPoint && (
            <div className="mb-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>Punto:</strong> {selectedPoint.nombre}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {reportData.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Resultados del Reporte</CardTitle>
              <CardDescription>
                Detalle del tiempo trabajado en el período seleccionado
              </CardDescription>
            </div>
            <div>
              <Button variant="secondary" onClick={exportReportCSV}>
                <Download className="mr-2 h-4 w-4" />
                Exportar Informe
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <h3 className="text-lg font-semibold mb-2">Informe (lista)</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Punto</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Username</TableHead>
                  <TableHead>Entrada</TableHead>
                  <TableHead>Almuerzo</TableHead>
                  <TableHead>Regreso</TableHead>
                  <TableHead>Salida</TableHead>
                  <TableHead>Almuerzo (min)</TableHead>
                  <TableHead>Salidas (min)</TableHead>
                  <TableHead>Tiempo Efectivo</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reportData.map((row, index) => {
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
                    <TableRow key={index}>
                      <TableCell>{row.date}</TableCell>
                      <TableCell>{row.point}</TableCell>
                      <TableCell>{row.user}</TableCell>
                      <TableCell>
                        {row.username ? `@${row.username}` : ""}
                      </TableCell>
                      <TableCell>{fmtTime(row.entrada)}</TableCell>
                      <TableCell>{fmtTime(row.almuerzo)}</TableCell>
                      <TableCell>{fmtTime(row.regreso)}</TableCell>
                      <TableCell>{fmtTime(row.salida)}</TableCell>
                      <TableCell>{fmtHM(row.lunchMinutes)}</TableCell>
                      <TableCell>{fmtHM(row.spontaneousMinutes)}</TableCell>
                      <TableCell className="font-medium">
                        {fmtHM(row.effectiveMinutes)}
                      </TableCell>
                      <TableCell>{row.estado || ""}</TableCell>
                    </TableRow>
                  );
                })}
                {/* Totales */}
                <TableRow>
                  <TableCell colSpan={8} className="text-right font-semibold">
                    Totales
                  </TableCell>
                  <TableCell className="font-semibold">
                    {(() => {
                      const t = reportData.reduce(
                        (s, r) => s + (r.lunchMinutes || 0),
                        0
                      );
                      const h = Math.floor(t / 60);
                      const m = Math.abs(t % 60);
                      return `${h}h ${m}m`;
                    })()}
                  </TableCell>
                  <TableCell className="font-semibold">
                    {(() => {
                      const t = reportData.reduce(
                        (s, r) => s + (r.spontaneousMinutes || 0),
                        0
                      );
                      const h = Math.floor(t / 60);
                      const m = Math.abs(t % 60);
                      return `${h}h ${m}m`;
                    })()}
                  </TableCell>
                  <TableCell className="font-semibold">
                    {(() => {
                      const t = reportData.reduce(
                        (s, r) => s + (r.effectiveMinutes || 0),
                        0
                      );
                      const h = Math.floor(t / 60);
                      const m = Math.abs(t % 60);
                      return `${h}h ${m}m`;
                    })()}
                  </TableCell>
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default TimeReports;
