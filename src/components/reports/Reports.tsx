
import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { User, AttentionPoint } from '../../types';

interface ReportsProps {
  user: User;
  selectedPoint: AttentionPoint | null;
}

const Reports = ({ user, selectedPoint }: ReportsProps) => {
  const [reportType, setReportType] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [reportData, setReportData] = useState<any[]>([]);

  const reportTypes = [
    { value: 'balances', label: 'Saldos por Punto' },
    { value: 'exchanges', label: 'Cambios de Divisas' },
    { value: 'transfers', label: 'Transferencias' },
    { value: 'daily_close', label: 'Cierres Diarios' }
  ];

  const generateReport = () => {
    if (!reportType) {
      toast({
        title: "Error",
        description: "Seleccione un tipo de reporte",
        variant: "destructive"
      });
      return;
    }

    // Mock report data based on type
    let mockData = [];
    
    switch (reportType) {
      case 'balances':
        mockData = [
          {
            punto: selectedPoint?.name || 'Punto Centro',
            moneda: 'USD',
            saldo: 15000.00,
            fecha: new Date().toISOString().split('T')[0]
          },
          {
            punto: selectedPoint?.name || 'Punto Centro',
            moneda: 'EUR',
            saldo: 8500.00,
            fecha: new Date().toISOString().split('T')[0]
          }
        ];
        break;
      case 'exchanges':
        mockData = [
          {
            fecha: new Date().toISOString().split('T')[0],
            hora: '10:30:00',
            usuario: user.name,
            tipo: 'Venta',
            moneda_origen: 'EUR',
            moneda_destino: 'USD',
            monto_origen: 100,
            monto_destino: 110,
            tasa: 1.10
          },
          {
            fecha: new Date().toISOString().split('T')[0],
            hora: '14:15:00',
            usuario: user.name,
            tipo: 'Compra',
            moneda_origen: 'USD',
            moneda_destino: 'VES',
            monto_origen: 50,
            monto_destino: 1825000,
            tasa: 36500
          }
        ];
        break;
      case 'transfers':
        mockData = [
          {
            fecha: new Date().toISOString().split('T')[0],
            tipo: 'Entre Puntos',
            origen: 'Punto Centro',
            destino: 'Punto Norte',
            moneda: 'USD',
            monto: 2000,
            estado: 'Aprobado'
          }
        ];
        break;
      case 'daily_close':
        mockData = [
          {
            fecha: new Date().toISOString().split('T')[0],
            punto: selectedPoint?.name || 'Punto Centro',
            usuario: user.name,
            total_cambios: 15,
            total_transferencias: 3,
            estado: 'Cerrado'
          }
        ];
        break;
    }

    setReportData(mockData);
    
    toast({
      title: "Reporte generado",
      description: "El reporte se ha generado exitosamente",
    });
  };

  const exportReport = () => {
    if (reportData.length === 0) {
      toast({
        title: "Error",
        description: "No hay datos para exportar",
        variant: "destructive"
      });
      return;
    }

    // In a real application, this would generate and download a file
    toast({
      title: "Exportación exitosa",
      description: "El reporte se ha exportado a Excel",
    });
  };

  const renderReportTable = () => {
    if (reportData.length === 0) return null;

    const columns = Object.keys(reportData[0]);

    return (
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map(column => (
              <TableHead key={column} className="capitalize">
                {column.replace('_', ' ')}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {reportData.map((row, index) => (
            <TableRow key={index}>
              {columns.map(column => (
                <TableCell key={column}>
                  {typeof row[column] === 'number' && column.includes('monto') 
                    ? row[column].toLocaleString() 
                    : row[column]
                  }
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    );
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Informes y Reportes</h1>
        <div className="text-sm text-gray-500">
          {selectedPoint ? `Punto: ${selectedPoint.name}` : 'Todos los puntos'}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Generar Reporte</CardTitle>
          <CardDescription>Seleccione los parámetros para generar un reporte</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div className="space-y-2">
              <Label>Tipo de Reporte</Label>
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar" />
                </SelectTrigger>
                <SelectContent>
                  {reportTypes.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Fecha Desde</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Fecha Hasta</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>&nbsp;</Label>
              <Button 
                onClick={generateReport}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                Generar
              </Button>
            </div>
          </div>

          {reportData.length > 0 && (
            <div className="flex justify-end mb-4">
              <Button 
                onClick={exportReport}
                variant="outline"
                className="border-green-600 text-green-600 hover:bg-green-50"
              >
                Exportar a Excel
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {reportData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Resultados del Reporte</CardTitle>
            <CardDescription>
              {reportTypes.find(t => t.value === reportType)?.label} - {reportData.length} registros
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              {renderReportTable()}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Reports;
