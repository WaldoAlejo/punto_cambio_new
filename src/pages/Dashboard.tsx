import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { BalanceCard } from "@/components/dashboard/BalanceCard";
import { RecentTransfers } from "@/components/dashboard/RecentTransfers";
import { QuickStats } from "@/components/dashboard/QuickStats";
import { balanceService } from "@/services/balanceService";
import { transferService } from "@/services/transferService";
import { Saldo, Transferencia } from "@/types";
import { LogOut, RefreshCw } from "lucide-react";

const Dashboard = () => {
  const { user, logout } = useAuth();
  const [balances, setBalances] = useState<Saldo[]>([]);
  const [transfers, setTransfers] = useState<Transferencia[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const loadDashboardData = useCallback(async () => {
    if (!user?.punto_atencion_id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [balancesResult, transfersResult] = await Promise.all([
        balanceService.getBalancesByPoint(user.punto_atencion_id),
        transferService.getAllTransfers(),
      ]);

      if (balancesResult.error) {
        toast({
          title: "Error",
          description: balancesResult.error,
          variant: "destructive",
        });
      } else {
        setBalances(balancesResult.balances);
      }

      if (transfersResult.error) {
        toast({
          title: "Error",
          description: transfersResult.error,
          variant: "destructive",
        });
      } else {
        setTransfers(transfersResult.transfers);
      }
    } finally {
      setLoading(false);
    }
  }, [toast, user?.punto_atencion_id]);

  useEffect(() => {
    if (user?.punto_atencion_id) {
      loadDashboardData();
    }
  }, [user, loadDashboardData]);

  const handleLogout = () => {
    logout();
    toast({
      title: "Sesión cerrada",
      description: "Has cerrado sesión exitosamente",
    });
  };

  const totalBalance = balances.reduce(
    (sum, balance) => sum + balance.cantidad,
    0
  );
  const totalTransfers = transfers.length;
  const activeUsers = 1; // Usuario actual
  const dailyGrowth = Math.random() * 10 - 5; // Simulado

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 flex items-center justify-center">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <span className="mt-3 text-blue-700 font-semibold">
            Cargando dashboard...
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-2 sm:p-4">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-blue-800 text-center sm:text-left">
              Bienvenido, {user?.nombre}
            </h1>
            <p className="text-blue-600 text-center sm:text-left">
              Sistema Punto de Cambio - {user?.rol}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              onClick={loadDashboardData}
              className="w-full sm:w-auto"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Actualizar
            </Button>
            <Button
              variant="destructive"
              onClick={handleLogout}
              className="w-full sm:w-auto"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Cerrar Sesión
            </Button>
          </div>
        </div>

        {/* Quick Stats */}
        <QuickStats
          totalBalance={totalBalance}
          totalTransfers={totalTransfers}
          activeUsers={activeUsers}
          dailyGrowth={dailyGrowth}
        />

        {/* Main Content */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Balances */}
          <div className="xl:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Saldos Actuales</CardTitle>
              </CardHeader>
              <CardContent>
                {balances.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No hay saldos disponibles
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {balances.map((balance) => (
                      <BalanceCard key={balance.id} balance={balance} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Recent Transfers */}
          <div className="min-w-0">
            <RecentTransfers transfers={transfers} />
          </div>
        </div>

        {/* Information Card */}
        <Card>
          <CardHeader>
            <CardTitle>Información del Sistema</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <strong>Versión:</strong> 1.0.0
              </div>
              <div>
                <strong>Última actualización:</strong>{" "}
                {new Date().toLocaleDateString()}
              </div>
              <div>
                <strong>Estado:</strong>{" "}
                <span className="text-green-600">Activo</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
