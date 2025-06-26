import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowUpRight, ArrowDownLeft, Clock } from "lucide-react";
import { Transferencia } from "@/types";

interface RecentTransfersProps {
  transfers: Transferencia[];
}

export const RecentTransfers = ({ transfers }: RecentTransfersProps) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "APROBADO":
        return "default";
      case "PENDIENTE":
        return "outline";
      case "RECHAZADO":
        return "destructive";
      default:
        return "secondary";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "APROBADO":
        return (
          <span className="bg-green-50 text-green-600 rounded-full p-2 mr-2 flex items-center">
            <ArrowUpRight className="h-5 w-5" />
          </span>
        );
      case "RECHAZADO":
        return (
          <span className="bg-red-50 text-red-600 rounded-full p-2 mr-2 flex items-center">
            <ArrowDownLeft className="h-5 w-5" />
          </span>
        );
      default:
        return (
          <span className="bg-yellow-50 text-yellow-600 rounded-full p-2 mr-2 flex items-center">
            <Clock className="h-5 w-5" />
          </span>
        );
    }
  };

  return (
    <Card className="rounded-xl shadow-sm border border-gray-200">
      <CardHeader>
        <CardTitle className="text-base font-semibold text-gray-800">
          Transferencias Recientes
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {transfers.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              No hay transferencias recientes
            </p>
          ) : (
            transfers.slice(0, 5).map((transfer) => (
              <div
                key={transfer.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/60 transition-all"
              >
                <div className="flex items-center mb-2 sm:mb-0">
                  {getStatusIcon(transfer.estado)}
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 truncate">
                      {transfer.destino?.nombre || "Destino desconocido"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {transfer.moneda?.simbolo || "$"}
                      {transfer.monto.toLocaleString()}{" "}
                      {transfer.moneda?.codigo}
                    </p>
                  </div>
                </div>
                <div className="text-left sm:text-right mt-1 sm:mt-0">
                  <Badge variant={getStatusColor(transfer.estado)}>
                    {transfer.estado}
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(transfer.fecha).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};
