import React from "react";
import ServiciosExternosForm from "./ServiciosExternosForm";
import ServiciosExternosHistory from "./ServiciosExternosHistory";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function ServiciosExternosPage() {
  return (
    <div className="space-y-6">
      {/* Encabezado de la página */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-semibold">Servicios Externos (USD)</h2>
          <p className="text-sm text-gray-600">
            Registre ingresos/egresos de YaGanaste, Banco Guayaquil, Western
            Union, Produbanco y Banco del Pacífico; y egresos por Insumos
            (oficina, limpieza y otros).
          </p>
        </div>
        <Badge variant="outline" className="mt-1">
          Contabilidad general · USD
        </Badge>
      </div>

      {/* Dos columnas en desktop, una columna en mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Columna izquierda: Formulario */}
        <Card className="border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">
              Nuevo movimiento
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Completa los campos y guarda para registrar un movimiento. Las
              categorías de <span className="font-medium">Insumos</span> se
              guardan como <span className="font-medium">EGRESO</span>.
            </p>
          </CardHeader>
          <CardContent>
            <ServiciosExternosForm />
          </CardContent>
        </Card>

        {/* Columna derecha: Historial */}
        <Card className="border">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">
              Últimos movimientos
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Revisa y exporta tus registros recientes. Usa los filtros para
              buscar por tipo, moneda o descripción.
            </p>
          </CardHeader>
          <CardContent>
            <ServiciosExternosHistory />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
