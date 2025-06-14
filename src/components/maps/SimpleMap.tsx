
import { useEffect, useRef } from 'react';

interface SimpleMapProps {
  lat: number;
  lng: number;
  zoom?: number;
  onLocationSelect?: (lat: number, lng: number) => void;
  className?: string;
}

const SimpleMap = ({ lat, lng, zoom = 13, onLocationSelect, className = '' }: SimpleMapProps) => {
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Por ahora usaremos un mapa estático simple
    // En producción se puede integrar con Leaflet u OpenStreetMap
    if (!mapRef.current) return;

    const handleClick = (event: MouseEvent) => {
      if (onLocationSelect) {
        // Simular coordenadas basadas en el click
        const rect = mapRef.current!.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        // Convertir posición del click a coordenadas aproximadas
        const newLat = lat + (y - rect.height / 2) * 0.001;
        const newLng = lng + (x - rect.width / 2) * 0.001;
        
        onLocationSelect(newLat, newLng);
      }
    };

    mapRef.current.addEventListener('click', handleClick);

    return () => {
      mapRef.current?.removeEventListener('click', handleClick);
    };
  }, [lat, lng, onLocationSelect]);

  return (
    <div className={`relative ${className}`}>
      <div 
        ref={mapRef}
        className="w-full h-64 bg-gray-100 border rounded-lg cursor-pointer relative overflow-hidden"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23e5e7eb' fill-opacity='0.4'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          backgroundSize: '30px 30px'
        }}
      >
        {/* Marcador de ubicación */}
        <div 
          className="absolute w-6 h-6 bg-red-500 rounded-full border-2 border-white shadow-lg transform -translate-x-1/2 -translate-y-full"
          style={{
            left: '50%',
            top: '50%'
          }}
        >
          <div className="absolute inset-0 bg-red-500 rounded-full animate-ping opacity-75"></div>
        </div>
        
        {/* Información de coordenadas */}
        <div className="absolute bottom-2 left-2 bg-white bg-opacity-90 px-2 py-1 rounded text-xs">
          {lat.toFixed(6)}, {lng.toFixed(6)}
        </div>
        
        {/* Instrucciones si es seleccionable */}
        {onLocationSelect && (
          <div className="absolute top-2 left-2 bg-blue-500 text-white px-2 py-1 rounded text-xs">
            Click para seleccionar ubicación
          </div>
        )}
      </div>
    </div>
  );
};

export default SimpleMap;
