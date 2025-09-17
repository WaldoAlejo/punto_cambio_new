import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import {
  RefreshCw,
  TrendingUp,
  TrendingDown,
  ArrowRightLeft,
  Filter,
  Calendar,
  DollarSign,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { User, PuntoAtencion, MovimientoSaldo, Moneda } from "@/types";
import { useContabilidadDivisas } from "@/hooks/useContabilidadDivisas";
import { useContabilidadAdmin } from "@/hooks/useContabilidadAdmin";
import { pointService } from "@/services/pointService";
import { Loading } from "@/components/ui/loading";
import { exchangeService } from "@/services/exchangeService";
import { anularMovimientoServicioExterno } from "@/services/externalServicesService";

interface HistorialMovimientosProps {
  user: User;
  selectedPoint: PuntoAtencion | null;
  currencies: Moneda[];
  className?: string;
  isAdminView?: boolean;
}

export const HistorialMovimientos = ({
  user,
  selectedPoint,
  currencies,
  className = "",
  isAdminView = false,
}: HistorialMovimientosProps) => {
  // Usar hook apropiado según si es vista de administrador
  const contabilidadNormal = useContabilidadDivisas({ user, selectedPoint });
  const contabilidadAdmin = useContabilidadAdmin({ user });

  const { movimientos, isLoading, error, cargarMovimientos } = isAdminView
    ? {
        movimientos: contabilidadAdmin.movimientosConsolidados,
        isLoading: contabilidadAdmin.isLoading,
        error: contabilidadAdmin.error,
        cargarMovimientos: contabilidadAdmin.cargarMovimientosConsolidados,
      }
    : contabilidadNormal;

  const [filtroMoneda, setFiltroMoneda] = useState<string>("TODAS");
  const [filtroTipo, setFiltroTipo] = useState<string>("TODOS");
  const [limite, setLimite] = useState<number>(isAdminView ? 100 : 50);
  const [filtroPunto, setFiltroPunto] = useState<string>("TODOS");
  const [puntos, setPuntos] = useState<{ id: string; nombre: string }[]>([]);

  // Estado para anulación de cambios de divisa
  const [annulCambioId, setAnnulCambioId] = useState<string | null>(null);
  const [annulReason, setAnnulReason] = useState<string>("");
  const [annulLoading, setAnnulLoading] = useState<boolean>(false);

  // Estado para anular ingresos/egresos de Servicios Externos (MovimientoSaldo individual)
  const [annulMovExtId, setAnnulMovExtId] = useState<string | null>(null);
  const [annulMovExtReason, setAnnulMovExtReason] = useState<string>("");
  const [annulMovExtLoading, setAnnulMovExtLoading] = useState<boolean>(false);

  // Persistencia de filtros (localStorage)
  const storagePrefix = isAdminView ? "histMov_admin" : "histMov";

  // Cargar filtros guardados al montar/cambiar vista
  useEffect(() => {
    try {
      const m = localStorage.getItem(`${storagePrefix}_moneda`);
      const t = localStorage.getItem(`${storagePrefix}_tipo`);
      const p = localStorage.getItem(`${storagePrefix}_punto`);
      const l = localStorage.getItem(`${storagePrefix}_limite`);

      if (m) setFiltroMoneda(m);
      if (t) setFiltroTipo(t);
      if (isAdminView && p) setFiltroPunto(p);
      if (l) {
        const parsed = parseInt(l, 10);
        setLimite(Number.isFinite(parsed) ? parsed : isAdminView ? 100 : 50);
      }
    } catch {
      // noop
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdminView]);

  // Guardar filtros cuando cambian
  useEffect(() => {
    try {
      localStorage.setItem(`${storagePrefix}_moneda`, filtroMoneda);
      localStorage.setItem(`${storagePrefix}_tipo`, filtroTipo);
      if (isAdminView) {
        localStorage.setItem(`${storagePrefix}_punto`, filtroPunto);
      }
      localStorage.setItem(`${storagePrefix}_limite`, String(limite));
    } catch {
      // noop
    }
  }, [
    filtroMoneda,
    filtroTipo,
    filtroPunto,
    limite,
    storagePrefix,
    isAdminView,
  ]);

  // Cargar puntos para filtro (solo en admin view)
  useEffect(() => {
    const loadPoints = async () => {
      if (!isAdminView) return;
      const { points } = await pointService.getAllPointsForAdmin();
      setPuntos(
        (points || []).map((p: any) => ({ id: p.id, nombre: p.nombre }))
      );
    };
    loadPoints();
  }, [isAdminView]);

  // Cargar movimientos cuando cambien los filtros
  useEffect(() => {
    if (isAdminView || selectedPoint) {
      const monedaId = filtroMoneda === "TODAS" ? undefined : filtroMoneda;
      // Para admin, cargar todos y luego filtrar por punto en cliente
      cargarMovimientos(monedaId, limite);
    }
  }, [
    isAdminView,
    selectedPoint,
    filtroMoneda,
    filtroPunto,
    limite,
    cargarMovimientos,
  ]);

  const getTipoMovimientoIcon = (tipo: string) => {
    switch (tipo) {
      case "INGRESO":
        return <TrendingUp className="h-4 w-4 text-green-600" />;
      case "EGRESO":
        return <TrendingDown className="h-4 w-4 text-red-600" />;
      case "CAMBIO_DIVISA":
        return <ArrowRightLeft className="h-4 w-4 text-blue-600" />;
      case "TRANSFERENCIA_ENTRANTE":
        return <TrendingUp className="h-4 w-4 text-purple-600" />;
      case "TRANSFERENCIA_SALIENTE":
        return <TrendingDown className="h-4 w-4 text-orange-600" />;
      default:
        return <DollarSign className="h-4 w-4 text-gray-600" />;
    }
  };

  const getTipoMovimientoBadge = (tipo: string) => {
    const config = {
      INGRESO: {
        variant: "default" as const,
        color: "bg-green-100 text-green-800",
        label: "Ingreso",
      },
      EGRESO: {
        variant: "destructive" as const,
        color: "bg-red-100 text-red-800",
        label: "Egreso",
      },
      CAMBIO_DIVISA: {
        variant: "default" as const,
        color: "bg-blue-100 text-blue-800",
        label: "Cambio",
      },
      TRANSFERENCIA_ENTRANTE: {
        variant: "default" as const,
        color: "bg-purple-100 text-purple-800",
        label: "Transf. Entrada",
      },
      TRANSFERENCIA_SALIENTE: {
        variant: "outline" as const,
        color: "bg-orange-100 text-orange-800",
        label: "Transf. Salida",
      },
    };

    const conf = config[tipo as keyof typeof config] || {
      variant: "outline" as const,
      color: "bg-gray-100 text-gray-800",
      label: tipo,
    };

    return (
      <Badge variant={conf.variant} className={conf.color}>
        {conf.label}
      </Badge>
    );
  };

  const formatCurrency = (amount: number, monedaCodigo?: string) => {
    if (monedaCodigo === "USD") {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: 2,
      }).format(amount);
    }

    return new Intl.NumberFormat("es-ES", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const movimientosFiltrados = useMemo(() => {
    return movimientos.filter((mov) => {
      if (filtroTipo !== "TODOS" && mov.tipo_movimiento !== filtroTipo) {
        return false;
      }
      if (isAdminView && filtroPunto !== "TODOS") {
        // punto_id agregado en hook admin
        if ((mov as any).punto_id !== filtroPunto) return false;
      }
      return true;
    });
  }, [movimientos, filtroTipo, filtroPunto, isAdminView]);

  if (!selectedPoint && !isAdminView) {
    return (
      <Card className={className}>
        <CardContent className="p-6 text-center text-muted-foreground">
          Seleccione un punto de atención para ver el historial
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-blue-600" />
          {isAdminView
            ? "Historial de Movimientos - Contabilidad General"
            : `Historial de Movimientos - ${selectedPoint?.nombre}`}
        </CardTitle>
      </CardHeader>

      <CardContent>
        {/* Filtros */}
        <div className="flex gap-4 mb-6 flex-wrap">
          <div className="flex-1 min-w-48">
            <Label className="text-sm">Moneda</Label>
            <Select value={filtroMoneda} onValueChange={setFiltroMoneda}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar moneda" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TODAS">Todas las monedas</SelectItem>
                {currencies
                  .slice()
                  .sort((a, b) =>
                    a.codigo === "USD" ? -1 : a.codigo.localeCompare(b.codigo)
                  )
                  .map((currency) => (
                    <SelectItem key={currency.id} value={currency.id}>
                      {currency.codigo} - {currency.nombre}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {isAdminView && (
            <div className="flex-1 min-w-48">
              <Label className="text-sm">Punto de Atención</Label>
              <Select value={filtroPunto} onValueChange={setFiltroPunto}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar punto" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TODOS">Todos los puntos</SelectItem>
                  {puntos
                    .slice()
                    .sort((a, b) => a.nombre.localeCompare(b.nombre))
                    .map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nombre}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex-1 min-w-48">
            <Label className="text-sm">Tipo de Movimiento</Label>
            <Select value={filtroTipo} onValueChange={setFiltroTipo}>
              <SelectTrigger>
                <SelectValue placeholder="Tipo de movimiento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="TODOS">Todos los tipos</SelectItem>
                <SelectItem value="INGRESO">Ingresos</SelectItem>
                <SelectItem value="EGRESO">Egresos</SelectItem>
                <SelectItem value="CAMBIO_DIVISA">Cambios de Divisa</SelectItem>
                <SelectItem value="TRANSFERENCIA_ENTRANTE">
                  Transferencias Entrantes
                </SelectItem>
                <SelectItem value="TRANSFERENCIA_SALIENTE">
                  Transferencias Salientes
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1 min-w-32">
            <Label className="text-sm">Límite</Label>
            <Select
              value={limite.toString()}
              onValueChange={(value) => setLimite(parseInt(value))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="25">25 registros</SelectItem>
                <SelectItem value="50">50 registros</SelectItem>
                <SelectItem value="100">100 registros</SelectItem>
                <SelectItem value="200">200 registros</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-end gap-2">
            <Button
              onClick={() =>
                cargarMovimientos(
                  filtroMoneda === "TODAS" ? undefined : filtroMoneda,
                  limite
                )
              }
              disabled={isLoading}
              className="self-end"
            >
              <RefreshCw
                className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`}
              />
              Actualizar
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setFiltroMoneda("TODAS");
                setFiltroTipo("TODOS");
                if (isAdminView) setFiltroPunto("TODOS");
                setLimite(isAdminView ? 100 : 50);
                cargarMovimientos(undefined, isAdminView ? 100 : 50);
              }}
              className="self-end"
            >
              Limpiar filtros
            </Button>
          </div>
        </div>

        {/* Tabla de movimientos (agrupando cambios por transacción) */}
        {isLoading ? (
          <Loading text="Cargando movimientos..." className="py-8" />
        ) : error ? (
          <div className="text-center py-8">
            <p className="text-destructive mb-4">{error}</p>
            <Button onClick={() => cargarMovimientos()} variant="outline">
              Reintentar
            </Button>
          </div>
        ) : movimientosFiltrados.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Filter className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No hay movimientos que coincidan con los filtros</p>
          </div>
        ) : (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Moneda</TableHead>
                  {isAdminView && <TableHead>Punto</TableHead>}
                  <TableHead className="text-right">Monto</TableHead>
                  <TableHead className="text-right">Saldo Anterior</TableHead>
                  <TableHead className="text-right">Saldo Nuevo</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Descripción</TableHead>
                  {(user.rol === "ADMIN" || user.rol === "SUPER_USUARIO") && (
                    <TableHead>Acciones</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {/**
                 * Agrupar por referencia de cambio para mostrar una sola fila con Ingreso/Egreso
                 * Solo aplica para tipo_referencia === "CAMBIO_DIVISA"
                 */}
                {(() => {
                  const rows: JSX.Element[] = [];
                  const seenCambio = new Set<string>();

                  for (const mov of movimientosFiltrados) {
                    if (
                      mov.tipo_referencia === "CAMBIO_DIVISA" &&
                      mov.referencia_id
                    ) {
                      if (seenCambio.has(mov.referencia_id)) continue;
                      seenCambio.add(mov.referencia_id);

                      const relacionados = movimientosFiltrados.filter(
                        (m) =>
                          m.tipo_referencia === "CAMBIO_DIVISA" &&
                          m.referencia_id === mov.referencia_id
                      );

                      const ingreso = relacionados.find(
                        (m) => m.tipo_movimiento === "INGRESO"
                      );
                      const egreso = relacionados.find(
                        (m) => m.tipo_movimiento === "EGRESO"
                      );

                      const fechaBase =
                        ingreso?.fecha || egreso?.fecha || mov.fecha;

                      rows.push(
                        <TableRow key={`cambio-${mov.referencia_id}`}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <ArrowRightLeft className="h-4 w-4 text-blue-600" />
                              <span className="text-sm">
                                {format(
                                  parseISO(fechaBase),
                                  "yyyy-MM-dd HH:mm"
                                )}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {getTipoMovimientoBadge("CAMBIO_DIVISA")}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              {ingreso && (
                                <Badge variant="outline">
                                  {ingreso.moneda?.codigo || "N/A"}
                                </Badge>
                              )}
                              {egreso && (
                                <Badge variant="outline" className="opacity-80">
                                  {egreso.moneda?.codigo || "N/A"}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          {isAdminView && (
                            <TableCell>
                              <Badge variant="secondary">
                                {"punto_nombre" in mov
                                  ? (mov as any).punto_nombre
                                  : "N/A"}
                              </Badge>
                            </TableCell>
                          )}
                          <TableCell className="text-right">
                            <div className="flex flex-col items-end">
                              {ingreso && (
                                <span className="font-semibold text-green-600">
                                  +
                                  {formatCurrency(
                                    Math.abs(ingreso.monto),
                                    ingreso.moneda?.codigo
                                  )}
                                </span>
                              )}
                              {egreso && (
                                <span className="font-semibold text-red-600">
                                  -
                                  {formatCurrency(
                                    Math.abs(egreso.monto),
                                    egreso.moneda?.codigo
                                  )}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            <div className="flex flex-col items-end">
                              {ingreso && (
                                <span>
                                  {formatCurrency(
                                    ingreso.saldo_anterior,
                                    ingreso.moneda?.codigo
                                  )}
                                </span>
                              )}
                              {egreso && (
                                <span>
                                  {formatCurrency(
                                    egreso.saldo_anterior,
                                    egreso.moneda?.codigo
                                  )}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            <div className="flex flex-col items-end">
                              {ingreso && (
                                <span>
                                  {formatCurrency(
                                    ingreso.saldo_nuevo,
                                    ingreso.moneda?.codigo
                                  )}
                                </span>
                              )}
                              {egreso && (
                                <span>
                                  {formatCurrency(
                                    egreso.saldo_nuevo,
                                    egreso.moneda?.codigo
                                  )}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">
                              {ingreso?.usuario?.nombre ||
                                egreso?.usuario?.nombre ||
                                "Sistema"}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">
                              {ingreso?.descripcion ||
                                egreso?.descripcion ||
                                "Cambio de divisa"}
                            </span>
                          </TableCell>
                          {(user.rol === "ADMIN" ||
                            user.rol === "SUPER_USUARIO") && (
                            <TableCell>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() =>
                                  mov.referencia_id &&
                                  setAnnulCambioId(mov.referencia_id)
                                }
                                disabled={!mov.referencia_id}
                              >
                                Anular
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    } else {
                      // Fila normal para otros movimientos
                      rows.push(
                        <TableRow key={mov.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {getTipoMovimientoIcon(mov.tipo_movimiento)}
                              <span className="text-sm">
                                {format(
                                  parseISO(mov.fecha),
                                  "yyyy-MM-dd HH:mm"
                                )}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {getTipoMovimientoBadge(mov.tipo_movimiento)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {mov.moneda?.codigo || "N/A"}
                            </Badge>
                          </TableCell>
                          {isAdminView && (
                            <TableCell>
                              <Badge variant="secondary">
                                {"punto_nombre" in mov
                                  ? (mov as any).punto_nombre
                                  : "N/A"}
                              </Badge>
                            </TableCell>
                          )}
                          <TableCell className="text-right">
                            <span
                              className={`font-semibold ${
                                mov.tipo_movimiento === "INGRESO" ||
                                mov.tipo_movimiento === "TRANSFERENCIA_ENTRANTE"
                                  ? "text-green-600"
                                  : "text-red-600"
                              }`}
                            >
                              {mov.tipo_movimiento === "INGRESO" ||
                              mov.tipo_movimiento === "TRANSFERENCIA_ENTRANTE"
                                ? "+"
                                : "-"}
                              {formatCurrency(
                                Math.abs(mov.monto),
                                mov.moneda?.codigo
                              )}
                            </span>
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {formatCurrency(
                              mov.saldo_anterior,
                              mov.moneda?.codigo
                            )}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {formatCurrency(
                              mov.saldo_nuevo,
                              mov.moneda?.codigo
                            )}
                          </TableCell>
                          <TableCell>
                            <span className="text-sm">
                              {mov.usuario?.nombre || "Sistema"}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-muted-foreground">
                              {mov.descripcion || "Sin descripción"}
                            </span>
                          </TableCell>
                          {(user.rol === "ADMIN" ||
                            user.rol === "SUPER_USUARIO") && (
                            <TableCell className="text-right">
                              {mov.tipo_referencia === "SERVICIO_EXTERNO" ? (
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => setAnnulMovExtId(mov.id)}
                                >
                                  Anular
                                </Button>
                              ) : (
                                <span className="text-xs text-muted-foreground">
                                  —
                                </span>
                              )}
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    }
                  }

                  return rows;
                })()}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Resumen */}
        {movimientosFiltrados.length > 0 && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">
                Mostrando {movimientosFiltrados.length} de {movimientos.length}{" "}
                movimientos
              </span>
              <span className="text-gray-500">
                Última actualización: {new Date().toLocaleTimeString()}
              </span>
            </div>
          </div>
        )}

        {annulCambioId && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded shadow p-4 w-full max-w-md">
              <h3 className="text-lg font-semibold mb-2">
                Anular cambio de divisa
              </h3>
              <p className="text-sm text-gray-600 mb-3">
                Indica el motivo de la anulación. Se registrarán reversos
                contables.
              </p>
              <textarea
                className="w-full border rounded p-2 h-28"
                placeholder="Motivo de anulación"
                value={annulReason}
                onChange={(e) => setAnnulReason(e.target.value)}
              />
              <div className="mt-4 flex justify-end gap-2">
                <Button
                  variant="secondary"
                  onClick={() => {
                    if (annulLoading) return;
                    setAnnulCambioId(null);
                    setAnnulReason("");
                  }}
                  disabled={annulLoading}
                >
                  Cancelar
                </Button>
                <Button
                  variant="destructive"
                  disabled={annulLoading || !annulReason.trim()}
                  onClick={async () => {
                    if (!annulCambioId || !annulReason.trim()) return;
                    try {
                      setAnnulLoading(true);
                      const { ok } = await exchangeService.annulExchange(
                        annulCambioId,
                        annulReason.trim()
                      );
                      if (ok) {
                        setAnnulCambioId(null);
                        setAnnulReason("");
                        await cargarMovimientos(
                          filtroMoneda === "TODAS" ? undefined : filtroMoneda,
                          limite
                        );
                      }
                    } catch (e) {
                      // opcional: toast de error
                    } finally {
                      setAnnulLoading(false);
                    }
                  }}
                >
                  {annulLoading ? "Anulando..." : "Confirmar anulación"}
                </Button>
              </div>
            </div>
          </div>
        )}

        {annulMovExtId && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
            <div className="bg-white rounded shadow p-4 w-full max-w-md">
              <h3 className="text-lg font-semibold mb-2">
                Anular ingreso/egreso
              </h3>
              <p className="text-sm text-gray-600 mb-3">
                Describe el motivo de anulación. Esta acción registrará un
                reverso contable.
              </p>
              <textarea
                className="w-full border rounded p-2 h-28"
                placeholder="Motivo de anulación"
                value={annulMovExtReason}
                onChange={(e) => setAnnulMovExtReason(e.target.value)}
              />
              <div className="mt-4 flex justify-end gap-2">
                <Button
                  variant="secondary"
                  onClick={() => {
                    if (annulMovExtLoading) return;
                    setAnnulMovExtId(null);
                    setAnnulMovExtReason("");
                  }}
                  disabled={annulMovExtLoading}
                >
                  Cancelar
                </Button>
                <Button
                  variant="destructive"
                  disabled={annulMovExtLoading || !annulMovExtReason.trim()}
                  onClick={async () => {
                    if (!annulMovExtId || !annulMovExtReason.trim()) return;
                    try {
                      setAnnulMovExtLoading(true);
                      await anularMovimientoServicioExterno(
                        annulMovExtId,
                        annulMovExtReason.trim()
                      );
                      await cargarMovimientos(
                        filtroMoneda === "TODAS" ? undefined : filtroMoneda,
                        limite
                      );
                      setAnnulMovExtId(null);
                      setAnnulMovExtReason("");
                    } catch (e) {
                      // opcional: toast de error
                    } finally {
                      setAnnulMovExtLoading(false);
                    }
                  }}
                >
                  {annulMovExtLoading ? "Anulando..." : "Confirmar anulación"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default HistorialMovimientos;
