import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Coins } from "lucide-react";
import { Saldo } from "@/types";

interface BalanceCardProps {
  balance: Saldo;
}

export const BalanceCard = ({ balance }: BalanceCardProps) => {
  const getBalanceColor = (amount: number) => {
    if (amount < 1000) return "destructive";
    if (amount < 5000) return "outline";
    return "default";
  };

  return (
    <Card
      className="
      transition-all duration-200 hover:shadow-lg
      rounded-xl border border-gray-200
      bg-gradient-to-br from-white via-blue-50 to-gray-50
      p-0
      flex flex-col h-full
      "
    >
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-semibold text-blue-800 truncate">
          {balance.moneda?.nombre || "Moneda desconocida"}
        </CardTitle>
        <Coins className="h-5 w-5 text-blue-400" />
      </CardHeader>
      <CardContent className="flex-1 flex flex-col justify-between">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <div className="text-2xl font-extrabold text-blue-950">
              {balance.moneda?.simbolo || "$"}
              {balance.cantidad.toLocaleString()}
            </div>
            <p className="text-xs text-gray-500">
              {balance.billetes} billetes • {balance.monedas_fisicas} monedas
            </p>
          </div>
          <Badge
            variant={getBalanceColor(balance.cantidad)}
            className="text-xs px-3 py-1"
          >
            {balance.moneda?.codigo || "UNK"}
          </Badge>
        </div>
        <div className="mt-2 text-xs text-gray-400">
          Actualizado: {new Date(balance.updated_at).toLocaleDateString()}
        </div>
      </CardContent>
    </Card>
  );
};
