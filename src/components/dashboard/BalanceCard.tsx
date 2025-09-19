import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Coins } from "lucide-react";
import { Saldo } from "@/types";

interface BalanceCardProps {
  balance: Saldo;
}

export const BalanceCard = ({ balance }: BalanceCardProps) => {
  const getBalanceVariant = (amount: number) => {
    if (amount < 1000) return "destructive"; // rojo
    if (amount < 5000) return "secondary"; // amarillo o neutro
    return "default"; // verde/normal
  };

  const formatCurrency = (amount: number, symbol: string) => {
    return `${symbol}${amount.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  return (
    <Card
      className="
        transition-all duration-200 hover:shadow-lg
        rounded-xl border border-gray-200
        bg-gradient-to-br from-white via-blue-50 to-gray-50
        p-0 flex flex-col h-full
      "
    >
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle
          className="text-sm font-semibold text-blue-800 truncate max-w-[70%]"
          title={balance.moneda?.nombre || "Moneda desconocida"}
        >
          {balance.moneda?.nombre || "Moneda desconocida"}
        </CardTitle>
        <Coins className="h-5 w-5 text-blue-400 flex-shrink-0" />
      </CardHeader>

      <CardContent className="flex-1 flex flex-col justify-between">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <div className="text-2xl font-extrabold text-blue-950 leading-snug">
              {formatCurrency(balance.cantidad, balance.moneda?.simbolo || "$")}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {balance.billetes} billetes • {balance.monedas_fisicas} monedas
            </p>
          </div>
          <Badge
            variant={getBalanceVariant(balance.cantidad)}
            className="text-xs px-3 py-1"
          >
            {balance.moneda?.codigo || "UNK"}
          </Badge>
        </div>

        <div className="mt-2 text-xs text-gray-400">
          Actualizado:{" "}
          {new Date(balance.updated_at).toLocaleString("es-EC", {
            dateStyle: "short",
            timeStyle: "short",
          })}
        </div>
      </CardContent>
    </Card>
  );
};
