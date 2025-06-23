
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { reportService } from "@/services/reportService";
import { ReportData } from "@/types";
import { FileText, Download } from "lucide-react";

export const Reports = () => {
  const [reportData, setReportData] = useState<ReportData[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    reportType: "exchanges" as "exchanges" | "transfers" | "balances" | "users",
    dateFrom: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    dateTo: new Date().toISOString().split('T')[0],
  });
  const { toast } = useToast();

  const generateReport = async () => {
    if (!filters.dateFrom || !filters.dateTo) {
      toast({
        title: "Error",
        description: "Por favor selecciona un rango de fechas válido",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const result = await reportService.getReportData(
        filters.reportType,
        filters.dateFrom,
        filters.dateTo
      );

      if (result.error) {
        toast({
          title: "Error",
          description: result.error,
          variant: "destructive",
        });
      } else {
        setReportData(result.data);
        toast({
          title: "Éxito",
          description: `Reporte generado con ${result.data.length} registros`,
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Error al generar el reporte",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    if (reportData.length === 0) {
      toast({
        title: "Error",
        description: "No hay datos para exportar",
        variant: "destructive",
      });
      return;
    }

    const headers = Object.keys(reportData[0]).join(',');
    const rows = reportData.map(row => Object.values(row).join(',')).join('\n');
    const csv = `${headers}\n${rows}`;
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reporte_${filters.reportType}_${filters.dateFrom}_${filters.dateTo}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const getReportTypeLabel = (type: string) => {
    switch (type) {
      case 'exchanges':
        return 'Cambios de Divisa';
      case 'transfers':
        return 'Transferencias';
      case 'balances':
        return 'Saldos';
      case 'users':
        return 'Actividad de Usuarios';
      default:
        return type;
    }
  };

  const renderTableHeaders = () => {
    switch (filters.reportType) {
      case 'exchanges':
        return (
          <TableRow>
            <TableHead>Punto</TableHead>
            <TableHead>Usuario</TableHead>
            <TableHead>Cantidad de Cambios</TableHead>
            <TableHead>Monto Total</TableHead>
          </TableRow>
        );
      case 'transfers':
        return (
          <TableRow>
            <TableHead>Punto</TableHead>
            <TableHead>Usuario</TableHead>
            <TableHead>Transferencias</TableHead>
            <TableHead>Monto Total</TableHead>
          </TableRow>
        );
      case 'balances':
        return (
          <TableRow>
            <TableHead>Punto</TableHead>
            <TableHead>Saldo Total</TableHead>
          </TableRow>
        );
      case 'users':
        return (
          <TableRow>
            <TableHead>Punto</TableHead>
            <TableHead>Usuario</TableHead>
            <TableHead>Actividades</TableHead>
          </TableRow>
        );
      default:
        return <TableRow></TableRow>;
    }
  };

  const renderTableRow = (item: ReportData) => {
    switch (filters.reportType) {
      case 'exchanges':
        return (
          <TableRow key={`${item.point}-${item.user}`}>
            <TableCell>{item.point}</TableCell>
            <TableCell>{item.user || 'N/A'}</TableCell>
            <TableCell>{item.exchanges || 0}</TableCell>
            <TableCell>${(item.amount || 0).toLocaleString()}</TableCell>
          </TableRow>
        );
      case 'transfers':
        return (
          <TableRow key={`${item.point}-${item.user}`}>
            <TableCell>{item.point}</TableCell>
            <TableCell>{item.user || 'N/A'}</TableCell>
            <TableCell>{item.transfers || 0}</TableCell>
            <TableCell>${(item.amount || 0).toLocaleString()}</TableCell>
          </TableRow>
        );
      case 'balances':
        return (
          <TableRow key={item.point}>
            <TableCell>{item.point}</TableCell>
            <TableCell>${(item.balance || 0).toLocaleString()}</TableCell>
          </TableRow>
        );
      case 'users':
        return (
          <TableRow key={`${item.point}-${item.user}`}>
            <TableCell>{item.point}</TableCell>
            <TableCell>{item.user || 'N/A'}</TableCell>
            <TableCell>{item.transfers || 0}</TableCell>
          </TableRow>
        );
      default:
        return <TableRow key={item.point}></TableRow>;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <FileText className="h-5 w-5" />
            <CardTitle>Generador de Reportes</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div>
              <Label htmlFor="reportType">Tipo de Reporte</Label>
              <Select
                value={filters.reportType}
                onValueChange={(value) => setFilters({ ...filters, reportType: value as any })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="exchanges">Cambios de Divisa</SelectItem>
                  <SelectItem value="transfers">Transferencias</SelectItem>
                  <SelectItem value="balances">Saldos</SelectItem>
                  <SelectItem value="users">Actividad de Usuarios</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="dateFrom">Fecha Desde</Label>
              <Input
                id="dateFrom"
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="dateTo">Fecha Hasta</Label>
              <Input
                id="dateTo"
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
              />
            </div>
            <div className="flex items-end space-x-2">
              <Button onClick={generateReport} disabled={loading} className="flex-1">
                {loading ? "Generando..." : "Generar"}
              </Button>
              {reportData.length > 0 && (
                <Button variant="outline" onClick={exportToCSV}>
                  <Download className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {reportData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              Resultados: {getReportTypeLabel(filters.reportType)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                {renderTableHeaders()}
              </TableHeader>
              <TableBody>
                {reportData.map((item) => renderTableRow(item))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
