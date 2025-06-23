
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
        return <ArrowUpRight className="h-4 w-4" />;
      case "RECHAZADO":
        return <ArrowDownLeft className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Transferencias Recientes</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {transfers.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              No hay transferencias recientes
            </p>
          ) : (
            transfers.slice(0, 5).map((transfer) => (
              <div key={transfer.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="flex items-center space-x-3">
                  {getStatusIcon(transfer.estado)}
                  <div>
                    <p className="font-medium">
                      {transfer.destino?.nombre || 'Destino desconocido'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {transfer.moneda?.simbolo || '$'}{transfer.monto.toLocaleString()} {transfer.moneda?.codigo}
                    </p>
                  </div>
                </div>
                <div className="text-right">
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
