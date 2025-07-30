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
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface ProductoSeleccionado {
  nombre: string;
  esDocumento: boolean;
}

interface PasoProductoProps {
  onNext: (producto: ProductoSeleccionado) => void;
}

export default function PasoProducto({ onNext }: PasoProductoProps) {
  const [productos, setProductos] = useState<string[]>([]);
  const [selectedProducto, setSelectedProducto] = useState("");
  const [loading, setLoading] = useState(false);
  const [cargandoProductos, setCargandoProductos] = useState(true);

  // 🔄 Cargar productos desde el backend Servientrega
  const fetchProductos = async () => {
    try {
      setCargandoProductos(true);
      const response = await axios.post<{ fetch: { producto: string }[] }>(
        "/api/servientrega/productos"
      );

      const lista = Array.isArray(response.data.fetch)
        ? response.data.fetch
        : [];

      const nombres = lista
        .map((p) => p.producto?.trim())
        .filter((p) => p && p.length > 0);

      setProductos(nombres);
    } catch (err) {
      console.error("❌ Error al cargar productos:", err);
      toast.error("No se pudieron cargar los productos. Intenta nuevamente.");
    } finally {
      setCargandoProductos(false);
    }
  };

  useEffect(() => {
    fetchProductos();
  }, []);

  const handleContinue = () => {
    if (!selectedProducto) {
      toast.error("Debes seleccionar un producto antes de continuar.");
      return;
    }
    setLoading(true);

    const producto: ProductoSeleccionado = {
      nombre: selectedProducto,
      esDocumento: selectedProducto.toUpperCase().includes("DOCUMENTO"),
    };

    // Simulación de carga breve para UX
    setTimeout(() => {
      setLoading(false);
      onNext(producto);
    }, 300);
  };

  return (
    <Card className="w-full max-w-md mx-auto mt-6">
      <CardHeader>
        <CardTitle>Seleccionar tipo de producto</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {cargandoProductos ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
          </div>
        ) : productos.length > 0 ? (
          <>
            <Select
              onValueChange={setSelectedProducto}
              value={selectedProducto}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar producto" />
              </SelectTrigger>
              <SelectContent>
                {productos.map((p, i) => (
                  <SelectItem key={i} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              disabled={!selectedProducto || loading}
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
          </>
        ) : (
          <div className="text-center text-gray-500">
            No hay productos disponibles.
            <Button variant="outline" className="mt-3" onClick={fetchProductos}>
              Reintentar
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
