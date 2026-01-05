import React, { useState, useEffect } from "react";
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
  INSUMOS_OFICINA: "Insumos de oficina",
  INSUMOS_LIMPIEZA: "Insumos de limpieza",
  SERVIENTREGA: "Servientrega",
  OTROS: "Otros",
};

export default function ServiciosExternosPage() {
  const { user } = useAuth();
  const [saldosAsignados, setSaldosAsignados] = useState<SaldoAsignado[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const cargarSaldos = async () => {
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
  };

  useEffect(() => {
    cargarSaldos();
  }, [user?.punto_atencion_id, refreshKey]);

  const handleRefresh = () => {
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <div className="h-full flex flex-col gap-4">
      {/* Encabezado de la página - Compacto */}
      <div className="flex items-center justify-between gap-4 flex-shrink-0">
        <div>
          <h2 className="text-lg font-semibold">Servicios Externos (USD)</h2>
          <p className="text-xs text-gray-600">
            Registre ingresos/egresos de servicios externos e insumos
          </p>
        </div>
        <Badge variant="outline" className="text-xs">
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
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {saldosAsignados.map((saldo) => (
                  <div
                    key={saldo.servicio}
                    className="p-2 border rounded-lg bg-gray-50"
                  >
                    <p className="text-xs font-medium text-gray-600 truncate">
                      {SERVICIOS_LABELS[saldo.servicio] || saldo.servicio}
                    </p>
                    <p className="text-base font-bold text-green-600">
                      ${Number(saldo.saldo_asignado).toFixed(2)}
                    </p>
                    <div className="text-xs text-gray-500 mt-1">
                      <span>Billetes: <b>${Number(saldo.billetes || 0).toFixed(2)}</b></span><br />
                      <span>Monedas: <b>${Number(saldo.monedas_fisicas || 0).toFixed(2)}</b></span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Dos columnas en desktop, una columna en mobile - Con altura controlada */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 min-h-0">
        {/* Columna izquierda: Formulario */}
        <Card className="border flex flex-col overflow-hidden">
          <CardHeader className="pb-2 flex-shrink-0">
            <CardTitle className="text-sm font-semibold">
              Nuevo movimiento
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Completa los campos y guarda para registrar un movimiento
            </p>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto">
            <ServiciosExternosForm onMovimientoCreado={handleRefresh} />
          </CardContent>
        </Card>

        {/* Columna derecha: Historial */}
        <Card className="border flex flex-col overflow-hidden">
          <CardHeader className="pb-2 flex-shrink-0">
            <CardTitle className="text-sm font-semibold">
              Últimos movimientos
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Revisa y exporta tus registros recientes
            </p>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto">
            <ServiciosExternosHistory />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
