import React from "react";
import ServiciosExternosForm from "./ServiciosExternosForm";
import ServiciosExternosHistory from "./ServiciosExternosHistory";

export default function ServiciosExternosPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Servicios Externos (USD)</h2>
        <p className="text-sm text-gray-600">
          Registre ingresos/egresos de YaGanaste, Banco Guayaquil, Western,
          Produbanco y Banco del Pacífico.
        </p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-4 bg-white rounded border">
          <h3 className="font-medium mb-3">Nuevo movimiento</h3>
          <ServiciosExternosForm />
        </div>
        <div className="p-4 bg-white rounded border">
          <h3 className="font-medium mb-3">Últimos movimientos</h3>
          <ServiciosExternosHistory />
        </div>
      </div>
    </div>
  );
}
