import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { User, PuntoAtencion, Moneda, Transferencia } from "../../types";

interface TransferListProps {
  user: User;
  selectedPoint: PuntoAtencion | null;
  transfers: Transferencia[];
  currencies: Moneda[];
  points: PuntoAtencion[];
  onTransferApproved: (transferId: string) => void;
}

const TransferList = ({
  user,
  selectedPoint,
  transfers,
  currencies,
  points,
  onTransferApproved,
}: TransferListProps) => {
  const getCurrencyName = (currencyId: string) => {
    const currency = currencies.find((c) => c.id === currencyId);
    return currency ? currency.codigo : "";
  };

  const getPointName = (pointId: string) => {
    if (!pointId) return "Sin especificar";
    const point = points.find((p) => p?.id === pointId);
    return point ? point.nombre : "Punto desconocido";
  };

  const getTransferTypeLabel = (type: string) => {
    const types = {
      ENTRE_PUNTOS: "Entre Puntos",
      DEPOSITO_MATRIZ: "Depósito Matriz",
      RETIRO_GERENCIA: "Retiro Gerencia",
      DEPOSITO_GERENCIA: "Depósito Gerencia",
    };
    return types[type as keyof typeof types] || type;
  };

  const getStatusBadge = (estado: string) => {
    switch (estado) {
      case "PENDIENTE":
        return (
          <Badge
            variant="outline"
            className="bg-yellow-50 text-yellow-800 border-yellow-300"
          >
            Pendiente
          </Badge>
        );
      case "APROBADO":
        return (
          <Badge
            variant="outline"
            className="bg-green-50 text-green-800 border-green-300"
          >
            Aprobado
          </Badge>
        );
      case "RECHAZADO":
        return (
          <Badge
            variant="outline"
            className="bg-red-50 text-red-800 border-red-300"
          >
            Rechazado
          </Badge>
        );
      default:
        return <Badge variant="outline">{estado}</Badge>;
    }
  };

  const approveTransfer = (transferId: string) => {
    if (user.rol !== "ADMIN" && user.rol !== "SUPER_USUARIO") {
      toast({
        title: "Sin permisos",
        description: "Solo los administradores pueden aprobar transferencias",
        variant: "destructive",
      });
      return;
    }
    onTransferApproved(transferId);
  };

  // ----- FILTRO CORRECTO -----
  const filteredTransfers = transfers.filter((transfer) => {
    if (user.rol === "ADMIN" || user.rol === "SUPER_USUARIO") {
      return true;
    }
    // Operador ve: las solicitadas por él o recibidas por su punto
    return (
      transfer.solicitado_por === user.id ||
      (selectedPoint && transfer.destino_id === selectedPoint.id)
    );
  });

  // Saber si la transferencia es recibida (para el operador)
  const isReceived = (transfer: Transferencia) =>
    selectedPoint &&
    transfer.destino_id === selectedPoint.id &&
    transfer.solicitado_por !== user.id;

  // Saber si la transferencia fue solicitada por el operador
  const isRequested = (transfer: Transferencia) =>
    transfer.solicitado_por === user.id;

  // Título
  const getOperatorTitle = () => {
    if (user.rol === "ADMIN" || user.rol === "SUPER_USUARIO") {
      return "Todas las Transferencias";
    }
    return "Transferencias Solicitadas y Recibidas";
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{getOperatorTitle()}</CardTitle>
        <CardDescription className="text-sm">
          {filteredTransfers.length === 0
            ? "No hay transferencias registradas"
            : `${filteredTransfers.length} transferencia(s)`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {filteredTransfers.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <p className="text-sm">No hay transferencias registradas</p>
            {user.rol !== "ADMIN" && user.rol !== "SUPER_USUARIO" && (
              <p className="text-xs mt-1">
                Crea tu primera transferencia usando el formulario
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {filteredTransfers.map((transfer) => (
              <div
                key={transfer.id}
                className="border rounded-lg p-3 space-y-2 bg-muted/20"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <h4 className="font-medium text-sm">
                        {getTransferTypeLabel(transfer.tipo_transferencia)}
                      </h4>
                      {getStatusBadge(transfer.estado)}
                      {isReceived(transfer) && (
                        <span className="text-xs text-blue-800 bg-blue-50 rounded px-1.5 py-0.5">
                          Recibida
                        </span>
                      )}
                      {isRequested(transfer) && (
                        <span className="text-xs text-muted-foreground bg-muted rounded px-1.5 py-0.5">
                          Solicitada
                        </span>
                      )}
                    </div>
                    <div className="text-xs space-y-1 text-muted-foreground">
                      <div className="flex justify-between">
                        <span>
                          <span className="font-medium">Monto:</span>{" "}
                          {transfer.monto} {getCurrencyName(transfer.moneda_id)}
                        </span>
                        <span>
                          {new Date(transfer.fecha).toLocaleDateString()}
                        </span>
                      </div>
                      {transfer.tipo_transferencia === "ENTRE_PUNTOS" &&
                        transfer.origen_id && (
                          <p>
                            {getPointName(transfer.origen_id)} →{" "}
                            {getPointName(transfer.destino_id)}
                          </p>
                        )}
                      {transfer.tipo_transferencia !== "ENTRE_PUNTOS" && (
                        <p>
                          <span className="font-medium">Destino:</span>{" "}
                          {getPointName(transfer.destino_id)}
                        </p>
                      )}
                      {transfer.numero_recibo && (
                        <p>
                          <span className="font-medium">Recibo:</span>{" "}
                          {transfer.numero_recibo}
                        </p>
                      )}
                      {transfer.descripcion && (
                        <p className="text-xs truncate">
                          <span className="font-medium">Notas:</span>{" "}
                          {transfer.descripcion}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Botones de acción para administradores */}
                {transfer.estado === "PENDIENTE" &&
                  (user.rol === "ADMIN" || user.rol === "SUPER_USUARIO") && (
                    <div className="flex gap-2 pt-2 border-t">
                      <Button
                        size="sm"
                        onClick={() => approveTransfer(transfer.id)}
                        className="bg-green-600 hover:bg-green-700 text-white h-7 text-xs"
                      >
                        Aprobar
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          toast({
                            title: "Función en desarrollo",
                            description:
                              "La funcionalidad de rechazo estará disponible próximamente",
                          });
                        }}
                        className="h-7 text-xs"
                      >
                        Rechazar
                      </Button>
                    </div>
                  )}

                {/* Info adicional para operador */}
                {user.rol !== "ADMIN" &&
                  user.rol !== "SUPER_USUARIO" &&
                  transfer.estado === "APROBADO" &&
                  isReceived(transfer) && (
                    <div className="pt-2 border-t">
                      <p className="text-xs text-green-700">
                        ✅ Has recibido una transferencia aprobada
                      </p>
                    </div>
                  )}

                {user.rol !== "ADMIN" &&
                  user.rol !== "SUPER_USUARIO" &&
                  transfer.estado === "APROBADO" &&
                  isRequested(transfer) && (
                    <div className="pt-2 border-t">
                      <p className="text-xs text-blue-700">
                        ✅ Tu transferencia ha sido aprobada
                      </p>
                    </div>
                  )}

                {user.rol !== "ADMIN" &&
                  user.rol !== "SUPER_USUARIO" &&
                  transfer.estado === "RECHAZADO" &&
                  isRequested(transfer) && (
                    <div className="pt-2 border-t">
                      <p className="text-xs text-red-600">
                        ❌ Tu transferencia ha sido rechazada
                      </p>
                    </div>
                  )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TransferList;
