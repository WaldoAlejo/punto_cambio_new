import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { Usuario, PuntoAtencion, ReportFilters, ReportData } from '../../types';
import { apiService } from '../../services/apiService';

interface ReportsProps {
  user: Usuario;
  selectedPoint: PuntoAtencion | null;
}

const Reports = ({ user, selectedPoint }: ReportsProps) => {
  const [filters, setFilters] = useState<ReportFilters>({
    dateFrom: new Date().toISOString().split('T')[0],
    dateTo: new Date().toISOString().split('T')[0],
    reportType: "exchanges",
    pointId: selectedPoint?.id
  });
  const [reportData, setReportData] = useState<ReportData[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (selectedPoint) {
      setFilters(prev => ({ ...prev, pointId: selectedPoint.id }));
    }
  }, [selectedPoint]);

  const generateReport = async () => {
    setIsLoading(true);
    try {
      const response = await apiService.post<{ data: ReportData[]; success: boolean; error?: string }>('/reports/generate', filters);
      
      if (response.success && response.data) {
        setReportData(response.data);
      } else {
        toast({
          title: "Error",
          description: response.error || "Error al generar reporte",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error generating report:', error);
      toast({
        title: "Error",
        description: "Error al generar reporte",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (user.rol !== 'ADMIN' && user.rol !== 'SUPER_USUARIO') {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-red-500 text-lg">No tiene permisos para acceder a esta sección</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Reportes</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Generar Reporte</CardTitle>
          <CardDescription>Configure los filtros para generar el reporte deseado</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div className="space-y-2">
              <Label>Fecha Desde</Label>
              <Input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Fecha Hasta</Label>
              <Input
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters(prev => ({ ...prev, dateTo: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo de Reporte</Label>
              <Select 
                value={filters.reportType} 
                onValueChange={(value: ReportFilters['reportType']) => setFilters(prev => ({ ...prev, reportType: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="exchanges">Cambios de Divisas</SelectItem>
                  <SelectItem value="transfers">Transferencias</SelectItem>
                  <SelectItem value="balances">Saldos</SelectItem>
                  <SelectItem value="users">Usuarios</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={generateReport} disabled={isLoading} className="w-full">
                {isLoading ? 'Generando...' : 'Generar Reporte'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {reportData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Resultados del Reporte</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Punto</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead>Transferencias</TableHead>
                  <TableHead>Intercambios</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reportData.map((row, index) => (
                  <TableRow key={index}>
                    <TableCell>{row.point}</TableCell>
                    <TableCell>{row.user || 'N/A'}</TableCell>
                    <TableCell>{row.amount || 0}</TableCell>
                    <TableCell>{row.transfers || 0}</TableCell>
                    <TableCell>{row.exchanges || 0}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Reports;
