import { useState, useEffect, useCallback } from "react";
import axios from "axios";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, Printer, Download } from "lucide-react";
import { User, PuntoAtencion } from "../../types";

interface ActivePointsReportProps {
  user: User;
}

interface PuntoConUsuario extends PuntoAtencion {
  usuario_activo?: User;
  estado_jornada?: string;
  hora_inicio?: string;
}

interface PuntosActivosResponse {
  puntos: PuntoConUsuario[];
  success: boolean;
  timestamp: string;
}

const ActivePointsReport = ({ user }: ActivePointsReportProps) => {
  const [puntosActivos, setPuntosActivos] = useState<PuntoConUsuario[]>([]);

  const cargarPuntosActivos = useCallback(async () => {
    try {
      const response = await axios.get<PuntosActivosResponse>(
        "/api/puntos/activos"
      );
      if (!response.data.success) {
        alert("No se pudo cargar los puntos activos del sistema.");
        return;
      }
      setPuntosActivos(response.data.puntos || []);
    } catch (error) {
      console.error("Error al cargar puntos activos", error);
      alert("Hubo un error al cargar los puntos activos. Intenta nuevamente.");
    }
  }, []);

  useEffect(() => {
    cargarPuntosActivos();
  }, [cargarPuntosActivos]);

  const getEstadoBadge = (estado?: string) => {
    switch (estado) {
      case "TRABAJANDO":
        return (
          <Badge variant="default" className="bg-green-500">
            Trabajando
          </Badge>
        );
      case "ALMUERZO":
        return <Badge variant="destructive">En almuerzo</Badge>;
      default:
        return <Badge variant="outline">Sin usuario</Badge>;
    }
  };

  const imprimirReporte = () => {
    const contenido = `
      REPORTE DE PUNTOS DE ATENCIÓN ACTIVOS
      =====================================
      Fecha: ${new Date().toLocaleDateString()}
      Hora: ${new Date().toLocaleTimeString()}

      ${puntosActivos
        .map(
          (punto) => `
      Punto: ${punto.nombre}
      Dirección: ${punto.direccion}
      Usuario: ${punto.usuario_activo?.nombre || "Sin usuario"}
      Estado: ${punto.estado_jornada || "Inactivo"}
      Inicio: ${punto.hora_inicio || "N/A"}
      ----------------------------------------
      `
        )
        .join("")}
    `;

    const ventanaImpresion = window.open("", "_blank");
    if (ventanaImpresion) {
      ventanaImpresion.document.write(`
        <html>
          <head>
            <title>Reporte Puntos Activos</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 20px; }
              .header { text-align: center; margin-bottom: 30px; }
              .content { white-space: pre-line; }
            </style>
          </head>
          <body>
            <div class="header">
              <h2>REPORTE DE PUNTOS DE ATENCIÓN ACTIVOS</h2>
              <p>${new Date().toLocaleDateString()} - ${new Date().toLocaleTimeString()}</p>
            </div>
            <div class="content">${contenido}</div>
          </body>
        </html>
      `);
      ventanaImpresion.document.close();
      ventanaImpresion.print();
    }
  };

  const exportarExcel = () => {
    const datos = puntosActivos.map((punto) => ({
      "Punto de Atención": punto.nombre,
      Dirección: punto.direccion,
      "Usuario Activo": punto.usuario_activo?.nombre || "Sin usuario",
      Estado: punto.estado_jornada || "Inactivo",
      "Hora Inicio": punto.hora_inicio || "N/A",
      Ciudad: punto.ciudad,
    }));

    console.log("Exportando a Excel:", datos);
    // Aquí puedes implementar exportación real con xlsx o similar
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Puntos de Atención Activos
        </CardTitle>
        <CardDescription>
          Estado actual de todos los puntos de atención y usuarios logueados
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex justify-end gap-2">
            <Button onClick={imprimirReporte} variant="outline" size="sm">
              <Printer className="mr-2 h-4 w-4" />
              Imprimir A4
            </Button>
            <Button onClick={exportarExcel} variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" />
              Exportar Excel
            </Button>
          </div>

          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Punto de Atención</TableHead>
                  <TableHead>Dirección</TableHead>
                  <TableHead>Usuario Activo</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Hora Inicio</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {puntosActivos.map((punto) => (
                  <TableRow key={punto.id}>
                    <TableCell className="font-medium">
                      {punto.nombre}
                    </TableCell>
                    <TableCell>{punto.direccion}</TableCell>
                    <TableCell>
                      {punto.usuario_activo?.nombre || (
                        <span className="text-gray-500 italic">
                          Sin usuario logueado
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {getEstadoBadge(punto.estado_jornada)}
                    </TableCell>
                    <TableCell className="font-mono">
                      {punto.hora_inicio || "--:--"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="text-sm text-gray-600">
            <p>Total de puntos: {puntosActivos.length}</p>
            <p>
              Puntos con usuarios activos:{" "}
              {puntosActivos.filter((p) => p.usuario_activo).length}
            </p>
            <p>Última actualización: {new Date().toLocaleString()}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ActivePointsReport;
