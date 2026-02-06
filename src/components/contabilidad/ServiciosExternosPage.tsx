import React, { useState, useEffect, useCallback } from "react";
import ServiciosExternosForm from "./ServiciosExternosForm";
import ServiciosExternosHistory from "./ServiciosExternosHistory";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import {
  obtenerSaldosAsignados,
  SaldoAsignado,
} from "@/services/externalServicesService";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

const SERVICIOS_LABELS: Record<string, string> = {
  YAGANASTE: "YaGanaste",
  BANCO_GUAYAQUIL: "Banco Guayaquil",
  WESTERN: "Western Union",
  PRODUBANCO: "Produbanco",
  BANCO_PACIFICO: "Banco del Pacífico",
  SERVIENTREGA: "Servientrega",
  INSUMOS_OFICINA: "Insumos de oficina",
  INSUMOS_LIMPIEZA: "Insumos de limpieza",
  OTROS: "Otros",
};

export default function ServiciosExternosPage() {
  const { user } = useAuth();
  const [saldosAsignados, setSaldosAsignados] = useState<SaldoAsignado[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const cargarSaldos = useCallback(async () => {
    if (!user?.punto_atencion_id) return;

    setLoading(true);
    try {
      const response = await obtenerSaldosAsignados();
      setSaldosAsignados(response.saldos_asignados || []);
    } catch (error) {
      console.error("Error al cargar saldos:", error);
      toast.error("Error al cargar saldos asignados");
    } finally {
      setLoading(false);
    }
  }, [user?.punto_atencion_id]);

  useEffect(() => {
    cargarSaldos();
  }, [cargarSaldos, refreshKey]);

  const handleRefresh = () => {
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <div className="p-4 md:p-6 h-full flex flex-col gap-4 overflow-auto">
      {/* Encabezado de la página - Compacto */}
      <div className="flex items-center justify-between gap-4 flex-shrink-0">
        <div>
          <h2 className="text-lg md:text-xl font-semibold">Servicios Externos (USD)</h2>
          <p className="text-xs md:text-sm text-gray-600">
            Registre ingresos/egresos de servicios externos e insumos
          </p>
        </div>
        <Badge variant="outline" className="text-xs md:text-sm">
          USD
        </Badge>
      </div>

      {/* Saldos Asignados - Card compacto */}
      {user?.punto_atencion_id && (
        <Card className="border flex-shrink-0">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">
                💰 Saldos Asignados
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRefresh}
                disabled={loading}
                className="h-7 text-xs"
              >
                {loading ? "⏳" : "🔄"} Actualizar
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            {loading && saldosAsignados.length === 0 ? (
              <p className="text-xs text-gray-500">Cargando saldos...</p>
            ) : saldosAsignados.length === 0 ? (
              <p className="text-xs text-gray-500">
                No hay saldos asignados para este punto
              </p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 gap-2 md:gap-3">
                {saldosAsignados.map((saldo) => (
                  <div
                    key={saldo.servicio}
                    className="p-2 md:p-3 border rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    <p className="text-xs font-medium text-gray-600 truncate" title={SERVICIOS_LABELS[saldo.servicio] || saldo.servicio}>
                      {SERVICIOS_LABELS[saldo.servicio] || saldo.servicio}
                    </p>
                    <p className="text-sm md:text-base font-bold text-green-600 mt-1">
                      ${(Number(saldo.saldo_asignado) || 0).toFixed(2)}
                    </p>
                    <div className="text-[10px] md:text-xs text-gray-500 mt-1 space-y-0.5">
                      <div>Billetes: <b>${(Number(saldo.billetes) || 0).toFixed(2)}</b></div>
                      <div>Monedas: <b>${(Number(saldo.monedas_fisicas) || 0).toFixed(2)}</b></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Dos columnas en desktop, una columna en mobile - Con altura controlada */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 flex-shrink-0">
        {/* Columna izquierda: Formulario */}
        <Card className="border flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm md:text-base font-semibold">
              📝 Nuevo movimiento
            </CardTitle>
            <p className="text-xs md:text-sm text-muted-foreground">
              Completa los campos y guarda para registrar un movimiento
            </p>
          </CardHeader>
          <CardContent className="pt-0">
            <ServiciosExternosForm onMovimientoCreado={handleRefresh} />
          </CardContent>
        </Card>

        {/* Columna derecha: Historial */}
        <Card className="border flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm md:text-base font-semibold">
              📊 Últimos movimientos
            </CardTitle>
            <p className="text-xs md:text-sm text-muted-foreground">
              Revisa y exporta tus registros recientes
            </p>
          </CardHeader>
          <CardContent className="pt-0">
            <ServiciosExternosHistory />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
