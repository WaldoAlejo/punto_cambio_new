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
import { userService } from "@/services/userService";
import { pointService } from "@/services/pointService";
import { currencyService } from "@/services/currencyService";
import { exportToExcel } from "@/utils/exportToExcel";

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

  // Filtros extra para reportes detallados
  const [currencies, setCurrencies] = useState<
    { id: string; codigo: string }[]
  >([]);
  const [selectedCurrencyId, setSelectedCurrencyId] = useState<string | null>(
    null
  );
  const [estado, setEstado] = useState<string | null>(null);
  const [metodoEntrega, setMetodoEntrega] = useState<
    "efectivo" | "transferencia" | "" | null
  >(null);

  useEffect(() => {
    // Cargar usuarios y puntos para el selector cuando el tipo sea worktime
    const loadUsers = async () => {
      try {
        const res = await userService.getAllUsers();
        if (!res.error) setUsers(res.users);
      } catch (e) {
        console.warn("No se pudieron cargar usuarios para el filtro", e);
      }
    };
    const loadPoints = async () => {
      try {
        const res = await pointService.getAllPoints();
        if (!res.error)
          setPoints(res.points.map((p) => ({ id: p.id, nombre: p.nombre })));
      } catch (e) {
        console.warn("No se pudieron cargar puntos para el filtro", e);
      }
    };
    if (
      reportType === "worktime" ||
      reportType === "exchanges_detailed" ||
      reportType === "transfers_detailed" ||
      reportType === "accounting_movements" ||
      reportType === "eod_balances"
    ) {
      if (users.length === 0) loadUsers();
      if (points.length === 0) loadPoints();
    }

    if (
      reportType === "exchanges_detailed" ||
      reportType === "transfers_detailed"
    ) {
      const loadCurrencies = async () => {
        try {
          const res = await currencyService.getAllCurrencies();
          if (!res.error) {
            setCurrencies(
              res.currencies.map((c) => ({ id: c.id, codigo: c.codigo }))
            );
          }
        } catch (e) {
          console.warn("No se pudieron cargar monedas para el filtro", e);
        }
      };
      if (currencies.length === 0) loadCurrencies();
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
            // Filtros opcionales por usuario/punto segun tipo
            ...((reportType === "worktime" ||
              reportType === "exchanges_detailed" ||
              reportType === "transfers_detailed" ||
              reportType === "accounting_movements") &&
            selectedUserId
              ? { userId: selectedUserId }
              : {}),
            ...((reportType === "worktime" ||
              reportType === "exchanges_detailed" ||
              reportType === "transfers_detailed" ||
              reportType === "accounting_movements" ||
              reportType === "eod_balances") &&
            selectedPointId
              ? { pointId: selectedPointId }
              : {}),
            ...(reportType === "exchanges_detailed" && selectedCurrencyId
              ? { currencyId: selectedCurrencyId }
              : {}),
            ...(reportType === "exchanges_detailed" && estado
              ? { estado }
              : {}),
            ...(reportType === "exchanges_detailed" &&
            metodoEntrega &&
            metodoEntrega !== ""
              ? { metodoEntrega }
              : {}),
            ...(reportType === "transfers_detailed" && selectedCurrencyId
              ? { currencyId: selectedCurrencyId }
              : {}),
            ...(reportType === "transfers_detailed" && estado
              ? { estado }
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
                  <SelectItem value="exchanges_detailed">
                    Cambios Detallados
                  </SelectItem>
                  <SelectItem value="transfers">Transferencias</SelectItem>
                  <SelectItem value="transfers_detailed">
                    Transferencias Detalladas
                  </SelectItem>
                  <SelectItem value="balances">Saldos</SelectItem>
                  <SelectItem value="users">Actividad Usuarios</SelectItem>
                  <SelectItem value="worktime">Tiempo de Trabajo</SelectItem>
                  <SelectItem value="accounting_movements">
                    Movimientos Contables
                  </SelectItem>
                  <SelectItem value="eod_balances">Saldos de Cierre</SelectItem>
                  <SelectItem value="point_assignments">
                    Asignaciones de Punto
                  </SelectItem>
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
                    onValueChange={(v) =>
                      setSelectedUserId(v === "ALL" ? null : v)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar usuario" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ALL">Todos</SelectItem>
                      {filteredUsers.map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.nombre} (@{u.username})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <Input
                  disabled
                  placeholder="Seleccione 'Tiempo de Trabajo' o 'Detallados'"
                />
              )}
            </div>

            {/* Filtro de punto de atención */}
            <div className="space-y-2">
              <Label>Punto (opcional)</Label>
              {reportType === "worktime" ||
              reportType === "exchanges_detailed" ||
              reportType === "transfers_detailed" ||
              reportType === "accounting_movements" ||
              reportType === "eod_balances" ? (
                <Select
                  value={selectedPointId || ""}
                  onValueChange={(v) =>
                    setSelectedPointId(v === "ALL" ? null : v)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar punto" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Todos</SelectItem>
                    {points.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  disabled
                  placeholder="Seleccione 'Tiempo de Trabajo' o 'Detallados'"
                />
              )}
            </div>

            {/* Moneda (opcional) - para detallados */}
            <div className="space-y-2">
              <Label>Moneda (opcional)</Label>
              {reportType === "exchanges_detailed" ||
              reportType === "transfers_detailed" ? (
                <Select
                  value={selectedCurrencyId || ""}
                  onValueChange={(v) =>
                    setSelectedCurrencyId(v === "ALL" ? null : v)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar moneda" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Todas</SelectItem>
                    {currencies.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.codigo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  disabled
                  placeholder="Disponible en reportes detallados"
                />
              )}
            </div>

            {/* Estado (opcional) */}
            <div className="space-y-2">
              <Label>Estado (opcional)</Label>
              {reportType === "exchanges_detailed" ||
              reportType === "transfers_detailed" ? (
                <Select
                  value={estado || ""}
                  onValueChange={(v) => setEstado(v === "ALL" ? null : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Todos</SelectItem>
                    {reportType === "exchanges_detailed" && (
                      <>
                        <SelectItem value="PENDIENTE">PENDIENTE</SelectItem>
                        <SelectItem value="COMPLETADO">COMPLETADO</SelectItem>
                      </>
                    )}
                    {reportType === "transfers_detailed" && (
                      <>
                        <SelectItem value="PENDIENTE">PENDIENTE</SelectItem>
                        <SelectItem value="APROBADO">APROBADO</SelectItem>
                        <SelectItem value="RECHAZADO">RECHAZADO</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  disabled
                  placeholder="Disponible en reportes detallados"
                />
              )}
            </div>

            {/* Método de entrega (solo para cambios detallados) */}
            <div className="space-y-2">
              <Label>Método de entrega</Label>
              {reportType === "exchanges_detailed" ? (
                <Select
                  value={metodoEntrega || ""}
                  onValueChange={(v) =>
                    setMetodoEntrega(v === "ALL" ? null : (v as any))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar método" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Todos</SelectItem>
                    <SelectItem value="efectivo">Efectivo</SelectItem>
                    <SelectItem value="transferencia">Transferencia</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Input disabled placeholder="Solo para Cambios Detallados" />
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
            <div className="flex justify-end mb-3">
              <Button
                variant="outline"
                onClick={() => {
                  const sheetNameMap: Record<string, string> = {
                    exchanges: "Cambios",
                    exchanges_detailed: "Cambios Detallados",
                    transfers: "Transferencias",
                    transfers_detailed: "Transferencias Detalladas",
                    balances: "Saldos",
                    users: "Usuarios",
                    worktime: "Tiempo Trabajo",
                    accounting_movements: "Movimientos",
                    eod_balances: "Cierres",
                    point_assignments: "Asignaciones",
                    summary: "Resumen",
                  };
                  const fileBase = sheetNameMap[reportType] || "Reporte";
                  exportToExcel(
                    reportData,
                    `${fileBase}_${dateFrom}_a_${dateTo}`,
                    undefined,
                    undefined,
                    undefined,
                    fileBase
                  );
                }}
              >
                Exportar a Excel
              </Button>
            </div>
            {reportType === "worktime" ? (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-gray-300">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="border border-gray-300 px-4 py-2 text-left font-semibold">Fecha</th>
                      <th className="border border-gray-300 px-4 py-2 text-left font-semibold">Punto</th>
                      <th className="border border-gray-300 px-4 py-2 text-left font-semibold">Usuario</th>
                      <th className="border border-gray-300 px-4 py-2 text-left font-semibold">Username</th>
                      <th className="border border-gray-300 px-4 py-2 text-left font-semibold">Entrada</th>
                      <th className="border border-gray-300 px-4 py-2 text-left font-semibold">Almuerzo</th>
                      <th className="border border-gray-300 px-4 py-2 text-left font-semibold">Regreso</th>
                      <th className="border border-gray-300 px-4 py-2 text-left font-semibold">Salida</th>
                      <th className="border border-gray-300 px-4 py-2 text-left font-semibold">Almuerzo (min)</th>
                      <th className="border border-gray-300 px-4 py-2 text-left font-semibold">Salidas (min)</th>
                      <th className="border border-gray-300 px-4 py-2 text-left font-semibold">Tiempo Efectivo</th>
                      <th className="border border-gray-300 px-4 py-2 text-left font-semibold">Estado</th>
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
                          ? new Date(iso).toLocaleTimeString("es-EC", { hour: "2-digit", minute: "2-digit" })
                          : "";
                      return (
                        <tr key={index} className="hover:bg-gray-50">
                          <td className="border border-gray-300 px-4 py-2">{row.date}</td>
                          <td className="border border-gray-300 px-4 py-2">{row.point}</td>
                          <td className="border border-gray-300 px-4 py-2">{row.user}</td>
                          <td className="border border-gray-300 px-4 py-2">{row.username ? `@${row.username}` : ""}</td>
                          <td className="border border-gray-300 px-4 py-2">{fmtTime(row.entrada)}</td>
                          <td className="border border-gray-300 px-4 py-2">{fmtTime(row.almuerzo)}</td>
                          <td className="border border-gray-300 px-4 py-2">{fmtTime(row.regreso)}</td>
                          <td className="border border-gray-300 px-4 py-2">{fmtTime(row.salida)}</td>
                          <td className="border border-gray-300 px-4 py-2">{fmtHM(row.lunchMinutes)}</td>
                          <td className="border border-gray-300 px-4 py-2">{fmtHM(row.spontaneousMinutes)}</td>
                          <td className="border border-gray-300 px-4 py-2 font-semibold">{fmtHM(row.effectiveMinutes)}</td>
                          <td className="border border-gray-300 px-4 py-2">{row.estado || ""}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : reportType === "exchanges_detailed" ? (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-gray-300">
                  <thead>
                    <tr className="bg-gray-50">
                      {[
                        "fecha",
                        "punto",
                        "usuario",
                        "tipo_operacion",
                        "moneda_origen",
                        "moneda_destino",
                        "monto_origen",
                        "monto_destino",
                        "tasa_billetes",
                        "tasa_monedas",
                        "rate_applied",
                        "tasa_mid",
                        "spread",
                        "margen_bruto",
                        "metodo_entrega",
                        "numero_recibo",
                        "estado",
                      ].map((h) => (
                        <th key={h} className="border border-gray-300 px-4 py-2 text-left font-semibold">
                          {h.replace(/_/g, " ")}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.map((row: any, index) => (
                      <tr key={row.id || index} className="hover:bg-gray-50">
                        <td className="border border-gray-300 px-4 py-2">{new Date(row.fecha).toLocaleString("es-EC")}</td>
                        <td className="border border-gray-300 px-4 py-2">{row.punto}</td>
                        <td className="border border-gray-300 px-4 py-2">{row.usuario}</td>
                        <td className="border border-gray-300 px-4 py-2">{row.tipo_operacion}</td>
                        <td className="border border-gray-300 px-4 py-2">{row.moneda_origen}</td>
                        <td className="border border-gray-300 px-4 py-2">{row.moneda_destino}</td>
                        <td className="border border-gray-300 px-4 py-2">{row.monto_origen?.toLocaleString()}</td>
                        <td className="border border-gray-300 px-4 py-2">{row.monto_destino?.toLocaleString()}</td>
                        <td className="border border-gray-300 px-4 py-2">{row.tasa_billetes}</td>
                        <td className="border border-gray-300 px-4 py-2">{row.tasa_monedas}</td>
                        <td className="border border-gray-300 px-4 py-2">{row.rate_applied}</td>
                        <td className="border border-gray-300 px-4 py-2">{row.tasa_mid}</td>
                        <td className="border border-gray-300 px-4 py-2">{row.spread}</td>
                        <td className="border border-gray-300 px-4 py-2">{row.margen_bruto?.toLocaleString()}</td>
                        <td className="border border-gray-300 px-4 py-2">{row.metodo_entrega}</td>
                        <td className="border border-gray-300 px-4 py-2">{row.numero_recibo || ""}</td>
                        <td className="border border-gray-300 px-4 py-2">{row.estado}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : reportType === "transfers_detailed" ? (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse border border-gray-300">
                  <thead>
                    <tr className="bg-gray-50">
                      {[
                        "fecha",
                        "punto_origen",
                        "punto_destino",
                        "usuario_solicitante",
                        "moneda",
                        "monto",
                        "estado",
                        "numero_recibo",
                        "observaciones",
                      ].map((h) => (
                        <th key={h} className="border border-gray-300 px-4 py-2 text-left font-semibold">
                          {h.replace(/_/g, " ")}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.map((row: any, index) => (
                      <tr key={row.id || index} className="hover:bg-gray-50">
                        <td className="border border-gray-300 px-4 py-2">{new Date(row.fecha).toLocaleString("es-EC")}</td>
                        <td className="border border-gray-300 px-4 py-2">{row.punto_origen}</td>
                        <td className="border border-gray-300 px-4 py-2">{row.punto_destino}</td>
                        <td className="border border-gray-300 px-4 py-2">{row.usuario_solicitante}</td>
                        <td className="border border-gray-300 px-4 py-2">{row.moneda}</td>
                        <td className="border border-gray-300 px-4 py-2">{row.monto?.toLocaleString()}</td>
                        <td className="border border-gray-300 px-4 py-2">{row.estado}</td>
                        <td className="border border-gray-300 px-4 py-2">{row.numero_recibo || ""}</td>
                        <td className="border border-gray-300 px-4 py-2">{row.observaciones || ""}</td>
                      </tr>
                    ))}
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
                          <th key={key} className="border border-gray-300 px-4 py-2 text-left font-semibold">
                            {key.charAt(0).toUpperCase() + key.slice(1)}
                          </th>
                        ))}
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.map((row, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        {Object.values(row).map((value, cellIndex) => (
                          <td key={cellIndex} className="border border-gray-300 px-4 py-2">
                            {typeof value === "object" && value !== null ? JSON.stringify(value) : String(value)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Reports;
