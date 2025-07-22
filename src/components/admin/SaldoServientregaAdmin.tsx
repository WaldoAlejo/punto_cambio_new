"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

export default function SaldoServientregaAdmin() {
  const [saldoActual, setSaldoActual] = useState<number>(0);
  const [nuevoMonto, setNuevoMonto] = useState<string>("");
  const [creadoPor, setCreadoPor] = useState<string>("admin"); // Puedes cambiar esto si usas auth
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  const obtenerSaldo = async () => {
    try {
      const { data } = await axios.get("/api/servientrega/saldo");
      setSaldoActual(data.disponible ?? 0);
    } catch (error) {
      console.error("Error al obtener saldo:", error);
    }
  };

  const asignarSaldo = async () => {
    setLoading(true);
    setMensaje(null);

    try {
      const { data } = await axios.post("/api/servientrega/saldo", {
        monto_total: parseFloat(nuevoMonto),
        creado_por: creadoPor,
      });

      setMensaje("Saldo asignado correctamente.");
      obtenerSaldo();
      setNuevoMonto("");
    } catch (error) {
      console.error("Error al asignar saldo:", error);
      setMensaje("Error al asignar saldo.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    obtenerSaldo();
  }, []);

  return (
    <Card className="max-w-md mx-auto mt-10">
      <CardHeader>
        <CardTitle>Asignar saldo a Servientrega</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p>
          <strong>Saldo disponible:</strong> ${saldoActual.toFixed(2)}
        </p>

        <div className="space-y-2">
          <Label>Monto total a asignar</Label>
          <Input
            type="number"
            value={nuevoMonto}
            onChange={(e) => setNuevoMonto(e.target.value)}
            placeholder="Ej. 50.00"
          />
        </div>

        <div className="space-y-2">
          <Label>Asignado por</Label>
          <Input
            type="text"
            value={creadoPor}
            onChange={(e) => setCreadoPor(e.target.value)}
          />
        </div>

        <Button onClick={asignarSaldo} disabled={loading || !nuevoMonto}>
          {loading ? "Asignando..." : "Asignar saldo"}
        </Button>

        {mensaje && <p className="text-sm text-green-600">{mensaje}</p>}
      </CardContent>
    </Card>
  );
}
