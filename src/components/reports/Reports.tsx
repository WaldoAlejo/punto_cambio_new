
import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { Download, BarChart3 } from "lucide-react";
import { User, PuntoAtencion } from '../../types';
import { reportService, ReportData } from '../../services/reportService';
import * as XLSX from 'xlsx';

interface ReportsProps {
  user: User;
  selectedPoint: PuntoAtencion | null;
}

interface ReportFilters {
  dateFrom: string;
  dateTo: string;
  reportType: 'exchanges' | 'transfers' | 'balances' | 'users';
  pointId?: string;
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
      const { data, error } = await reportService.getReportData(
        filters.reportType,
        filters.dateFrom,
        filters.dateTo
      );
      
      if (error) {
        toast({
          title: "Error",
          description: error,
          variant: "destructive"
        });
        return;
      }

      setReportData(data);
      toast({
        title: "Reporte generado",
        description: `Se generaron ${data.length} registros`,
      });
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

  const exportToExcel = () => {
    if (reportData.length === 0) {
      toast({
        title: "Sin datos",
        description: "No hay datos para exportar",
        variant: "destructive"
      });
      return;
    }

    // Configurar las cabeceras según el tipo de reporte
    const headers = getReportHeaders(filters.reportType);
    const title = getReportTitle(filters.reportType);
    
    // Formatear los datos para Excel
    const formattedData = reportData.map(row => {
      const formattedRow: any = {};
      headers.forEach(header => {
        formattedRow[header.label] = getFormattedValue(row, header.key);
      });
      return formattedRow;
    });

    // Crear el libro de Excel
    const worksheet = XLSX.utils.json_to_sheet(formattedData);
    
    // Establecer anchos de columna
    const columnWidths = headers.map(header => ({ wch: header.width || 15 }));
    worksheet['!cols'] = columnWidths;

    // Agregar título al reporte
    XLSX.utils.sheet_add_aoa(worksheet, [[title]], { origin: 'A1' });
    XLSX.utils.sheet_add_aoa(worksheet, [
      [`Período: ${filters.dateFrom} - ${filters.dateTo}`]
    ], { origin: 'A2' });
    XLSX.utils.sheet_add_aoa(worksheet, [
      [`Generado el: ${new Date().toLocaleString('es-ES')}`]
    ], { origin: 'A3' });
    XLSX.utils.sheet_add_aoa(worksheet, [['']], { origin: 'A4' }); // Línea en blanco

    // Ajustar el rango para incluir las filas de título
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
    range.s.r = 0; // Comenzar desde la fila 0
    worksheet['!ref'] = XLSX.utils.encode_range(range);

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Reporte');

    // Generar nombre de archivo
    const fileName = `${title.replace(/\s+/g, '_')}_${filters.dateFrom}_${filters.dateTo}.xlsx`;
    
    // Descargar el archivo
    XLSX.writeFile(workbook, fileName);

    toast({
      title: "Exportación exitosa",
      description: `Reporte exportado como ${fileName}`,
    });
  };

  const getReportHeaders = (reportType: string) => {
    const headerConfigs = {
      exchanges: [
        { key: 'point', label: 'Punto de Atención', width: 20 },
        { key: 'user', label: 'Usuario', width: 15 },
        { key: 'exchanges', label: 'Total Cambios', width: 12 },
        { key: 'amount', label: 'Monto Total', width: 15 }
      ],
      transfers: [
        { key: 'point', label: 'Punto de Atención', width: 20 },
        { key: 'user', label: 'Usuario', width: 15 },
        { key: 'transfers', label: 'Total Transferencias', width: 15 },
        { key: 'amount', label: 'Monto Total', width: 15 }
      ],
      balances: [
        { key: 'point', label: 'Punto de Atención', width: 20 },
        { key: 'balance', label: 'Saldo Total', width: 15 }
      ],
      users: [
        { key: 'point', label: 'Punto de Atención', width: 20 },
        { key: 'user', label: 'Usuario', width: 15 },
        { key: 'transfers', label: 'Actividades', width: 12 }
      ]
    };
    return headerConfigs[reportType as keyof typeof headerConfigs] || [];
  };

  const getReportTitle = (reportType: string) => {
    const titles = {
      exchanges: 'Reporte de Cambios de Divisas',
      transfers: 'Reporte de Transferencias',
      balances: 'Reporte de Saldos',
      users: 'Reporte de Actividad de Usuarios'
    };
    return titles[reportType as keyof typeof titles] || 'Reporte';
  };

  const getFormattedValue = (row: ReportData, key: string) => {
    const value = row[key as keyof ReportData];
    if (key === 'amount' || key === 'balance') {
      return typeof value === 'number' ? value.toFixed(2) : '0.00';
    }
    return value || 'N/A';
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
        <div className="flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-800">Reportes Gerenciales</h1>
        </div>
        {reportData.length > 0 && (
          <Button onClick={exportToExcel} className="bg-green-600 hover:bg-green-700">
            <Download className="h-4 w-4 mr-2" />
            Exportar a Excel
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Configuración del Reporte</CardTitle>
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
                  <SelectItem value="balances">Saldos Actuales</SelectItem>
                  <SelectItem value="users">Actividad de Usuarios</SelectItem>
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
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{getReportTitle(filters.reportType)}</CardTitle>
                <CardDescription>
                  {reportData.length} registros encontrados | Período: {filters.dateFrom} - {filters.dateTo}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50">
                    {getReportHeaders(filters.reportType).map(header => (
                      <TableHead key={header.key} className="font-semibold">
                        {header.label}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reportData.map((row, index) => (
                    <TableRow key={index} className="hover:bg-gray-50">
                      {getReportHeaders(filters.reportType).map(header => (
                        <TableCell key={header.key} className="py-3">
                          {getFormattedValue(row, header.key)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {reportData.length === 0 && !isLoading && (
        <Card>
          <CardContent className="flex items-center justify-center h-32">
            <div className="text-center">
              <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-500">Genere un reporte para ver los datos</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Reports;
