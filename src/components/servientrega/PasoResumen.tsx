"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface PasoResumenProps {
  data: any;
  onBack: () => void;
  onConfirm: () => void;
}

export default function PasoResumen({
  data,
  onBack,
  onConfirm,
}: PasoResumenProps) {
  return (
    <Card className="w-full max-w-3xl mx-auto mt-6">
      <CardHeader>
        <CardTitle>Resumen del Envío</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <section>
          <h3 className="font-bold mb-1">Producto:</h3>
          <p>{data.nombre_producto}</p>
        </section>

        <section>
          <h3 className="font-bold mb-1">Remitente:</h3>
          <pre className="bg-gray-100 p-2 rounded text-sm">
            {JSON.stringify(data.remitente, null, 2)}
          </pre>
        </section>

        <section>
          <h3 className="font-bold mb-1">Destinatario:</h3>
          <pre className="bg-gray-100 p-2 rounded text-sm">
            {JSON.stringify(data.destinatario, null, 2)}
          </pre>
        </section>

        <section>
          <h3 className="font-bold mb-1">¿Requiere empaque?:</h3>
          <p>{data.requiere_empaque ? "Sí" : "No"}</p>
        </section>

        {data.requiere_empaque && data.empaque && (
          <section>
            <h3 className="font-bold mb-1">Empaque:</h3>
            <pre className="bg-gray-100 p-2 rounded text-sm">
              {JSON.stringify(data.empaque, null, 2)}
            </pre>
          </section>
        )}

        <section>
          <h3 className="font-bold mb-1">Medidas:</h3>
          <pre className="bg-gray-100 p-2 rounded text-sm">
            {JSON.stringify(data.medidas, null, 2)}
          </pre>
        </section>

        <div className="flex justify-between mt-6">
          <Button variant="outline" onClick={onBack}>
            ← Atrás
          </Button>
          <Button
            onClick={onConfirm}
            className="bg-green-600 text-white hover:bg-green-700"
          >
            Confirmar y generar guía
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
