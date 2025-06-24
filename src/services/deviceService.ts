
export interface DeviceInfo {
  deviceName: string;
  macAddress: string;
  userAgent: string;
  platform: string;
  timestamp: string;
}

export const deviceService = {
  async getDeviceInfo(): Promise<DeviceInfo> {
    try {
      // Obtener información básica del navegador
      const deviceName = this.getDeviceName();
      const macAddress = await this.getMacAddress();
      const userAgent = navigator.userAgent;
      const platform = navigator.platform;
      const timestamp = new Date().toISOString();

      return {
        deviceName,
        macAddress,
        userAgent,
        platform,
        timestamp
      };
    } catch (error) {
      console.error('Error al obtener información del dispositivo:', error);
      return {
        deviceName: 'Dispositivo desconocido',
        macAddress: 'MAC no disponible',
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        timestamp: new Date().toISOString()
      };
    }
  },

  getDeviceName(): string {
    const userAgent = navigator.userAgent;
    
    // Detectar tipo de dispositivo
    if (/iPhone/i.test(userAgent)) return 'iPhone';
    if (/iPad/i.test(userAgent)) return 'iPad';
    if (/Android/i.test(userAgent)) return 'Android';
    if (/Windows NT/i.test(userAgent)) return 'Windows PC';
    if (/Macintosh/i.test(userAgent)) return 'Mac';
    if (/Linux/i.test(userAgent)) return 'Linux';
    
    return 'Dispositivo desconocido';
  },

  async getMacAddress(): Promise<string> {
    try {
      // En navegadores web, no es posible obtener la MAC address directamente
      // por razones de seguridad. Usaremos un identificador único basado en 
      // características del navegador
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.textBaseline = 'top';
        ctx.font = '14px Arial';
        ctx.fillText('Device fingerprint', 2, 2);
        const fingerprint = canvas.toDataURL();
        
        // Generar un hash simple del fingerprint
        let hash = 0;
        for (let i = 0; i < fingerprint.length; i++) {
          const char = fingerprint.charCodeAt(i);
          hash = ((hash << 5) - hash) + char;
          hash = hash & hash; // Convertir a 32bit integer
        }
        
        // Formatear como MAC address
        const macLike = Math.abs(hash).toString(16).padStart(12, '0').toUpperCase();
        return `${macLike.slice(0,2)}:${macLike.slice(2,4)}:${macLike.slice(4,6)}:${macLike.slice(6,8)}:${macLike.slice(8,10)}:${macLike.slice(10,12)}`;
      }
    } catch (error) {
      console.error('Error al generar fingerprint del dispositivo:', error);
    }
    
    return 'XX:XX:XX:XX:XX:XX';
  },

  async getLocationWithDevice(): Promise<{
    location: { lat: number; lng: number; direccion?: string } | null;
    device: DeviceInfo;
  }> {
    const device = await this.getDeviceInfo();
    
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve({
          location: null,
          device
        });
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };

          try {
            // Intentar obtener la dirección usando geocoding inverso
            const response = await fetch(
              `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${location.lat}&longitude=${location.lng}&localityLanguage=es`
            );
            const data = await response.json();
            
            resolve({
              location: {
                ...location,
                direccion: data.display_name || `${location.lat}, ${location.lng}`
              },
              device
            });
          } catch {
            resolve({
              location,
              device
            });
          }
        },
        () => {
          resolve({
            location: null,
            device
          });
        },
        { timeout: 10000, enableHighAccuracy: true }
      );
    });
  }
};
