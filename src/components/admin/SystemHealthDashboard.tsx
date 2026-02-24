import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { 
  AlertCircle, 
  CheckCircle, 
  RefreshCw, 
  TrendingUp, 
  TrendingDown,
  Clock,
  Wallet,
  ArrowRightLeft,
  Activity
} from "lucide-react";
import saldoService from "@/services/saldoService";
import axiosInstance from "@/services/axiosInstance";

interface InconsistenciaSaldo {
  punto_atencion_id: string;
  punto_nombre?: string;
  moneda_id: string;
  moneda_codigo?: string;
  saldo_registrado: number;
  saldo_calculado: number;
  diferencia: number;
}

interface TransferenciaPendiente {
  id: string;
  origen_nombre: string;
  destino_nombre: string;
  moneda_codigo: string;
  monto: number;
  fecha_envio: string;
  horas_transcurridas: number;
}

interface CambioSinMovimientos {
  id: string;
  numero_recibo?: string;
  fecha: string;
  moneda_origen_codigo: string;
  moneda_destino_codigo: string;
  monto_origen: number;
  monto_destino: number;
  movimientos_count: number;
}

interface HealthStats {
  totalPuntos: number;
  puntosConInconsistencias: number;
  transferenciasPendientes: number;
  transferenciasCriticas: number; // > 24h
  cambiosSinMovimientos: number;
  cierresConDiferencias: number;
}

export default function SystemHealthDashboard() {
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  
  const [inconsistencias, setInconsistencias] = useState<InconsistenciaSaldo[]>([]);
  const [transferencias, setTransferencias] = useState<TransferenciaPendiente[]>([]);
  const [cambiosSinMov, setCambiosSinMov] = useState<CambioSinMovimientos[]>([]);
  const [stats, setStats] = useState<HealthStats>({
    totalPuntos: 0,
    puntosConInconsistencias: 0,
    transferenciasPendientes: 0,
    transferenciasCriticas: 0,
    cambiosSinMovimientos: 0,
    cierresConDiferencias: 0,
  });

  const loadHealthData = useCallback(async () => {
    setLoading(true);
    try {
      // 1. Validar consistencia de saldos
      const consistenciaResult = await saldoService.validarConsistencia();
      if (consistenciaResult && !consistenciaResult.valido) {
        setInconsistencias(consistenciaResult.inconsistencias || []);
        setStats(prev => ({
          ...prev,
          puntosConInconsistencias: new Set(consistenciaResult.inconsistencias?.map(i => i.punto_atencion_id)).size
        }));
      } else {
        setInconsistencias([]);
      }

      // 2. Transferencias pendientes
      try {
        const transfersResp = await axiosInstance.get("/transfers?estado=EN_TRANSITO");
        if (transfersResp.data?.transfers) {
          const ahora = new Date();
          const formateadas = transfersResp.data.transfers.map((t: any) => {
            const fechaEnvio = t.fecha_envio ? new Date(t.fecha_envio) : new Date(t.fecha);
            const horasTranscurridas = (ahora.getTime() - fechaEnvio.getTime()) / (1000 * 60 * 60);
            return {
              id: t.id,
              origen_nombre: t.origen?.nombre || "Desconocido",
              destino_nombre: t.destino?.nombre || "Desconocido",
              moneda_codigo: t.moneda?.codigo || "USD",
              monto: Number(t.monto),
              fecha_envio: fechaEnvio.toISOString(),
              horas_transcurridas: Math.round(horasTranscurridas * 10) / 10
            };
          });
          setTransferencias(formateadas);
          setStats(prev => ({
            ...prev,
            transferenciasPendientes: formateadas.length,
            transferenciasCriticas: formateadas.filter((t: TransferenciaPendiente) => t.horas_transcurridas > 24).length
          }));
        }
      } catch (e) {
        console.warn("No se pudieron cargar transferencias:", e);
      }

      // 3. Cambios sin movimientos completos (solo admin)
      try {
        const cambiosResp = await axiosInstance.get("/exchanges/audit/missing-movements");
        if (cambiosResp.data?.cambios) {
          setCambiosSinMov(cambiosResp.data.cambios);
          setStats(prev => ({
            ...prev,
            cambiosSinMovimientos: cambiosResp.data.cambios.length
          }));
        }
      } catch (e) {
        // El endpoint puede no existir, ignorar
        console.warn("Endpoint de auditoría de cambios no disponible:", e);
      }

      setLastUpdate(new Date());
      toast({
        title: "Datos actualizados",
        description: "Dashboard de salud actualizado correctamente"
      });
    } catch (error) {
      console.error("Error cargando health dashboard:", error);
      toast({
        title: "Error",
        description: "No se pudieron cargar todos los datos de salud",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHealthData();
    // Actualizar cada 5 minutos
    const interval = setInterval(loadHealthData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadHealthData]);

  const handleReconciliar = async (puntoId: string, monedaId: string) => {
    try {
      const result = await saldoService.reconciliarSaldo(puntoId, monedaId);
      if (result.ajustado) {
        toast({
          title: "Saldo reconciliado",
          description: `Diferencia de $${result.diferencia.toFixed(2)} ajustada`
        });
        loadHealthData();
      } else {
        toast({
          title: "Sin cambios",
          description: "El saldo ya estaba correcto"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo reconciliar el saldo",
        variant: "destructive"
      });
    }
  };

  const totalInconsistencias = inconsistencias.length;
  const hayProblemasCriticos = totalInconsistencias > 0 || stats.transferenciasCriticas > 0 || stats.cambiosSinMovimientos > 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard de Salud del Sistema</h1>
          <p className="text-gray-500">
            Última actualización: {lastUpdate ? lastUpdate.toLocaleTimeString() : "Nunca"}
          </p>
        </div>
        <Button 
          onClick={loadHealthData} 
          disabled={loading}
          variant="outline"
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Actualizar
        </Button>
      </div>

      {/* Alertas Críticas */}
      {hayProblemasCriticos && (
        <Alert variant="destructive" className="bg-red-50">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Se detectaron problemas que requieren atención</AlertTitle>
          <AlertDescription>
            Hay {totalInconsistencias} inconsistencias de saldo, {stats.transferenciasCriticas} transferencias 
            críticas y {stats.cambiosSinMovimientos} cambios sin movimientos.
          </AlertDescription>
        </Alert>
      )}

      {!hayProblemasCriticos && (
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertTitle className="text-green-800">Sistema Saludable</AlertTitle>
          <AlertDescription className="text-green-700">
            No se detectaron problemas críticos en el sistema.
          </AlertDescription>
        </Alert>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className={stats.puntosConInconsistencias > 0 ? "border-red-300" : ""}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <Wallet className="h-4 w-4" />
              Inconsistencias de Saldo
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {totalInconsistencias}
            </div>
            <p className="text-xs text-gray-500">
              {stats.puntosConInconsistencias} puntos afectados
            </p>
          </CardContent>
        </Card>

        <Card className={stats.transferenciasCriticas > 0 ? "border-red-300" : ""}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <ArrowRightLeft className="h-4 w-4" />
              Transferencias Pendientes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.transferenciasPendientes}
            </div>
            <p className="text-xs text-gray-500">
              {stats.transferenciasCriticas} críticas (&gt;24h)
            </p>
          </CardContent>
        </Card>

        <Card className={stats.cambiosSinMovimientos > 0 ? "border-red-300" : ""}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Cambios Sin Movimientos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.cambiosSinMovimientos}
            </div>
            <p className="text-xs text-gray-500">
              Requieren auditoría
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Estado General
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {hayProblemasCriticos ? "⚠️" : "✓"}
            </div>
            <p className="text-xs text-gray-500">
              {hayProblemasCriticos ? "Requiere atención" : "Todo correcto"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs con detalles */}
      <Tabs defaultValue="saldos" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="saldos">
            Saldos ({totalInconsistencias})
          </TabsTrigger>
          <TabsTrigger value="transferencias">
            Transferencias ({stats.transferenciasPendientes})
          </TabsTrigger>
          <TabsTrigger value="cambios">
            Cambios ({stats.cambiosSinMovimientos})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="saldos" className="space-y-4">
          {inconsistencias.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500" />
              <p>Todos los saldos están consistentes</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {inconsistencias.map((inc) => (
                <Card key={`${inc.punto_atencion_id}-${inc.moneda_id}`} className="border-red-200">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold flex items-center gap-2">
                          {inc.punto_nombre || inc.punto_atencion_id}
                          <Badge variant="outline">{inc.moneda_codigo || "USD"}</Badge>
                        </div>
                        <div className="text-sm text-gray-600 mt-1">
                          Registrado: ${inc.saldo_registrado.toFixed(2)} | 
                          Calculado: ${inc.saldo_calculado.toFixed(2)}
                        </div>
                        <div className={`text-sm font-medium mt-1 ${
                          inc.diferencia > 0 ? "text-green-600" : "text-red-600"
                        }`}>
                          Diferencia: {inc.diferencia > 0 ? "+" : ""}${inc.diferencia.toFixed(2)}
                        </div>
                      </div>
                      <Button 
                        size="sm"
                        onClick={() => handleReconciliar(inc.punto_atencion_id, inc.moneda_id)}
                      >
                        Reconciliar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="transferencias" className="space-y-4">
          {transferencias.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500" />
              <p>No hay transferencias pendientes</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {transferencias.map(t => (
                <Card key={t.id} className={t.horas_transcurridas > 24 ? "border-red-200" : ""}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold">
                          {t.origen_nombre} → {t.destino_nombre}
                        </div>
                        <div className="text-sm text-gray-600 mt-1">
                          {t.moneda_codigo} ${t.monto.toFixed(2)}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          Enviado: {new Date(t.fecha_envio).toLocaleString()}
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant={t.horas_transcurridas > 24 ? "destructive" : "secondary"}>
                          {t.horas_transcurridas > 24 ? "CRÍTICA" : "Pendiente"}
                        </Badge>
                        <div className="text-xs text-gray-500 mt-1">
                          {Math.floor(t.horas_transcurridas)}h
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="cambios" className="space-y-4">
          {cambiosSinMov.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500" />
              <p>Todos los cambios tienen sus movimientos registrados</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {cambiosSinMov.map(c => (
                <Card key={c.id} className="border-amber-200">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold flex items-center gap-2">
                          Cambio {c.numero_recibo || c.id.slice(0, 8)}
                          <Badge variant="outline">{c.movimientos_count} movs</Badge>
                        </div>
                        <div className="text-sm text-gray-600 mt-1">
                          {c.moneda_origen_codigo} ${c.monto_origen} → {c.moneda_destino_codigo} ${c.monto_destino}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {new Date(c.fecha).toLocaleString()}
                        </div>
                      </div>
                      <Badge variant="destructive">Revisar</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
