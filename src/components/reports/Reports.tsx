
import { useState, useEffect } from 'react';
import { User, PuntoAtencion } from '../../types';
import ReportFilters from './ReportFilters';
import ReportChart from './ReportChart';
import ReportTable from './ReportTable';
import { userService } from '../../services/userService';
import { pointService } from '../../services/pointService';
import { toast } from "@/hooks/use-toast";

interface ReportsProps {
  user: User;
  selectedPoint: PuntoAtencion | null;
}

const Reports = ({ user, selectedPoint }: ReportsProps) => {
  const [reportType, setReportType] = useState('exchanges');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [reportData, setReportData] = useState<any[]>([]);
  const [points, setPoints] = useState<PuntoAtencion[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      // Cargar puntos de atención
      const { points: fetchedPoints, error: pointsError } = await pointService.getAllPoints();
      if (!pointsError) {
        setPoints(fetchedPoints);
      }

      // Cargar usuarios
      const { users: fetchedUsers, error: usersError } = await userService.getAllUsers();
      if (!usersError) {
        setUsers(fetchedUsers);
      }
    } catch (error) {
      console.error('Error loading initial data:', error);
      toast({
        title: "Error",
        description: "Error al cargar datos iniciales",
        variant: "destructive"
      });
    }
  };

  const generateMockData = () => {
    // Como no hay datos reales aún, mostramos un mensaje indicativo
    if (reportType === 'exchanges') {
      return [];
    }
    return [];
  };

  const generateReport = () => {
    if (!dateFrom || !dateTo) {
      toast({
        title: "Error",
        description: "Debe seleccionar fechas de inicio y fin",
        variant: "destructive"
      });
      return;
    }
    
    setIsLoading(true);
    // Simulamos carga
    setTimeout(() => {
      setReportData(generateMockData());
      setIsLoading(false);
      
      if (generateMockData().length === 0) {
        toast({
          title: "Sin datos",
          description: "No hay operaciones en el rango de fechas seleccionado",
        });
      }
    }, 1000);
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Generando reporte...</p>
        </div>
      </div>
    );
  }

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

      {reportData.length === 0 && dateFrom && dateTo ? (
        <div className="text-center py-12">
          <p className="text-gray-500 text-lg">No hay datos para mostrar en el rango seleccionado</p>
          <p className="text-gray-400 mt-2">
            La base de datos está limpia. Comience creando usuarios, puntos de atención y realizando operaciones.
          </p>
        </div>
      ) : (
        <>
          <ReportChart data={reportData} />
          <ReportTable data={reportData} reportType={reportType} />
        </>
      )}
    </div>
  );
};

export default Reports;
