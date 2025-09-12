import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { permissionService } from "@/services/permissionService";
import type { Permiso } from "@/types";
import { useAuth } from "@/hooks/useAuth";

export default function PermissionApprovals() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Permiso[]>([]);

  const load = async () => {
    setLoading(true);
    try {
      const { permisos } = await permissionService.list();
      setItems(permisos);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onApprove = async (id: string) => {
    await permissionService.approve(id);
    await load();
  };

  const onReject = async (id: string) => {
    await permissionService.reject(id);
    await load();
  };

  const canModerate =
    user && (user.rol === "ADMIN" || user.rol === "SUPER_USUARIO");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Permisos solicitados</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div>Cargando...</div>
        ) : (
          <div className="space-y-3">
            {items.map((p) => (
              <div key={p.id} className="p-3 border rounded">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                  <div>
                    <div className="font-medium">
                      {p.usuario?.nombre || p.usuario_id} – {p.tipo}
                    </div>
                    <div className="text-sm text-gray-600">
                      {new Date(p.fecha_inicio).toLocaleDateString()} →{" "}
                      {new Date(p.fecha_fin).toLocaleDateString()} · Estado:{" "}
                      {p.estado}
                    </div>
                    {p.descripcion && (
                      <div className="text-sm mt-1">{p.descripcion}</div>
                    )}
                    {p.archivo_url && (
                      <a
                        className="text-blue-600 text-sm"
                        href={p.archivo_url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Ver archivo{" "}
                        {p.archivo_nombre ? `(${p.archivo_nombre})` : ""}
                      </a>
                    )}
                  </div>
                  {canModerate && p.estado === "PENDIENTE" && (
                    <div className="flex gap-2 justify-end">
                      <Button variant="outline" onClick={() => onReject(p.id)}>
                        Rechazar
                      </Button>
                      <Button onClick={() => onApprove(p.id)}>Aprobar</Button>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {items.length === 0 && (
              <div className="text-sm text-gray-500">No hay solicitudes</div>
            )}
            <Separator />
            <div className="text-xs text-gray-500">
              Última actualización: {new Date().toLocaleString()}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
