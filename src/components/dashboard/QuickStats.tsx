
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, DollarSign, Users } from "lucide-react";

interface QuickStatsProps {
  totalBalance: number;
  totalTransfers: number;
  activeUsers: number;
  dailyGrowth: number;
}

export const QuickStats = ({ 
  totalBalance, 
  totalTransfers, 
  activeUsers, 
  dailyGrowth 
}: QuickStatsProps) => {
  const stats = [
    {
      title: "Balance Total",
      value: `$${totalBalance.toLocaleString()}`,
      icon: DollarSign,
      color: "text-green-600",
    },
    {
      title: "Transferencias",
      value: totalTransfers.toString(),
      icon: TrendingUp,
      color: "text-blue-600",
    },
    {
      title: "Usuarios Activos",
      value: activeUsers.toString(),
      icon: Users,
      color: "text-purple-600",
    },
    {
      title: "Crecimiento Diario",
      value: `${dailyGrowth > 0 ? '+' : ''}${dailyGrowth.toFixed(1)}%`,
      icon: dailyGrowth >= 0 ? TrendingUp : TrendingDown,
      color: dailyGrowth >= 0 ? "text-green-600" : "text-red-600",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <Card key={stat.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
            <stat.icon className={`h-4 w-4 ${stat.color}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${stat.color}`}>
              {stat.value}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
