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
  dailyGrowth,
}: QuickStatsProps) => {
  const stats = [
    {
      title: "Balance Total",
      value: `$${totalBalance.toLocaleString()}`,
      icon: DollarSign,
      color: "text-green-600",
      bg: "bg-green-50",
    },
    {
      title: "Transferencias",
      value: totalTransfers.toString(),
      icon: TrendingUp,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      title: "Usuarios Activos",
      value: activeUsers.toString(),
      icon: Users,
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
    {
      title: "Crecimiento Diario",
      value: `${dailyGrowth > 0 ? "+" : ""}${dailyGrowth.toFixed(1)}%`,
      icon: dailyGrowth >= 0 ? TrendingUp : TrendingDown,
      color: dailyGrowth >= 0 ? "text-green-600" : "text-red-600",
      bg: dailyGrowth >= 0 ? "bg-green-50" : "bg-red-50",
    },
  ];

  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => (
        <Card
          key={stat.title}
          className={`
            flex flex-col justify-between rounded-xl shadow-sm border border-gray-200
            transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5
            ${stat.bg}
          `}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-semibold text-gray-700 truncate">
              {stat.title}
            </CardTitle>
            <div
              className={`
                rounded-full p-2 ${stat.color} bg-white/70
                flex items-center justify-center shadow
              `}
            >
              <stat.icon className="h-6 w-6" />
            </div>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${stat.color} truncate`}>
              {stat.value}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
