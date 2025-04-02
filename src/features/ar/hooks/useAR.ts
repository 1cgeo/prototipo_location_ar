// Path: features\ar\hooks\useAR.ts
import { useState, useEffect, useRef, useCallback } from 'react';
import { useARStore } from '../stores/arStore';

// Define types for events of orientation specific for iOS
interface SafariDeviceOrientationEvent extends DeviceOrientationEvent {
  webkitCompassHeading?: number;
}

// Interface for the DeviceOrientationEvent constructor with requestPermission
type DeviceOrientationEventType = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<PermissionState>;
};

/**
 * Unified hook for managing AR features: camera, location, and orientation
 */
export const useAR = (videoRef: React.RefObject<HTMLVideoElement | null>) => {
  const {
    // Camera state
    isCameraActive,
    cameraPermission,
    cameraError,

    // Location state
    coordinates,
    heading,
    locationPermission,
    locationError,
    isOrientationCalibrated,
    useFallbackHeading,

    // Actions
    setCameraActive,
    setCameraPermission,
    setCameraError,
    setCoordinates,
    setHeading,
    setLocationPermission,
    setLocationError,
    setOrientationCalibrated,
    setUseFallbackHeading,
    refreshMarkers,
  } = useARStore();

  const streamRef = useRef<MediaStream | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const hasAttemptedRef = useRef(false);
  const headingHistoryRef = useRef<number[]>([]);
  const readingsCountRef = useRef(0);
  const fallbackIntervalRef = useRef<number | null>(null);
  const permissionRetryTimeoutRef = useRef<number | null>(null);
  const lastHeadingUpdateRef = useRef<number>(0);

  // Clean up camera stream
  const cleanupStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        try {
          track.stop();
        } catch (err) {
          // Silent cleanup
        }
      });
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current.onloadedmetadata = null;
      videoRef.current.onloadeddata = null;
    }
  }, [videoRef]);

  // Handle sensor calibration status
  const updateCalibrationStatus = useCallback(() => {
    if (
      readingsCountRef.current >= 5 &&
      headingHistoryRef.current.length >= 3
    ) {
      // Check if our readings are stable enough to be considered calibrated
      const readings = headingHistoryRef.current.slice(-3);

      // Calculate stability (lower value means more stable)
      const stability = Math.max(
        Math.abs(readings[0] - readings[1]),
        Math.abs(readings[1] - readings[2]),
      );

      // If readings are relatively stable (within 10 degrees), consider calibrated
      if (stability < 10) {
        setOrientationCalibrated(true);
      }
    }
  }, [setOrientationCalibrated]);

  // Start camera
  const startCamera = useCallback(async () => {
    if (isCameraActive) return;

    setIsTransitioning(true);

    try {
      cleanupStream();

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API not supported');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });

      streamRef.current = stream;
      setCameraPermission(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;

        const handleVideoReady = () => {
          if (!videoRef.current) return;

          try {
            videoRef.current
              .play()
              .then(() => setCameraActive(true))
              .catch(err => {
                if (err.name === 'NotAllowedError') {
                  // Still consider camera active for AR use cases
                  setCameraActive(true);
                } else {
                  setCameraError(`Camera error: ${err.name}`);
                }
              });
          } catch (err) {
            setCameraError('Camera playback failed');
          }
        };

        videoRef.current.onloadedmetadata = handleVideoReady;
        videoRef.current.onloadeddata = handleVideoReady;
      }
    } catch (err) {
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError') {
          setCameraPermission(false);
          setCameraError(
            'Camera access denied. Please enable camera access in your browser settings and refresh the page.',
          );
        } else {
          setCameraError(
            `Camera error: ${err.message || err.name || 'Unknown'}`,
          );
        }
      } else {
        setCameraError('Unknown camera error');
      }

      setCameraActive(false);
    } finally {
      setIsTransitioning(false);
    }
  }, [
    isCameraActive,
    cleanupStream,
    setCameraActive,
    setCameraPermission,
    setCameraError,
    videoRef,
  ]);

  // Stop camera
  const stopCamera = useCallback(() => {
    cleanupStream();
    setCameraActive(false);
  }, [cleanupStream, setCameraActive]);

  // Restart camera on errors
  const restartCamera = useCallback(() => {
    if (permissionRetryTimeoutRef.current) {
      clearTimeout(permissionRetryTimeoutRef.current);
    }

    stopCamera();
    permissionRetryTimeoutRef.current = window.setTimeout(() => {
      startCamera();
    }, 500);
  }, [startCamera, stopCamera]);

  // Set up geolocation with error handling and retries
  useEffect(() => {
    if (!('geolocation' in navigator)) {
      setLocationError('Geolocation not supported in your browser');
      setLocationPermission(false);
      return;
    }

    let retryCount = 0;
    const maxRetries = 3;

    const setupGeolocation = () => {
      try {
        const watchId = navigator.geolocation.watchPosition(
          position => {
            setCoordinates(
              position.coords.latitude,
              position.coords.longitude,
              position.coords.accuracy,
            );
            setLocationPermission(true);
            setLocationError(null);
            retryCount = 0; // Reset retry count on success
          },
          err => {
            let message = 'Location error';

            if (err.code === 1) {
              // PERMISSION_DENIED
              message =
                'Location permission denied. Please enable location in your browser settings and refresh.';
              setLocationPermission(false);
            } else if (err.code === 2) {
              // POSITION_UNAVAILABLE
              message = 'Location unavailable. Please ensure GPS is enabled.';

              // Retry for position unavailable errors
              if (retryCount < maxRetries) {
                retryCount++;
                setTimeout(setupGeolocation, 2000);
              }
            } else if (err.code === 3) {
              // TIMEOUT
              message =
                'Location request timed out. Please check your GPS signal.';

              // Retry for timeouts
              if (retryCount < maxRetries) {
                retryCount++;
                setTimeout(setupGeolocation, 2000);
              }
            }

            setLocationError(message);
          },
          {
            enableHighAccuracy: true,
            maximumAge: 0,
            timeout: 10000,
          },
        );

        return () => navigator.geolocation.clearWatch(watchId);
      } catch (error) {
        setLocationError('Failed to initialize location services');
        return () => {};
      }
    };

    return setupGeolocation();
  }, [setCoordinates, setLocationPermission, setLocationError]);

  // Process compass heading with smoothing and outlier rejection
  const processHeading = useCallback(
    (newHeading: number) => {
      const now = Date.now();

      // Throttle updates for performance (no more than every 50ms)
      if (now - lastHeadingUpdateRef.current < 50) {
        return;
      }

      lastHeadingUpdateRef.current = now;
      readingsCountRef.current++;

      // Check if the new heading is too different from our history (outlier detection)
      if (headingHistoryRef.current.length > 0) {
        const lastHeading =
          headingHistoryRef.current[headingHistoryRef.current.length - 1];
        let diff = Math.abs(newHeading - lastHeading);

        // Handle the 0/360 boundary case
        if (diff > 180) {
          diff = 360 - diff;
        }

        // If the reading is too different (>40°) and we're already calibrated,
        // consider it an outlier unless we get multiple similar outliers
        if (
          diff > 40 &&
          isOrientationCalibrated &&
          readingsCountRef.current > 10
        ) {
          // Don't add this reading to history, but keep incrementing readings count
          return;
        }
      }

      // Add to history
      headingHistoryRef.current.push(newHeading);
      if (headingHistoryRef.current.length > 5) {
        headingHistoryRef.current.shift();
      }

      // Apply smoothing
      let smoothedHeading = newHeading;
      if (headingHistoryRef.current.length > 2) {
        // Align all headings to handle the 0/360 boundary
        const adjustedHeadings = headingHistoryRef.current.map(h => {
          // Calculate the smallest angle difference
          const diff = ((h - newHeading + 180) % 360) - 180;
          return newHeading + diff;
        });

        // Apply weighted average favoring more recent readings
        const weights = [0.1, 0.15, 0.2, 0.25, 0.3]; // More weight to recent readings
        const totalWeight = weights
          .slice(0, adjustedHeadings.length)
          .reduce((a, b) => a + b, 0);

        smoothedHeading = 0;
        for (let i = 0; i < adjustedHeadings.length; i++) {
          const weight = weights[i] || weights[weights.length - 1];
          smoothedHeading += adjustedHeadings[i] * (weight / totalWeight);
        }

        // Normalize back to 0-360 range
        smoothedHeading = ((smoothedHeading % 360) + 360) % 360;
      }

      // Update calibration status
      updateCalibrationStatus();

      // Update heading
      setHeading(smoothedHeading);
    },
    [isOrientationCalibrated, setHeading, updateCalibrationStatus],
  );

  // Start fallback mode with simulated heading
  const startFallbackMode = useCallback(() => {
    // Only enter fallback mode if we don't already have a heading
    if (heading !== null && isOrientationCalibrated) {
      return;
    }

    console.log(
      'Starting fallback heading mode due to missing or unreliable sensors',
    );
    setUseFallbackHeading(true);
    setOrientationCalibrated(true);

    if (fallbackIntervalRef.current) {
      clearInterval(fallbackIntervalRef.current);
    }

    // Use a slow rotation that feels natural
    let simulatedHeading = heading || 0;
    fallbackIntervalRef.current = window.setInterval(() => {
      simulatedHeading = (simulatedHeading + 0.5) % 360;
      processHeading(simulatedHeading);
    }, 100);
  }, [
    heading,
    isOrientationCalibrated,
    processHeading,
    setOrientationCalibrated,
    setUseFallbackHeading,
  ]);

  // Handle orientation events with improved device orientation detection
  const handleOrientation = useCallback(
    (event: DeviceOrientationEvent) => {
      let heading: number | null = null;

      // Get heading from appropriate event properties
      if (
        (event as SafariDeviceOrientationEvent).webkitCompassHeading !==
        undefined
      ) {
        // iOS compass heading (already in degrees clockwise from north)
        heading =
          (event as SafariDeviceOrientationEvent).webkitCompassHeading || 0;
      } else if (event.alpha !== null) {
        // Alpha value (Android/other devices)
        // Alpha is in degrees counterclockwise, so we convert to clockwise
        heading = 360 - event.alpha;

        // We need additional adjustments based on screen orientation and device position
        if (event.beta !== null && event.gamma !== null) {
          // Get screen orientation
          const isLandscape = window.innerWidth > window.innerHeight;

          // Detect device orientation
          const isFlat = Math.abs(event.beta) < 10;
          const isUpsideDown = event.beta < 0;
          const isRightSide = event.gamma > 0;
          const isVertical = Math.abs(event.beta) > 70;

          // Apply different adjustments based on device position
          if (isFlat) {
            // No adjustment needed when device is flat
          } else if (isLandscape) {
            // Landscape adjustments
            if (isRightSide) {
              heading = (heading + 90) % 360;
            } else {
              heading = (heading + 270) % 360;
            }
          } else if (isVertical) {
            // Device held vertically
            if (isUpsideDown) {
              heading = (heading + 180) % 360;
            }
          }
        }
      }

      if (heading !== null) {
        processHeading(heading);
      }
    },
    [processHeading],
  );

  // Set up orientation sensors with improved permission handling
  useEffect(() => {
    let hasReceivedEvents = false;
    let sensorTimeout: number;

    const requestOrientation = async () => {
      // Request permission for iOS
      if (typeof DeviceOrientationEvent !== 'undefined') {
        const DeviceOrientationEventCasted =
          DeviceOrientationEvent as DeviceOrientationEventType;

        if (
          typeof DeviceOrientationEventCasted.requestPermission === 'function'
        ) {
          try {
            const permission =
              await DeviceOrientationEventCasted.requestPermission();
            if (permission !== 'granted') {
              console.log('Orientation permission denied, using fallback mode');
              startFallbackMode();
              return;
            }
          } catch (err) {
            console.log('Error requesting orientation permission:', err);
            startFallbackMode();
            return;
          }
        }
      }

      // Define a function to check if event is supported
      const isEventSupported = (eventName: string): boolean => {
        return eventName in window;
      };

      // Add event listeners with safety check
      const deviceOrientationAbsoluteSupported = isEventSupported(
        'ondeviceorientationabsolute',
      );
      const deviceOrientationSupported = isEventSupported(
        'ondeviceorientation',
      );

      if (deviceOrientationAbsoluteSupported) {
        window.addEventListener(
          'deviceorientationabsolute',
          handleOrientation as EventListener,
          { passive: true },
        );
      } else if (deviceOrientationSupported) {
        window.addEventListener(
          'deviceorientation',
          handleOrientation as EventListener,
          { passive: true },
        );
      } else {
        // If no events are supported, go to fallback mode
        console.log('No orientation events supported, using fallback mode');
        startFallbackMode();
        return;
      }

      // Set timeout to check if we're receiving events
      sensorTimeout = window.setTimeout(() => {
        if (!hasReceivedEvents) {
          console.log(
            'No orientation events received after timeout, using fallback mode',
          );
          startFallbackMode();
        }
      }, 3000);

      // Create listener to detect when we get our first event
      const initialListener = () => {
        hasReceivedEvents = true;

        if (deviceOrientationSupported) {
          window.removeEventListener(
            'deviceorientation',
            initialListener as EventListener,
          );
        }

        if (deviceOrientationAbsoluteSupported) {
          window.removeEventListener(
            'deviceorientationabsolute',
            initialListener as EventListener,
          );
        }

        clearTimeout(sensorTimeout);
      };

      // Add initial listeners with support check
      if (deviceOrientationSupported) {
        window.addEventListener(
          'deviceorientation',
          initialListener as EventListener,
          { once: true },
        );
      }

      if (deviceOrientationAbsoluteSupported) {
        window.addEventListener(
          'deviceorientationabsolute',
          initialListener as EventListener,
          { once: true },
        );
      }
    };

    const timeoutId = window.setTimeout(requestOrientation, 500);

    return () => {
      clearTimeout(timeoutId);
      clearTimeout(sensorTimeout);

      if (fallbackIntervalRef.current) {
        clearInterval(fallbackIntervalRef.current);
      }

      // Safe removal of event listeners
      const deviceOrientationAbsoluteSupported =
        'ondeviceorientationabsolute' in window;
      const deviceOrientationSupported = 'ondeviceorientation' in window;

      if (deviceOrientationAbsoluteSupported) {
        window.removeEventListener(
          'deviceorientationabsolute',
          handleOrientation as EventListener,
        );
      }

      if (deviceOrientationSupported) {
        window.removeEventListener(
          'deviceorientation',
          handleOrientation as EventListener,
        );
      }
    };
  }, [handleOrientation, startFallbackMode]);

  // Improved camera permission handling
  useEffect(() => {
    if (hasAttemptedRef.current) return;

    const checkPermissions = async () => {
      hasAttemptedRef.current = true;

      try {
        if (navigator.permissions && navigator.permissions.query) {
          try {
            const result = await navigator.permissions.query({
              name: 'camera' as PermissionName,
            });

            if (result.state === 'granted') {
              setCameraPermission(true);
              startCamera();
            } else if (result.state === 'denied') {
              setCameraPermission(false);
              setCameraError(
                'Camera access denied. Please enable camera access in your browser settings and refresh the page.',
              );
            } else {
              // Prompt state - need to request
              startCamera();
            }

            // Listen for permission changes
            result.addEventListener('change', () => {
              if (result.state === 'granted') {
                setCameraPermission(true);
                restartCamera();
              } else if (result.state === 'denied') {
                setCameraPermission(false);
                setCameraError('Camera permission changed to denied');
                stopCamera();
              }
            });

            return;
          } catch (err) {
            // Fall back to direct access
            console.log('Permission query API failed, trying direct access');
          }
        }

        // Try direct access as fallback
        startCamera();
      } catch (err) {
        console.error('Permission check error:', err);
        setCameraError('Failed to check camera permissions');
      }
    };

    checkPermissions();

    return () => {
      if (permissionRetryTimeoutRef.current) {
        clearTimeout(permissionRetryTimeoutRef.current);
      }
      stopCamera();
    };
  }, [
    setCameraPermission,
    setCameraError,
    startCamera,
    stopCamera,
    restartCamera,
  ]);

  return {
    // Camera
    startCamera,
    stopCamera,
    restartCamera,
    isCameraActive,
    cameraPermission,
    cameraError,
    isTransitioning,

    // Location
    coordinates,
    heading,
    locationPermission,
    locationError,
    refreshMarkers,

    // Orientation
    isOrientationCalibrated,
    useFallbackHeading,

    // Permissions handling
    requestCameraPermission: startCamera,
  };
};
