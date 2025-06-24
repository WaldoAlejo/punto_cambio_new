
import React from 'react';
import { MapPin } from 'lucide-react';

interface SimpleMapProps {
  latitude?: number;
  longitude?: number;
  address?: string;
}

const SimpleMap: React.FC<SimpleMapProps> = ({ latitude, longitude, address }) => {
  // Unused variable renamed to follow ESLint rules
  const _zoom = 15;

  const mapUrl = latitude && longitude 
    ? `https://www.google.com/maps?q=${latitude},${longitude}&t=m&z=15&output=embed`
    : null;

  return (
    <div className="w-full h-64 bg-gray-100 rounded-lg relative overflow-hidden">
      {mapUrl ? (
        <iframe
          src={mapUrl}
          width="100%"
          height="100%"
          style={{ border: 0 }}
          allowFullScreen
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          title="Mapa de ubicación"
        />
      ) : (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <MapPin className="mx-auto h-8 w-8 text-gray-400 mb-2" />
            <p className="text-sm text-gray-500">
              {address || 'Ubicación no disponible'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default SimpleMap;
