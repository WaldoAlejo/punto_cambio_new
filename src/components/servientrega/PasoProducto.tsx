"use client";

import React, { useEffect, useState } from "react";
import axiosInstance from "@/services/axiosInstance";
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
  nombre_producto: string; // <- Usar SIEMPRE este campo
  esDocumento: boolean;
}

interface PasoProductoProps {
  onNext: (producto: ProductoSeleccionado) => void;
}

export default function PasoProducto({ onNext }: PasoProductoProps) {
  // productos es array de objetos { nombre_producto }
  const [productos, setProductos] = useState<{ nombre_producto: string }[]>([]);
  const [selectedProducto, setSelectedProducto] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [cargandoProductos, setCargandoProductos] = useState(true);

  // Cargar productos desde el backend Servientrega (ya devuelve productos: [{nombre_producto: string}])
  const fetchProductos = async () => {
    try {
      setCargandoProductos(true);
      console.log("🔍 Cargando productos de Servientrega...");

      const response = await axiosInstance.post<{
        fetch?: { producto: string }[];
        productos?: { nombre_producto: string }[];
        success?: boolean;
        fallback?: boolean;
        warning?: string;
      }>("/servientrega/productos");

      console.log("📦 Respuesta de productos:", response.data);

      // Adaptar la respuesta - el servidor devuelve "fetch" con objetos que tienen "producto"
      let productos: { nombre_producto: string }[] = [];
      
      if (Array.isArray(response.data.fetch)) {
        // Convertir formato del servidor a formato esperado por el frontend
        productos = response.data.fetch.map(item => ({
          nombre_producto: item.producto.trim()
        }));
      } else if (Array.isArray(response.data.productos)) {
        productos = response.data.productos;
      }
      
      setProductos(productos);

      // Mostrar advertencia si se usó fallback
      if (response.data.fallback) {
        toast.warning(
          response.data.warning || "Se cargaron productos por defecto"
        );
      } else if (productos.length > 0) {
        toast.success(`${productos.length} productos cargados correctamente`);
      }
    } catch (err: any) {
      console.error("❌ Error al cargar productos:", err);

      // Mostrar error más específico
      const errorMessage =
        err.response?.data?.details ||
        err.response?.data?.error ||
        err.message ||
        "Error desconocido";
      toast.error(`Error al cargar productos: ${errorMessage}`);

      // Productos de emergencia si todo falla
      const productosEmergencia = [
        { nombre_producto: "PREMIER" },
        { nombre_producto: "ESTANDAR" },
        { nombre_producto: "EXPRESS" },
      ];
      setProductos(productosEmergencia);
      toast.info("Se cargaron productos básicos como respaldo");
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

    // Busca el objeto seleccionado para enviar el nombre_producto correcto
    const producto = productos.find(
      (p) => p?.nombre_producto === selectedProducto
    );

    const resultado: ProductoSeleccionado = {
      nombre_producto: producto?.nombre_producto || selectedProducto,
      esDocumento: (selectedProducto || "").toUpperCase().includes("DOCUMENTO"),
    };

    // Simulación de carga breve para UX
    setTimeout(() => {
      setLoading(false);
      onNext(resultado);
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
                  <SelectItem
                    key={i}
                    value={p?.nombre_producto || `producto-${i}`}
                  >
                    {p?.nombre_producto || `Producto ${i + 1}`}
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
