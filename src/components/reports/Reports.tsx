
import { useState, useEffect } from 'react';
import { User, PuntoAtencion } from '../../types';
import ReportFilters from './ReportFilters';
import ReportChart from './ReportChart';
import ReportTable from './ReportTable';

interface ReportsProps {
  user: User;
  selectedPoint: PuntoAtencion | null;
}

const Reports = ({ user, selectedPoint }: ReportsProps) => {
  const [reportType, setReportType] = useState('exchanges');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [reportData, setReportData] = useState<any[]>([]);

  // Mock data
  const mockPoints: PuntoAtencion[] = [
    {
      id: '1',
      nombre: 'Punto Centro',
      direccion: 'Av. Principal 123',
      ciudad: 'Caracas',
      provincia: 'Distrito Capital',
      telefono: '+58 212-555-0001',
      activo: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      saldos: []
    },
    {
      id: '2', 
      nombre: 'Punto Norte',
      direccion: 'CC El Recreo',
      ciudad: 'Caracas',
      provincia: 'Distrito Capital',
      telefono: '+58 212-555-0002',
      activo: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      saldos: []
    }
  ];

  const mockUsers: User[] = [
    {
      id: '1',
      username: 'operador1',
      nombre: 'Juan Pérez',
      correo: 'juan@example.com',
      rol: 'OPERADOR',
      activo: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: '2',
      username: 'operador2', 
      nombre: 'María García',
      correo: 'maria@example.com',
      rol: 'OPERADOR',
      activo: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ];

  const generateMockData = () => {
    if (reportType === 'exchanges') {
      return [
        { point: mockPoints[0].nombre, user: mockUsers[0].nombre, exchanges: 15, amount: 45000 },
        { point: mockPoints[1].nombre, user: mockUsers[1].nombre, exchanges: 12, amount: 38000 },
      ];
    }
    return [];
  };

  useEffect(() => {
    setReportData(generateMockData());
  }, [reportType]);

  const generateReport = () => {
    if (!dateFrom || !dateTo) {
      return;
    }
    setReportData(generateMockData());
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Reportes</h1>
        <div className="text-sm text-gray-500">
          {selectedPoint ? `Punto: ${selectedPoint.nombre}` : 'Panel Administrativo'}
        </div>
      </div>

      <ReportFilters
        reportType={reportType}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onReportTypeChange={setReportType}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
        onGenerateReport={generateReport}
      />

      <ReportChart data={reportData} />

      <ReportTable data={reportData} reportType={reportType} />
    </div>
  );
};

export default Reports;
