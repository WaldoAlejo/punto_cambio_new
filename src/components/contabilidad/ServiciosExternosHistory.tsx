import React, { useEffect, useState } from "react";
import {
  listarMovimientosServiciosExternos,
  ServicioExterno,
} from "@/services/externalServicesService";
import { useAuth } from "@/hooks/useAuth";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function ServiciosExternosHistory() {
  const { user } = useAuth();
  const puntoId = user?.punto_atencion_id ?? "";
  const [servicio, setServicio] = useState<string>("");
  const [desde, setDesde] = useState<string>("");
  const [hasta, setHasta] = useState<string>("");
  const [items, setItems] = useState<any[]>([]);

  const load = async () => {
    if (!puntoId) return;
    const { movimientos } = await listarMovimientosServiciosExternos(puntoId, {
      servicio: (servicio || undefined) as ServicioExterno | undefined,
      desde: desde || undefined,
      hasta: hasta || undefined,
      limit: 50,
    });
    setItems(movimientos);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [puntoId]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-end">
        <div>
          <label className="text-sm">Servicio</label>
          <Select value={servicio} onValueChange={setServicio}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todos</SelectItem>
              <SelectItem value="YAGANASTE">YaGanaste</SelectItem>
              <SelectItem value="BANCO_GUAYAQUIL">Banco Guayaquil</SelectItem>
              <SelectItem value="WESTERN">Western</SelectItem>
              <SelectItem value="PRODUBANCO">Produbanco</SelectItem>
              <SelectItem value="BANCO_PACIFICO">Banco del Pacífico</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-sm">Desde</label>
          <Input
            type="date"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
          />
        </div>
        <div>
          <label className="text-sm">Hasta</label>
          <Input
            type="date"
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
          />
        </div>
        <Button onClick={load}>Filtrar</Button>
      </div>

      <div className="overflow-auto border rounded">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="p-2 text-left">Fecha</th>
              <th className="p-2 text-left">Servicio</th>
              <th className="p-2 text-left">Tipo</th>
              <th className="p-2 text-right">Monto (USD)</th>
              <th className="p-2 text-left">Referencia</th>
              <th className="p-2 text-left">Comprobante</th>
              <th className="p-2 text-left">Observación</th>
              <th className="p-2 text-left">Operador</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id} className="border-t">
                <td className="p-2">{new Date(it.fecha).toLocaleString()}</td>
                <td className="p-2">{it.servicio}</td>
                <td className="p-2">{it.tipo_movimiento}</td>
                <td className="p-2 text-right">{it.monto.toFixed(2)}</td>
                <td className="p-2">{it.numero_referencia || "-"}</td>
                <td className="p-2 truncate max-w-[200px]">
                  {it.comprobante_url ? (
                    <a
                      className="text-blue-600 underline"
                      href={it.comprobante_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Ver
                    </a>
                  ) : (
                    "-"
                  )}
                </td>
                <td className="p-2">{it.descripcion || "-"}</td>
                <td className="p-2">{it.usuario?.nombre || "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
