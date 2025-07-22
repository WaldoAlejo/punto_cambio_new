"use client";

import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { Usuario, PuntoAtencion } from "../../types";

interface PasoRemitenteProps {
  user: Usuario;
  selectedPoint: PuntoAtencion;
  onNext: (remitente: RemitenteFormData) => void;
}

interface Punto {
  id: number;
  nombre: string;
  ciudad: string;
  provincia: string;
}

interface RemitenteFormData {
  nombre: string;
  direccion: string;
  telefono: string;
  email: string;
  ciudad: string;
  provincia: string;
  codpais: number;
  pais: string;
  pais_iso: string;
}

export default function PasoRemitente({
  user,
  selectedPoint,
  onNext,
}: PasoRemitenteProps) {
  const [puntos, setPuntos] = useState<Punto[]>([]);
  const [selectedPunto, setSelectedPunto] = useState<string>("");
  const [formData, setFormData] = useState<RemitenteFormData>({
    nombre: "",
    direccion: "",
    telefono: "",
    email: "",
    ciudad: "",
    provincia: "",
    codpais: 63,
    pais: "Ecuador",
    pais_iso: "EC",
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    axios
      .get("/api/servientrega/remitente/puntos")
      .then((res) => {
        setPuntos((res.data as { puntos: Punto[] }).puntos || []);
      })
      .catch((err) => {
        console.error("Error al obtener puntos:", err);
      });
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectPunto = (value: string) => {
    setSelectedPunto(value);
    const punto = puntos.find((p) => `${p.ciudad},${p.provincia}` === value);
    if (punto) {
      setFormData((prev) => ({
        ...prev,
        ciudad: punto.ciudad,
        provincia: punto.provincia,
      }));
    }
  };

  const handleContinue = () => {
    if (
      formData.nombre &&
      formData.direccion &&
      formData.telefono &&
      formData.email &&
      selectedPunto
    ) {
      setLoading(true);
      onNext(formData);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto mt-6">
      <CardHeader>
        <CardTitle>Información del Remitente</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input
          name="nombre"
          placeholder="Nombre completo"
          value={formData.nombre}
          onChange={handleChange}
        />
        <Input
          name="direccion"
          placeholder="Dirección"
          value={formData.direccion}
          onChange={handleChange}
        />
        <Input
          name="telefono"
          placeholder="Teléfono"
          value={formData.telefono}
          onChange={handleChange}
        />
        <Input
          name="email"
          placeholder="Correo electrónico"
          value={formData.email}
          onChange={handleChange}
        />

        <Select onValueChange={handleSelectPunto}>
          <SelectTrigger>
            <SelectValue placeholder="Seleccionar ciudad y provincia" />
          </SelectTrigger>
          <SelectContent>
            {puntos.map((p, i) => (
              <SelectItem key={i} value={`${p.ciudad},${p.provincia}`}>
                {p.ciudad} - {p.provincia}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          disabled={
            !formData.nombre ||
            !formData.direccion ||
            !formData.telefono ||
            !formData.email ||
            !selectedPunto ||
            loading
          }
          onClick={handleContinue}
          className="w-full"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Cargando...
            </>
          ) : (
            "Continuar"
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
