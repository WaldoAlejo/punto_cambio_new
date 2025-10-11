import React from "react";
import ServiciosExternosForm from "./ServiciosExternosForm";
import ServiciosExternosHistory from "./ServiciosExternosHistory";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function ServiciosExternosPage() {
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
            <ServiciosExternosForm />
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
