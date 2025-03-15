// Path: features\ar\hooks\useDeviceOrientation.ts
import { useEffect, useState, useRef, useCallback } from 'react';
import { useLocationStore } from '../stores/locationStore';

interface SafariDeviceOrientationEvent extends DeviceOrientationEvent {
  webkitCompassHeading?: number;
}

/**
 * Simplified hook for accessing device orientation/compass data
 */
export const useDeviceOrientation = () => {
  const { setHeading } = useLocationStore();
  const [isCalibrated, setIsCalibrated] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [useFallbackHeading, setUseFallbackHeading] = useState(false);

  // Reading history for stabilization
  const headingHistoryRef = useRef<number[]>([]);
  const readingsCountRef = useRef(0);
  const fallbackIntervalRef = useRef<number | null>(null);

  // Generate a fallback heading (slowly rotating heading)
  const generateFallbackHeading = useCallback(() => {
    return (Date.now() / 100) % 360;
  }, []);

  // Process a new heading reading with simple smoothing
  const processHeading = useCallback(
    (newHeading: number) => {
      readingsCountRef.current++;

      // Add to history, keeping last 5 readings
      headingHistoryRef.current.push(newHeading);
      if (headingHistoryRef.current.length > 5) {
        headingHistoryRef.current.shift();
      }

      // Simple smoothing by averaging recent readings
      let smoothedHeading = newHeading;
      if (headingHistoryRef.current.length > 2) {
        // Adjust angles to handle 0/360 boundary correctly
        const adjustedHeadings = headingHistoryRef.current.map(h => {
          const diff = ((h - newHeading + 180) % 360) - 180;
          return newHeading + diff;
        });

        // Calculate mean
        smoothedHeading =
          adjustedHeadings.reduce((a, b) => a + b, 0) / adjustedHeadings.length;
        // Normalize to 0-360
        smoothedHeading = ((smoothedHeading % 360) + 360) % 360;
      }

      // Set as calibrated after a few readings
      if (!isCalibrated && readingsCountRef.current >= 5) {
        setIsCalibrated(true);
      }

      // Update the heading in the store
      setHeading(smoothedHeading);
    },
    [isCalibrated, setHeading],
  );

  // Handle device orientation event
  const handleOrientation = useCallback(
    (event: DeviceOrientationEvent) => {
      let heading: number | null = null;

      // Get the heading from the event
      if (
        (event as SafariDeviceOrientationEvent).webkitCompassHeading !==
        undefined
      ) {
        // iOS Safari provides webkitCompassHeading
        heading =
          (event as SafariDeviceOrientationEvent).webkitCompassHeading || 0;
      } else if (event.alpha !== null && event.absolute === true) {
        // Absolute orientation (Chrome, Firefox)
        heading = 360 - event.alpha;
      } else if (event.alpha !== null) {
        // Relative orientation - might need adjustment
        heading = 360 - event.alpha;

        // Adjust for device orientation if beta/gamma available
        if (event.beta !== null && event.gamma !== null) {
          const isLandscape = window.innerWidth > window.innerHeight;
          const isUpsideDown = event.beta < 0;
          const isRightSide = event.gamma > 0;

          if (isLandscape) {
            heading = (heading + (isRightSide ? 90 : -90)) % 360;
          } else if (isUpsideDown) {
            heading = (heading + 180) % 360;
          }
        }
      }

      // Process the heading if we got one
      if (heading !== null) {
        processHeading(heading);
      }
    },
    [processHeading],
  );

  // Try to request orientation permission on iOS
  const requestOrientationPermission = useCallback(async () => {
    if (
      typeof DeviceOrientationEvent !== 'undefined' &&
      typeof (DeviceOrientationEvent as any).requestPermission === 'function'
    ) {
      try {
        const permission = await (
          DeviceOrientationEvent as any
        ).requestPermission();
        return permission === 'granted';
      } catch (err) {
        return false;
      }
    }
    return true; // Permission not needed or already granted
  }, []);

  // Start fallback mode with simulated heading
  const startFallbackMode = useCallback(() => {
    setUseFallbackHeading(true);
    setIsCalibrated(true);

    if (fallbackIntervalRef.current) {
      clearInterval(fallbackIntervalRef.current);
    }

    // Generate simulated heading updates
    fallbackIntervalRef.current = window.setInterval(() => {
      const simulatedHeading = generateFallbackHeading();
      processHeading(simulatedHeading);
    }, 100);
  }, [generateFallbackHeading, processHeading]);

  // Initialize orientation tracking
  useEffect(() => {
    let permissionTimeout: number;
    let sensorTimeout: number;
    let hasReceivedEvents = false;

    const initOrientation = async () => {
      // Try to request permission first (iOS)
      const hasPermission = await requestOrientationPermission();

      if (!hasPermission) {
        setErrorMessage('Orientation permission denied');
        startFallbackMode();
        return;
      }

      // Add event listeners - use type assertion to avoid TypeScript errors
      if ('ondeviceorientationabsolute' in window) {
        (window as any).addEventListener(
          'deviceorientationabsolute',
          handleOrientation,
          { passive: true },
        );
      } else {
        (window as any).addEventListener(
          'deviceorientation',
          handleOrientation,
          { passive: true },
        );
      }

      // Set timeout to check if we're receiving events
      sensorTimeout = window.setTimeout(() => {
        if (!hasReceivedEvents) {
          setErrorMessage('Orientation sensor not available');
          startFallbackMode();
        }
      }, 3000);

      // Create listener to detect when we get our first event
      const initialListener = () => {
        hasReceivedEvents = true;
        (window as any).removeEventListener(
          'deviceorientation',
          initialListener,
        );
        (window as any).removeEventListener(
          'deviceorientationabsolute',
          initialListener,
        );
        clearTimeout(sensorTimeout);
      };

      (window as any).addEventListener('deviceorientation', initialListener, {
        once: true,
      });
      (window as any).addEventListener(
        'deviceorientationabsolute',
        initialListener,
        { once: true },
      );
    };

    // Give browser a moment to initialize
    permissionTimeout = window.setTimeout(() => {
      initOrientation();
    }, 500);

    // Cleanup
    return () => {
      clearTimeout(permissionTimeout);
      clearTimeout(sensorTimeout);

      if (fallbackIntervalRef.current) {
        clearInterval(fallbackIntervalRef.current);
      }

      // Remove event listeners - use type assertion to avoid TypeScript errors
      (window as any).removeEventListener(
        'deviceorientationabsolute',
        handleOrientation,
      );
      (window as any).removeEventListener(
        'deviceorientation',
        handleOrientation,
      );
    };
  }, [handleOrientation, requestOrientationPermission, startFallbackMode]);

  return {
    isCalibrated,
    errorMessage,
    useFallbackHeading,
  };
};
