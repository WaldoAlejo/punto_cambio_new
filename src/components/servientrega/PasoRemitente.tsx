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
import { toast } from "sonner";
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
  identificacion: string;
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

function validarCedulaEcuatoriana(cedula: string): boolean {
  if (!/^\d{10}$/.test(cedula)) return false;
  const digitos = cedula.split("").map(Number);
  const provincia = parseInt(cedula.substring(0, 2), 10);
  if (provincia < 1 || provincia > 24) return false;
  const verificador = digitos[9];
  let suma = 0;
  for (let i = 0; i < 9; i++) {
    let mult = digitos[i] * (i % 2 === 0 ? 2 : 1);
    if (mult > 9) mult -= 9;
    suma += mult;
  }
  const resultado = (10 - (suma % 10)) % 10;
  return resultado === verificador;
}

function validarTelefonoEcuatoriano(telefono: string): boolean {
  return /^09\d{8}$/.test(telefono) || /^0[2-7]\d{7,8}$/.test(telefono);
}

export default function PasoRemitente({
  user,
  selectedPoint,
  onNext,
}: PasoRemitenteProps) {
  const [puntos, setPuntos] = useState<Punto[]>([]);
  const [selectedPunto, setSelectedPunto] = useState<string>("");
  const [formData, setFormData] = useState<RemitenteFormData>({
    identificacion: "",
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
      !formData.identificacion ||
      !formData.nombre ||
      !formData.direccion ||
      !formData.telefono ||
      !formData.email ||
      !selectedPunto
    ) {
      toast.error("Por favor completa todos los campos obligatorios.");
      return;
    }

    // Validar identificación ecuatoriana o pasaporte
    if (
      formData.codpais === 63 &&
      !validarCedulaEcuatoriana(formData.identificacion)
    ) {
      toast.error("Cédula ecuatoriana inválida.");
      return;
    }

    // Validar número de teléfono
    if (!validarTelefonoEcuatoriano(formData.telefono)) {
      toast.error("Número de teléfono inválido.");
      return;
    }

    setLoading(true);
    onNext(formData);
  };

  return (
    <Card className="w-full max-w-2xl mx-auto mt-6">
      <CardHeader>
        <CardTitle>Información del Remitente</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Input
          name="identificacion"
          placeholder="Cédula o Pasaporte"
          value={formData.identificacion}
          onChange={handleChange}
        />
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

        <Button disabled={loading} onClick={handleContinue} className="w-full">
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
