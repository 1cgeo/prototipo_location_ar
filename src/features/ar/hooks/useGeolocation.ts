// Path: features\ar\hooks\useGeolocation.ts
import { useEffect, useState } from 'react';
import { useLocationStore } from '../stores/locationStore';

/**
 * Simplified hook for accessing device geolocation
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

  const [watchId, setWatchId] = useState<number | null>(null);

  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setError('Geolocation not supported in this browser');
      setPermission(false);
      return;
    }

    // Set up position watching
    const id = navigator.geolocation.watchPosition(
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
        let errorMessage = 'Error accessing location';

        switch (err.code) {
          case err.PERMISSION_DENIED:
            errorMessage = 'Location permission denied';
            setPermission(false);
            break;
          case err.POSITION_UNAVAILABLE:
            errorMessage = 'Location information unavailable';
            break;
          case err.TIMEOUT:
            errorMessage = 'Location request timed out';
            break;
        }

        setError(errorMessage);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10000,
      },
    );

    setWatchId(id);

    // Clean up
    return () => {
      if (watchId) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [setCoordinates, setPermission, setError]);

  return { coordinates, hasPermission, error };
};
