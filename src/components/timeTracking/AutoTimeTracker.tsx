
import { useEffect, useState } from 'react';
import { User, PuntoAtencion } from '../../types';

interface AutoTimeTrackerProps {
  user: User;
  selectedPoint: PuntoAtencion | null;
  onTimeUpdate?: (totalMinutes: number) => void;
}

const AutoTimeTracker = ({ user, selectedPoint, onTimeUpdate }: AutoTimeTrackerProps) => {
  const [startTime] = useState<Date>(new Date());
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      setCurrentTime(now);
      
      const totalMinutes = Math.floor((now.getTime() - startTime.getTime()) / (1000 * 60));
      
      if (onTimeUpdate) {
        onTimeUpdate(totalMinutes);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [startTime, onTimeUpdate]);

  useEffect(() => {
    if (user && selectedPoint) {
      console.warn(`Time tracking started for user ${user.nombre} at point ${selectedPoint.nombre}`);
    }
  }, [user, selectedPoint]);

  const totalMinutes = Math.floor((currentTime.getTime() - startTime.getTime()) / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return (
    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-green-800">Tiempo de sesión</p>
          <p className="text-xs text-green-600">
            Iniciado: {startTime.toLocaleTimeString()}
          </p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-green-800">
            {hours.toString().padStart(2, '0')}:{minutes.toString().padStart(2, '0')}
          </p>
          <p className="text-xs text-green-600">h:m</p>
        </div>
      </div>
    </div>
  );
};

export default AutoTimeTracker;
