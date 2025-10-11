import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, PuntoAtencion } from "../../types";
import ActivePointsReport from "../admin/ActivePointsReport";
import TimeReports from "./TimeReports";

interface AdminTimeManagementProps {
  user: User;
  selectedPoint: PuntoAtencion | null;
}

const AdminTimeManagement = ({
  user,
  selectedPoint,
}: AdminTimeManagementProps) => {
  return (
    <div className="h-full flex flex-col gap-4">
      {/* Header - Siempre visible */}
      <div className="flex-shrink-0">
        <h1 className="text-lg font-bold text-gray-800">Gestión de Horarios</h1>
        <p className="text-xs text-gray-600">
          Panel administrativo para monitorear horarios y actividad de usuarios
        </p>
      </div>

      {/* Contenido scrolleable */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <Tabs
          defaultValue="active-users"
          className="w-full h-full flex flex-col"
        >
          <TabsList className="grid w-full grid-cols-2 flex-shrink-0">
            <TabsTrigger value="active-users">Usuarios Activos</TabsTrigger>
            <TabsTrigger value="time-reports">Reportes de Horarios</TabsTrigger>
          </TabsList>

          <TabsContent
            value="active-users"
            className="flex-1 min-h-0 overflow-y-auto mt-4"
          >
            <ActivePointsReport user={user} />
          </TabsContent>

          <TabsContent
            value="time-reports"
            className="flex-1 min-h-0 overflow-y-auto mt-4"
          >
            {/* Cambiar user por _user para coincidir con props */}
            <TimeReports _user={user} selectedPoint={selectedPoint} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminTimeManagement;
