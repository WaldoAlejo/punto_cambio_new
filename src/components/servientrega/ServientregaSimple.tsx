import React, { useState } from "react";
import { User, PuntoAtencion } from "../../types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Package, FileText } from "lucide-react";

interface ServientregaSimpleProps {
  user: User;
  selectedPoint: PuntoAtencion | null;
}

export default function ServientregaSimple({
  user,
  selectedPoint,
}: ServientregaSimpleProps) {
  const [currentView, setCurrentView] = useState<"menu" | "test">("menu");

  if (currentView === "test") {
    return (
      <div className="container mx-auto p-4">
        <Button
          onClick={() => setCurrentView("menu")}
          variant="ghost"
          className="mb-4"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver al Menú
        </Button>

        <Card className="w-full max-w-md mx-auto">
          <CardHeader>
            <CardTitle>Prueba de Servientrega</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p>
                <strong>Usuario:</strong> {user?.nombre || "N/A"}
              </p>
              <p>
                <strong>Punto de Atención:</strong>{" "}
                {selectedPoint?.nombre || "N/A"}
              </p>
              <p>
                <strong>Estado:</strong> Componente cargado correctamente
              </p>
              <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded">
                <p className="text-green-800 text-sm">
                  ✅ Si ves este mensaje, significa que el componente de
                  Servientrega se está cargando sin errores de JavaScript.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <Card className="w-full max-w-md mx-auto">
        <CardHeader>
          <CardTitle className="text-center">Servientrega</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={() => setCurrentView("test")}
            className="w-full h-16 text-lg"
            variant="outline"
          >
            <Package className="mr-3 h-6 w-6" />
            Prueba de Componente
          </Button>
          <Button
            onClick={() => alert("Funcionalidad en desarrollo")}
            className="w-full h-16 text-lg"
            variant="outline"
            disabled
          >
            <FileText className="mr-3 h-6 w-6" />
            Ver Guías (Próximamente)
          </Button>
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded">
            <p className="text-blue-800 text-sm">
              <strong>Información:</strong> Esta es una versión simplificada
              para diagnosticar problemas. Si funciona correctamente,
              procederemos a activar la funcionalidad completa.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
