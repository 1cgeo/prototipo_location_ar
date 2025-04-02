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
  const initTimeoutRef = useRef<number | null>(null);
  const cameraTimerRef = useRef<number | null>(null);
  
  // Debug logging function
  const logDebug = useCallback((message: string) => {
    console.log(`[AR Debug] ${message}`);
  }, []);
  
  // Clean up camera stream with better error handling
  const cleanupStream = useCallback(() => {
    if (streamRef.current) {
      try {
        streamRef.current.getTracks().forEach(track => {
          try {
            track.stop();
          } catch (err) {
            // Silent cleanup
          }
        });
      } catch (err) {
        logDebug(`Error stopping camera tracks: ${err}`);
      }
      streamRef.current = null;
    }

    if (videoRef.current) {
      try {
        videoRef.current.srcObject = null;
        videoRef.current.onloadedmetadata = null;
        videoRef.current.onloadeddata = null;
      } catch (err) {
        logDebug(`Error cleaning video element: ${err}`);
      }
    }
  }, [videoRef, logDebug]);
  
  // Handle sensor calibration status 
  const updateCalibrationStatus = useCallback(() => {
    if (readingsCountRef.current >= 5 && headingHistoryRef.current.length >= 3) {
      // Check if our readings are stable enough to be considered calibrated
      const readings = headingHistoryRef.current.slice(-3);
      
      // Calculate stability (lower value means more stable)
      const stability = Math.max(
        Math.abs(readings[0] - readings[1]),
        Math.abs(readings[1] - readings[2])
      );
      
      // If readings are relatively stable (within 10 degrees), consider calibrated
      if (stability < 10) {
        setOrientationCalibrated(true);
      }
    }
  }, [setOrientationCalibrated]);
  
  // Process compass heading with smoothing and outlier rejection
  const processHeading = useCallback((newHeading: number) => {
    const now = Date.now();
    
    // Throttle updates for performance (no more than every 50ms)
    if (now - lastHeadingUpdateRef.current < 50) {
      return;
    }
    
    lastHeadingUpdateRef.current = now;
    readingsCountRef.current++;
    
    // Check if the new heading is too different from our history (outlier detection)
    if (headingHistoryRef.current.length > 0) {
      const lastHeading = headingHistoryRef.current[headingHistoryRef.current.length - 1];
      let diff = Math.abs(newHeading - lastHeading);
      
      // Handle the 0/360 boundary case
      if (diff > 180) {
        diff = 360 - diff;
      }
      
      // If the reading is too different (>40°) and we're already calibrated,
      // consider it an outlier unless we get multiple similar outliers
      if (diff > 40 && isOrientationCalibrated && readingsCountRef.current > 10) {
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
      const totalWeight = weights.slice(0, adjustedHeadings.length).reduce((a, b) => a + b, 0);
      
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
  }, [isOrientationCalibrated, setHeading, updateCalibrationStatus]);
  
  // Start fallback mode with simulated heading
  // Important: Define this before startCamera to avoid circular reference
  const startFallbackMode = useCallback(() => {
    // Only enter fallback mode if we don't already have a heading
    if (heading !== null && isOrientationCalibrated) {
      return;
    }
    
    logDebug("Starting fallback heading mode due to missing or unreliable sensors");
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
  }, [heading, isOrientationCalibrated, processHeading, setOrientationCalibrated, setUseFallbackHeading, logDebug]);
  
  // Start camera with better Android support
  const startCamera = useCallback(async () => {
    // First clean up any existing streams
    cleanupStream();
    
    if (isCameraActive) {
      return;
    }
    
    setIsTransitioning(true);
    
    // Clear any existing timeout
    if (cameraTimerRef.current) {
      clearTimeout(cameraTimerRef.current);
    }
    
    // Set a timeout to force fallback if camera doesn't initialize within 10 seconds
    cameraTimerRef.current = window.setTimeout(() => {
      if (!isCameraActive) {
        logDebug("Camera initialization timed out after 10 seconds - forcing activation");
        // Force camera active state even if we had issues
        setCameraActive(true);
        // If we don't have a heading yet, start fallback mode
        if (heading === null) {
          startFallbackMode();
        }
      }
    }, 10000);
    
    try {
      logDebug("Starting camera initialization");
      
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API not supported in this browser');
      }
      
      logDebug("Requesting camera stream");
      const constraints = {
        video: { 
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      setCameraPermission(true);
      logDebug("Camera stream obtained successfully");
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        logDebug("Video source set");
        
        const handleVideoReady = () => {
          if (!videoRef.current) return;
          
          logDebug("Video is ready, attempting to play");
          try {
            videoRef.current.play()
              .then(() => {
                logDebug("Video playing successfully");
                setCameraActive(true);
                setIsTransitioning(false);
                
                // Clear the timeout since we've successfully started
                if (cameraTimerRef.current) {
                  clearTimeout(cameraTimerRef.current);
                }
              })
              .catch(err => {
                logDebug(`Error playing video: ${err.name}`);
                if (err.name === 'NotAllowedError') {
                  // Some Android browsers don't auto-play video even with muted,
                  // but we can still consider camera active for AR use cases
                  setCameraActive(true);
                  setIsTransitioning(false);
                } else {
                  setCameraError(`Camera playback error: ${err.name}`);
                }
              });
          } catch (err) {
            logDebug(`Exception playing video: ${err}`);
            setCameraError('Camera playback failed');
            
            // For Android, still consider camera active after a short delay
            // This is a workaround for browsers that have issues with video.play()
            setTimeout(() => {
              setCameraActive(true);
              setIsTransitioning(false);
            }, 1000);
          }
        };
        
        videoRef.current.onloadedmetadata = handleVideoReady;
        videoRef.current.onloadeddata = handleVideoReady;
        
        // Backup in case event listeners don't fire (happens on some Android devices)
        setTimeout(handleVideoReady, 1000);
      }
    } catch (err) {
      if (err instanceof Error) {
        logDebug(`Camera error: ${err.name} - ${err.message}`);
        if (err.name === 'NotAllowedError') {
          setCameraPermission(false);
          setCameraError('Camera access denied. Please enable camera access in your browser settings and refresh the page.');
        } else if (err.name === 'NotReadableError') {
          setCameraError('Cannot access camera. It may be in use by another application.');
        } else if (err.name === 'OverconstrainedError') {
          // Try again with more relaxed constraints
          logDebug("Retrying with relaxed camera constraints");
          try {
            const fallbackStream = await navigator.mediaDevices.getUserMedia({
              video: true,
              audio: false
            });
            streamRef.current = fallbackStream;
            if (videoRef.current) {
              videoRef.current.srcObject = fallbackStream;
              videoRef.current.onloadedmetadata = () => {
                setCameraActive(true);
                setIsTransitioning(false);
              };
            }
          } catch (fallbackErr) {
            setCameraError(`Camera error: ${err.message || err.name}`);
          }
        } else {
          setCameraError(`Camera error: ${err.message || err.name}`);
        }
      } else {
        setCameraError('Unknown camera error');
      }
      
      logDebug("Setting fallback mode due to camera error");
      // For Android, we'll still try to continue with fallback mode
      setTimeout(() => {
        // Force camera active so the UI progresses
        setCameraActive(true);
        setIsTransitioning(false);
        startFallbackMode();
      }, 2000);
    }
  }, [
    isCameraActive,
    cleanupStream,
    setCameraActive,
    setCameraPermission,
    setCameraError,
    setIsTransitioning,
    videoRef,
    heading,
    startFallbackMode,
    logDebug
  ]);
  
  // Handle orientation events with improved Android device orientation detection
  const handleOrientation = useCallback((event: DeviceOrientationEvent) => {
    let heading: number | null = null;
    
    // Get heading from appropriate event properties
    if ((event as SafariDeviceOrientationEvent).webkitCompassHeading !== undefined) {
      // iOS compass heading (already in degrees clockwise from north)
      heading = (event as SafariDeviceOrientationEvent).webkitCompassHeading || 0;
      logDebug(`iOS compass heading: ${heading}`);
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
        
        logDebug(`Device orientation - alpha: ${event.alpha}, beta: ${event.beta}, gamma: ${event.gamma}`);
        
        // Apply different adjustments based on device position
        if (isFlat) {
          // No adjustment needed when device is flat
          logDebug('Device is flat, no orientation adjustment');
        } else if (isLandscape) {
          // Landscape adjustments
          if (isRightSide) {
            heading = (heading + 90) % 360;
            logDebug('Device in landscape right, adjusting +90');
          } else {
            heading = (heading + 270) % 360;
            logDebug('Device in landscape left, adjusting +270');
          }
        } else if (isVertical) {
          // Device held vertically
          if (isUpsideDown) {
            heading = (heading + 180) % 360;
            logDebug('Device upside down, adjusting +180');
          }
        }
      }
    }
    
    if (heading !== null) {
      processHeading(heading);
    }
  }, [processHeading, logDebug]);
  
  // Stop camera
  const stopCamera = useCallback(() => {
    logDebug("Stopping camera");
    cleanupStream();
    setCameraActive(false);
    setIsTransitioning(false);
    
    // Clear any timeout
    if (cameraTimerRef.current) {
      clearTimeout(cameraTimerRef.current);
      cameraTimerRef.current = null;
    }
  }, [cleanupStream, setCameraActive, logDebug]);
  
  // Restart camera on errors
  const restartCamera = useCallback(() => {
    logDebug("Restarting camera");
    if (permissionRetryTimeoutRef.current) {
      clearTimeout(permissionRetryTimeoutRef.current);
    }
    
    stopCamera();
    permissionRetryTimeoutRef.current = window.setTimeout(() => {
      startCamera();
    }, 500);
  }, [startCamera, stopCamera, logDebug]);
  
  // Set up geolocation with error handling and retries
  useEffect(() => {
    if (!('geolocation' in navigator)) {
      logDebug("Geolocation not supported in browser");
      setLocationError('Geolocation not supported in your browser');
      setLocationPermission(false);
      
      // Still try to start the fallback mode after a delay
      setTimeout(() => {
        if (heading === null) {
          startFallbackMode();
        }
      }, 2000);
      return;
    }
    
    logDebug("Setting up geolocation");
    let retryCount = 0;
    const maxRetries = 3;
    
    const setupGeolocation = () => {
      try {
        const watchId = navigator.geolocation.watchPosition(
          position => {
            logDebug(`Location updated: ${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}`);
            setCoordinates(
              position.coords.latitude,
              position.coords.longitude,
              position.coords.accuracy
            );
            setLocationPermission(true);
            setLocationError(null);
            retryCount = 0; // Reset retry count on success
          },
          err => {
            let message = 'Location error';
            
            if (err.code === 1) { // PERMISSION_DENIED
              logDebug("Location permission denied");
              message = 'Location permission denied. Please enable location in your browser settings and refresh.';
              setLocationPermission(false);
            } else if (err.code === 2) { // POSITION_UNAVAILABLE
              logDebug(`Location unavailable: ${err.message}`);
              message = 'Location unavailable. Please ensure GPS is enabled.';
              
              // Retry for position unavailable errors
              if (retryCount < maxRetries) {
                retryCount++;
                setTimeout(setupGeolocation, 2000);
              }
            } else if (err.code === 3) { // TIMEOUT
              logDebug("Location request timed out");
              message = 'Location request timed out. Please check your GPS signal.';
              
              // Retry for timeouts
              if (retryCount < maxRetries) {
                retryCount++;
                setTimeout(setupGeolocation, 2000);
              }
            }
            
            setLocationError(message);
            
            // For Android, if we have location errors, force setting demo location after 5 seconds
            // This will allow the app to proceed even without accurate location
            setTimeout(() => {
              if (!coordinates.latitude || !coordinates.longitude) {
                logDebug("Setting fallback location after error");
                // Use a default location (this is just for demo purposes)
                setCoordinates(
                  -23.5505, // São Paulo, Brazil as fallback
                  -46.6333, 
                  1000 // Low accuracy to indicate this is approximate
                );
              }
            }, 5000);
          },
          {
            enableHighAccuracy: true,
            maximumAge: 0,
            timeout: 15000 // Longer timeout for Android
          }
        );
        
        return () => navigator.geolocation.clearWatch(watchId);
      } catch (error) {
        logDebug(`Failed to initialize location services: ${error}`);
        setLocationError('Failed to initialize location services');
        return () => {};
      }
    };
    
    return setupGeolocation();
  }, [
    setCoordinates, 
    setLocationPermission, 
    setLocationError, 
    startFallbackMode, 
    heading,
    coordinates.latitude,
    coordinates.longitude,
    logDebug
  ]);
  
  // Set up orientation sensors with improved permission handling and Android support
  useEffect(() => {
    let hasReceivedEvents = false;
    let sensorTimeout: number;
    
    logDebug("Setting up orientation sensors");
    
    const requestOrientation = async () => {
      // Request permission for iOS
      if (typeof DeviceOrientationEvent !== 'undefined') {
        const DeviceOrientationEventCasted = DeviceOrientationEvent as DeviceOrientationEventType;
        
        if (typeof DeviceOrientationEventCasted.requestPermission === 'function') {
          try {
            logDebug("Requesting iOS orientation permission");
            const permission = await DeviceOrientationEventCasted.requestPermission();
            if (permission !== 'granted') {
              logDebug("iOS orientation permission denied, using fallback mode");
              startFallbackMode();
              return;
            }
          } catch (err) {
            logDebug(`Error requesting iOS orientation permission: ${err}`);
            startFallbackMode();
            return;
          }
        }
      }
      
      // Define a function to check if event is supported
      const isEventSupported = (eventName: string): boolean => {
        return eventName in window;
      };
      
      // Android-specific: ensure orientation sensor is accessible
      if ('DeviceOrientationEvent' in window && 'ontouchstart' in window) {
        logDebug("Device appears to be mobile, checking orientation support");
      }
      
      // Add event listeners with safety check
      const deviceOrientationAbsoluteSupported = isEventSupported('ondeviceorientationabsolute');
      const deviceOrientationSupported = isEventSupported('ondeviceorientation');
      
      logDebug(`Orientation support: absolute=${deviceOrientationAbsoluteSupported}, relative=${deviceOrientationSupported}`);
      
      if (deviceOrientationAbsoluteSupported) {
        logDebug("Using deviceorientationabsolute event");
        window.addEventListener(
          'deviceorientationabsolute', 
          handleOrientation as EventListener, 
          { passive: true }
        );
      } else if (deviceOrientationSupported) {
        logDebug("Using deviceorientation event");
        window.addEventListener(
          'deviceorientation',
          handleOrientation as EventListener,
          { passive: true }
        );
      } else {
        // If no events are supported, go to fallback mode
        logDebug("No orientation events supported, using fallback mode");
        startFallbackMode();
        return;
      }
      
      // Set timeout to check if we're receiving events
      sensorTimeout = window.setTimeout(() => {
        if (!hasReceivedEvents) {
          logDebug("No orientation events received after timeout, using fallback mode");
          startFallbackMode();
        }
      }, 3000);
      
      // Create listener to detect when we get our first event
      const initialListener = () => {
        hasReceivedEvents = true;
        logDebug("Received first orientation event");
        
        if (deviceOrientationSupported) {
          window.removeEventListener('deviceorientation', initialListener as EventListener);
        }
        
        if (deviceOrientationAbsoluteSupported) {
          window.removeEventListener('deviceorientationabsolute', initialListener as EventListener);
        }
        
        clearTimeout(sensorTimeout);
      };
      
      // Add initial listeners with support check
      if (deviceOrientationSupported) {
        window.addEventListener('deviceorientation', initialListener as EventListener, { once: true });
      }
      
      if (deviceOrientationAbsoluteSupported) {
        window.addEventListener('deviceorientationabsolute', initialListener as EventListener, { once: true });
      }
    };
    
    const timeoutId = window.setTimeout(requestOrientation, 1000);
    
    return () => {
      logDebug("Cleaning up orientation sensors");
      clearTimeout(timeoutId);
      clearTimeout(sensorTimeout);
      
      if (fallbackIntervalRef.current) {
        clearInterval(fallbackIntervalRef.current);
      }
      
      // Safe removal of event listeners
      const deviceOrientationAbsoluteSupported = 'ondeviceorientationabsolute' in window;
      const deviceOrientationSupported = 'ondeviceorientation' in window;
      
      if (deviceOrientationAbsoluteSupported) {
        window.removeEventListener('deviceorientationabsolute', handleOrientation as EventListener);
      }
      
      if (deviceOrientationSupported) {
        window.removeEventListener('deviceorientation', handleOrientation as EventListener);
      }
    };
  }, [handleOrientation, startFallbackMode, logDebug]);
  
  // Master initialization with timeout
  useEffect(() => {
    logDebug("Starting master initialization");
    
    // Set a global timeout - if AR doesn't start within 15 seconds, force it to start
    if (initTimeoutRef.current) {
      clearTimeout(initTimeoutRef.current);
    }
    
    initTimeoutRef.current = window.setTimeout(() => {
      // Force proceed if still stuck in initialization
      if (!isCameraActive || !coordinates.latitude || !coordinates.longitude || heading === null) {
        logDebug("Forcing AR initialization after timeout");
        
        // Force camera active
        if (!isCameraActive) {
          setCameraActive(true);
        }
        
        // Set fallback location if needed
        if (!coordinates.latitude || !coordinates.longitude) {
          setCoordinates(
            -23.5505, // São Paulo, Brazil as fallback
            -46.6333,
            1000 // Low accuracy indicator
          );
        }
        
        // Start fallback heading if needed
        if (heading === null) {
          startFallbackMode();
        }
      }
    }, 15000);
    
    // Cleanup
    return () => {
      if (initTimeoutRef.current) {
        clearTimeout(initTimeoutRef.current);
      }
      
      if (cameraTimerRef.current) {
        clearTimeout(cameraTimerRef.current);
      }
    };
  }, [
    isCameraActive, 
    coordinates.latitude, 
    coordinates.longitude, 
    heading, 
    setCameraActive, 
    setCoordinates, 
    startFallbackMode,
    logDebug
  ]);
  
  // Improved camera permission handling
  useEffect(() => {
    if (hasAttemptedRef.current) return;
    
    const checkPermissions = async () => {
      hasAttemptedRef.current = true;
      logDebug("Checking camera permissions");
      
      try {
        if (navigator.permissions && navigator.permissions.query) {
          try {
            logDebug("Using Permissions API to check camera");
            const result = await navigator.permissions.query({
              name: 'camera' as PermissionName,
            });
            
            logDebug(`Camera permission state: ${result.state}`);
            
            if (result.state === 'granted') {
              setCameraPermission(true);
              startCamera();
            } else if (result.state === 'denied') {
              setCameraPermission(false);
              setCameraError('Camera access denied. Please enable camera access in your browser settings and refresh the page.');
            } else {
              // Prompt state - need to request
              startCamera();
            }
            
            // Listen for permission changes
            result.addEventListener('change', () => {
              logDebug(`Camera permission changed to: ${result.state}`);
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
            logDebug(`Permission query API failed: ${err}, trying direct access`);
          }
        }
        
        // Try direct access as fallback
        logDebug("Using direct camera access");
        startCamera();
      } catch (err) {
        logDebug(`Permission check error: ${err}`);
        setCameraError('Failed to check camera permissions');
        
        // For Android, force proceed after a timeout
        setTimeout(() => {
          setCameraActive(true);
          startFallbackMode();
        }, 5000);
      }
    };
    
    checkPermissions();
    
    return () => {
      logDebug("Cleaning up permission check");
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
    setCameraActive, 
    startFallbackMode, 
    logDebug
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