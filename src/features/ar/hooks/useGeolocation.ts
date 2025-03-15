// Path: features\ar\hooks\useGeolocation.ts
import { useEffect } from 'react';
import { useLocationStore } from '../stores/locationStore';

/**
 * Hook personalizado para gerenciar a geolocalização do dispositivo
 *
 * @returns Objeto com estado da localização
 */
export const useGeolocation = () => {
  const {
    coordinates,
    hasPermission,
    error,
    setCoordinates,
    setPermission,
    setError,
  } = useLocationStore();

  useEffect(() => {
    let watchId: number;

    const startWatching = async () => {
      try {
        if (!('geolocation' in navigator)) {
          throw new Error('Geolocalização não suportada neste navegador');
        }

        watchId = navigator.geolocation.watchPosition(
          position => {
            setCoordinates(
              position.coords.latitude,
              position.coords.longitude,
              position.coords.accuracy,
            );
            setPermission(true);
            setError(null);
          },
          err => {
            console.error('Erro de geolocalização:', err);
            setError(`Erro de geolocalização: ${err.message}`);
            setPermission(false);
          },
          {
            enableHighAccuracy: true, // Usa GPS quando disponível
            maximumAge: 0, // Não usa cache
            timeout: 5000, // Timeout em ms
          },
        );
      } catch (err) {
        console.error('Erro ao iniciar geolocalização:', err);
        setError(
          err instanceof Error ? err.message : 'Erro ao iniciar geolocalização',
        );
        setPermission(false);
      }
    };

    startWatching();

    // Limpa o watch quando o componente é desmontado
    return () => {
      if (watchId) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, []);

  return { coordinates, hasPermission, error };
};
