import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ServientregaTest() {
  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Servientrega - Modo de Prueba</CardTitle>
      </CardHeader>
      <CardContent>
        <p>El componente de Servientrega se está cargando correctamente.</p>
        <p>Si ves este mensaje, significa que no hay errores de importación.</p>
      </CardContent>
    </Card>
  );
}
