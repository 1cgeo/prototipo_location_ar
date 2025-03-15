// Path: features\ar\hooks\useDeviceOrientation.ts
import { useEffect, useState, useRef, useCallback } from 'react';
import { useLocationStore } from '../stores/locationStore';

// Duration of calibration window in ms
const CALIBRATION_WINDOW = 5000;
// Minimum number of readings to consider calibrated
const MIN_READINGS_CALIBRATED = 5;
// Maximum size of reading history
const MAX_HISTORY_SIZE = 20;
// Throttle interval in ms - Reduced for better responsiveness
const THROTTLE_INTERVAL = 8; // Approximately 120fps
// Timeout for initial sensor check
const INITIAL_SENSOR_CHECK_TIMEOUT = 1000;
// Maximum wait time for sensor initialization
const MAX_SENSOR_WAIT_TIME = 7000;

// Interface for Safari DeviceOrientationEvent with webkitCompassHeading
interface SafariDeviceOrientationEvent extends DeviceOrientationEvent {
  webkitCompassHeading?: number;
}

/**
 * Enhanced hook for accessing device orientation with improved
 * compatibility, error handling, and debug mode support
 */
export const useDeviceOrientation = () => {
  const { heading, setHeading } = useLocationStore();
  const [permissionState, setPermissionState] = useState<PermissionState | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCalibrated, setIsCalibrated] = useState(false);
  const [debugHeading, setDebugHeading] = useState<number | null>(null);
  const [useFallbackHeading, setUseFallbackHeading] = useState(false);

  // Refs for calibration state and stability
  const isMountedRef = useRef(true);
  const readingsCountRef = useRef(0);
  const lastHeadingRef = useRef<number | null>(null);
  const movementDetectedRef = useRef(false);
  const headingHistoryRef = useRef<Array<{ value: number; timestamp: number; confidence: number }>>([]);
  const calibrationTimeoutRef = useRef<number | null>(null);
  const lastProcessTimeRef = useRef(0);
  const consecutiveStableReadingsRef = useRef(0);
  const deviceOrientationRef = useRef<'portrait' | 'landscape' | null>(null);
  const permissionRequestedRef = useRef(false);
  const eventListenerAddedRef = useRef(false);
  const initialHeadingSetRef = useRef(false);
  const sensorTimedOutRef = useRef(false);
  const fallbackHeadingRef = useRef(0);
  const fallbackHeadingModeRef = useRef(false);
  const initialSensorCheckTimeoutRef = useRef<number | null>(null);
  const maxWaitTimeoutRef = useRef<number | null>(null);

  // DEBUG: Add counter for events received
  const eventsReceivedRef = useRef({
    absolute: 0,
    relative: 0,
    motion: 0,
  });

  // DEBUG: function to log events periodically
  const logEventsStatus = useCallback(() => {
    console.log(`[DeviceOrientation] Events received:`, {
      absolute: eventsReceivedRef.current.absolute,
      relative: eventsReceivedRef.current.relative,
      motion: eventsReceivedRef.current.motion,
      headingHistorySize: headingHistoryRef.current.length,
      lastHeading: lastHeadingRef.current,
      currentHeading: heading,
      debugHeading: debugHeading,
      isCalibrated,
      useFallback: useFallbackHeading,
      fallbackMode: fallbackHeadingModeRef.current,
    });
  }, [heading, isCalibrated, debugHeading, useFallbackHeading]);

  // Update the device orientation for better calibration
  useEffect(() => {
    const updateDeviceOrientation = () => {
      const newOrientation = window.innerWidth > window.innerHeight ? 'landscape' : 'portrait';
      deviceOrientationRef.current = newOrientation;
      console.log(`[DeviceOrientation] Orientation updated: ${newOrientation}`);
    };

    updateDeviceOrientation();
    window.addEventListener('resize', updateDeviceOrientation);
    window.addEventListener('orientationchange', updateDeviceOrientation);

    // Set up logging interval
    const logInterval = setInterval(logEventsStatus, 5000);

    return () => {
      window.removeEventListener('resize', updateDeviceOrientation);
      window.removeEventListener('orientationchange', updateDeviceOrientation);
      clearInterval(logInterval);
    };
  }, [logEventsStatus]);

  // Function to detect if the device is in motion
  // based on orientation changes - with more sensitive detection
  const detectMovement = useCallback(
    (newHeading: number): boolean => {
      if (lastHeadingRef.current === null) {
        lastHeadingRef.current = newHeading;
        return false;
      }

      // Calculate smallest angular difference (considering 0-360 circle)
      const alphaDiff = Math.abs(
        ((lastHeadingRef.current - newHeading + 180) % 360) - 180,
      );

      // Update reference value
      lastHeadingRef.current = newHeading;

      // Adaptive threshold based on calibration state
      // More sensitive to detect movement
      const movementThreshold = isCalibrated ? 0.8 : 0.5;

      // Return true if there's significant movement
      const hasMovement = alphaDiff > movementThreshold;

      // If movement detected, update ref for use in other functions
      if (hasMovement) {
        movementDetectedRef.current = true;
        // Reset stable readings counter
        consecutiveStableReadingsRef.current = 0;
      } else {
        // Increment stable readings counter
        consecutiveStableReadingsRef.current++;

        // After 10 consecutive stable readings, consider movement has stopped
        if (consecutiveStableReadingsRef.current > 10) {
          movementDetectedRef.current = false;
        }
      }

      return hasMovement;
    },
    [isCalibrated],
  );

  // Function to calculate confidence level based on reading stability
  const calculateConfidence = useCallback((newHeading: number): number => {
    if (headingHistoryRef.current.length < 3) return 0.5; // Medium confidence by default

    // Calculate standard deviation of recent readings
    const recentHeadings = headingHistoryRef.current
      .slice(-5)
      .map(h => h.value);

    // Adjust angles to avoid issues with 0/360 transition
    const adjustedHeadings = recentHeadings.map(h => {
      const diff = ((h - newHeading + 180) % 360) - 180;
      return newHeading + diff;
    });

    // Calculate mean and standard deviation
    const mean = adjustedHeadings.reduce((a, b) => a + b, 0) / adjustedHeadings.length;
    const variance = adjustedHeadings.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / 
      adjustedHeadings.length;
    const stdDev = Math.sqrt(variance);

    // Confidence inversely proportional to standard deviation (more stable = more confidence)
    // Normalized between 0.1 and 1.0
    return Math.max(0.1, Math.min(1.0, 1 - stdDev / 30));
  }, []);

  // Generate a simulated/fallback heading based on time (slowly rotating)
  const generateFallbackHeading = useCallback((): number => {
    // Slowly rotate at about 10 degrees per second
    const now = Date.now();
    const rotation = (now / 100) % 360;
    
    // Store the value for reuse in other functions
    fallbackHeadingRef.current = rotation;
    return rotation;
  }, []);

  // Enhanced function to process orientation readings with stability filter
  const processHeading = useCallback(
    (newHeading: number, isSimulated: boolean = false) => {
      // Don't process if component is unmounted
      if (!isMountedRef.current) return;
      
      // Skip processing if we're in fallback mode and this is a real sensor reading
      if (fallbackHeadingModeRef.current && !isSimulated) {
        return;
      }

      const now = Date.now();

      // Throttle processing for performance
      if (now - lastProcessTimeRef.current < THROTTLE_INTERVAL) {
        return;
      }
      lastProcessTimeRef.current = now;

      // Increment reading counter
      readingsCountRef.current++;

      // Check if this is our first ever reading - good sign that sensors are working
      if (!initialHeadingSetRef.current) {
        initialHeadingSetRef.current = true;
        console.log("[DeviceOrientation] Initial heading received:", newHeading);
        
        // Clear any timeout for sensor initialization
        if (initialSensorCheckTimeoutRef.current) {
          clearTimeout(initialSensorCheckTimeoutRef.current);
          initialSensorCheckTimeoutRef.current = null;
        }
        
        // Clear any max wait timeout
        if (maxWaitTimeoutRef.current) {
          clearTimeout(maxWaitTimeoutRef.current);
          maxWaitTimeoutRef.current = null;
        }
      }

      // Never mark simulated readings as movement
      const hasMovement = isSimulated ? false : detectMovement(newHeading);

      // Calculate confidence of this reading
      const confidence = isSimulated ? 0.3 : calculateConfidence(newHeading);

      // Consider calibrated more easily
      if (
        (hasMovement || movementDetectedRef.current) &&
        !isCalibrated &&
        readingsCountRef.current >= MIN_READINGS_CALIBRATED
      ) {
        setIsCalibrated(true);
        console.log("[DeviceOrientation] Sensors calibrated!");
        if (calibrationTimeoutRef.current) {
          window.clearTimeout(calibrationTimeoutRef.current);
          calibrationTimeoutRef.current = null;
        }
      }

      // Add to recent readings list with timestamp and confidence
      headingHistoryRef.current.push({
        value: newHeading,
        timestamp: now,
        confidence,
      });

      // Keep history limited
      if (headingHistoryRef.current.length > MAX_HISTORY_SIZE) {
        headingHistoryRef.current.shift();
      }

      // Calculate filtered heading based on recent history
      // Simplified approach to reduce computation
      let filteredHeading = newHeading;
      
      if (headingHistoryRef.current.length >= 3) {
        if (movementDetectedRef.current) {
          // During movement, prioritize recent readings
          // Using only last 3 readings with weights 0.5, 0.3, 0.2
          const weights = [0.5, 0.3, 0.2];
          const recentValues = headingHistoryRef.current.slice(-3).map(item => {
            // Adjust for angle wrap (0/360)
            const diff = ((item.value - newHeading + 180) % 360) - 180;
            return newHeading + diff;
          });
          
          filteredHeading = recentValues.reduce((sum, value, index) => {
            return sum + value * weights[index];
          }, 0);
        } else {
          // Without movement, use more stable average
          const allValues = headingHistoryRef.current.map(item => {
            const diff = ((item.value - newHeading + 180) % 360) - 180;
            return newHeading + diff;
          });
          
          filteredHeading = allValues.reduce((a, b) => a + b, 0) / allValues.length;
        }
        
        // Normalize to 0-360
        filteredHeading = ((filteredHeading % 360) + 360) % 360;
      }

      // Log updates every 10 readings or when value changes significantly
      if (readingsCountRef.current % 10 === 0 || Math.abs((filteredHeading - (heading || 0))) > 5) {
        console.log(`[DeviceOrientation] Updating heading: ${filteredHeading.toFixed(1)}° (raw: ${newHeading.toFixed(1)}°, simulated: ${isSimulated})`);
      }

      // For debug mode, we store the value locally too
      setDebugHeading(filteredHeading);

      // Always update heading after minimum readings or when calibrated
      if (readingsCountRef.current > MIN_READINGS_CALIBRATED * 2 || isCalibrated) {
        // Update the heading in the store with filtered value
        setHeading(filteredHeading);
      }
    },
    [detectMovement, isCalibrated, setHeading, calculateConfidence, heading, generateFallbackHeading],
  );

  // Process absolute orientation events (more accurate)
  const handleAbsoluteOrientation = useCallback(
    (event: DeviceOrientationEvent) => {
      if (!isMountedRef.current) return;
      
      // Increment event counter
      eventsReceivedRef.current.absolute++;
      
      // Accept any value from different browser implementations
      let alphaValue = null;
      
      if (event.alpha !== null && event.alpha !== undefined) {
        alphaValue = event.alpha;
      } else if ((event as SafariDeviceOrientationEvent).webkitCompassHeading !== undefined) {
        // Safari on iOS provides webkitCompassHeading
        alphaValue = 360 - ((event as SafariDeviceOrientationEvent).webkitCompassHeading || 0);
      }
      
      if (alphaValue !== null) {
        processHeading(alphaValue);
      }
    },
    [processHeading],
  );

  // Improved handler for relative orientation with device position adjustments
  const handleRelativeOrientation = useCallback(
    (event: DeviceOrientationEvent) => {
      if (!isMountedRef.current) return;
      
      // Increment event counter
      eventsReceivedRef.current.relative++;
      
      // Handle different browser implementations
      let alphaValue = null;
      
      if (event.alpha !== null && event.alpha !== undefined) {
        alphaValue = event.alpha;
      } else if ((event as SafariDeviceOrientationEvent).webkitCompassHeading !== undefined) {
        // Safari on iOS provides webkitCompassHeading
        alphaValue = 360 - ((event as SafariDeviceOrientationEvent).webkitCompassHeading || 0);
      }
      
      if (alphaValue === null) {
        return;
      }

      let heading = alphaValue;
      const beta = event.beta; // front/back tilt (-180 to 180)
      const gamma = event.gamma; // left/right tilt (-90 to 90)

      try {
        if (beta !== null && gamma !== null) {
          // More precise adjustments for different device orientations
          const currentOrientation = deviceOrientationRef.current;

          // Simplified and robust orientation adjustments
          if (currentOrientation === 'portrait') {
            // Portrait mode
            // Check if device is upside down
            const isUpsideDown = beta < 0;

            if (isUpsideDown) {
              heading = (heading + 180) % 360;
            }
          } else if (currentOrientation === 'landscape') {
            // Landscape mode
            const isRightSide = gamma > 0;
            
            // Landscape adjustment
            heading = (heading + (isRightSide ? 90 : -90)) % 360;
          }
        }
      } catch (err) {
        console.warn('Error adjusting orientation:', err);
      }

      // Normalize to 0-360
      heading = ((heading % 360) + 360) % 360;

      // Process the adjusted heading
      processHeading(heading);
    },
    [processHeading],
  );

  // Added support for DeviceMotion as a fallback
  const handleDeviceMotion = useCallback((event: DeviceMotionEvent) => {
    if (!isMountedRef.current) return;
    
    // Increment event counter
    eventsReceivedRef.current.motion++;
    
    // Use as movement indicator, not for heading
    if (event.accelerationIncludingGravity) {
      // Mark movement to help with calibration
      movementDetectedRef.current = true;
    }
  }, []);

  // Function to handle when device has no orientation sensors
  const handleNoSensors = useCallback(() => {
    console.log('Device without orientation sensors or permission denied - using fallback mode');

    // Set error message but allow app to continue
    setErrorMessage("Compass não disponível - usando rotação simulada");
    
    // Enable fallback mode
    setUseFallbackHeading(true);
    fallbackHeadingModeRef.current = true;
    
    // Mark as "calibrated" to allow app flow to continue
    setIsCalibrated(true);
    
    // Set up periodic fallback heading updates
    const fallbackInterval = setInterval(() => {
      if (isMountedRef.current) {
        const simulatedHeading = generateFallbackHeading();
        processHeading(simulatedHeading, true);
      } else {
        clearInterval(fallbackInterval);
      }
    }, 100);
    
    // Clean up on unmount
    return () => clearInterval(fallbackInterval);
  }, [generateFallbackHeading, processHeading]);

  // Function to test if we have access to sensors
  const testSensorAccess = useCallback(async () => {
    return new Promise<boolean>((resolve) => {
      let hasReceivedEvent = false;
      let testTimer: number | null = null;
      
      const testHandler = () => {
        hasReceivedEvent = true;
        if (testTimer) {
          window.clearTimeout(testTimer);
        }
        window.removeEventListener('deviceorientation', testHandler);
        window.removeEventListener('deviceorientationabsolute', testHandler);
        resolve(true);
      };
      
      window.addEventListener('deviceorientation', testHandler, { once: true });
      window.addEventListener('deviceorientationabsolute', testHandler, { once: true });
      
      // 500ms timeout to check if we received any events
      testTimer = window.setTimeout(() => {
        window.removeEventListener('deviceorientation', testHandler);
        window.removeEventListener('deviceorientationabsolute', testHandler);
        resolve(hasReceivedEvent);
      }, 500);
    });
  }, []);

  // Enhanced function to add orientation event listeners
  const addOrientationListeners = useCallback(() => {
    if (eventListenerAddedRef.current) {
      console.log('[DeviceOrientation] Listeners already added, skipping.');
      return;
    }
    
    console.log('[DeviceOrientation] Adding event listeners...');
    
    // First try absolute orientation (more precise)
    window.addEventListener('deviceorientationabsolute', handleAbsoluteOrientation, { passive: true });
    
    // Also add relative orientation as fallback
    window.addEventListener('deviceorientation', handleRelativeOrientation, { passive: true });
    
    // Add motion for movement detection
    window.addEventListener('devicemotion', handleDeviceMotion, { passive: true });
    
    eventListenerAddedRef.current = true;
    console.log('[DeviceOrientation] All listeners added.');
  }, [handleAbsoluteOrientation, handleRelativeOrientation, handleDeviceMotion]);

  // Main function to initialize orientation sensors
  const initOrientationSensors = useCallback(async () => {
    // Avoid multiple permission requests
    if (permissionRequestedRef.current) return;
    permissionRequestedRef.current = true;

    try {
      // Reset state before initializing
      setIsCalibrated(false);
      setUseFallbackHeading(false);
      fallbackHeadingModeRef.current = false;
      readingsCountRef.current = 0;
      headingHistoryRef.current = [];
      lastHeadingRef.current = null;
      consecutiveStableReadingsRef.current = 0;
      movementDetectedRef.current = false;
      initialHeadingSetRef.current = false;
      sensorTimedOutRef.current = false;

      console.log('[DeviceOrientation] Initializing orientation sensors...');

      // Check if device supports orientation events
      const hasDeviceOrientation = 'DeviceOrientationEvent' in window;

      if (!hasDeviceOrientation) {
        console.warn('[DeviceOrientation] Device does not support orientation - using fallback');
        handleNoSensors();
        return;
      }

      // Set up calibration timeout
      // Using longer time to give user chance to move the device
      calibrationTimeoutRef.current = window.setTimeout(() => {
        if (
          !isCalibrated &&
          readingsCountRef.current > MIN_READINGS_CALIBRATED &&
          headingHistoryRef.current.length > 0
        ) {
          const now = Date.now();
          const oldestReading = headingHistoryRef.current[0].timestamp;

          // If enough time passed and still not calibrated
          if (now - oldestReading >= CALIBRATION_WINDOW) {
            console.log('[DeviceOrientation] Calibration time exceeded, continuing anyway.');
            setIsCalibrated(true); // Force calibration to continue app flow
          }
        }
      }, CALIBRATION_WINDOW);

      // Set up initial sensor check timeout
      initialSensorCheckTimeoutRef.current = window.setTimeout(() => {
        // If we haven't received any readings by now, sensors might be disabled
        if (!initialHeadingSetRef.current) {
          console.warn('[DeviceOrientation] No sensor readings received after timeout');
          
          // Don't switch to fallback yet, give more time
          console.log('[DeviceOrientation] Waiting longer before using fallback...');
        }
      }, INITIAL_SENSOR_CHECK_TIMEOUT);
      
      // Set maximum wait time before falling back
      maxWaitTimeoutRef.current = window.setTimeout(() => {
        // If we still don't have readings after max wait, use fallback
        if (!initialHeadingSetRef.current || headingHistoryRef.current.length < 3) {
          console.warn('[DeviceOrientation] Max wait time exceeded, switching to fallback mode');
          sensorTimedOutRef.current = true;
          handleNoSensors();
        }
      }, MAX_SENSOR_WAIT_TIME);

      let permissionGranted = true;

      // Special handling for iOS
      if (
        typeof DeviceOrientationEvent !== 'undefined' &&
        typeof (DeviceOrientationEvent as any).requestPermission === 'function'
      ) {
        try {
          console.log(
            '[DeviceOrientation] Requesting device orientation permission (iOS)',
          );
          
          // On iOS, we must explicitly request permission
          const permission = await (
            DeviceOrientationEvent as any
          ).requestPermission();
          
          setPermissionState(permission);

          if (permission !== 'granted') {
            console.warn('[DeviceOrientation] Sensor permission denied:', permission);
            permissionGranted = false;
            handleNoSensors();
            return;
          }
          
          console.log('[DeviceOrientation] Permission granted on iOS');
        } catch (err) {
          console.error('[DeviceOrientation] Error requesting sensor permission:', err);
          
          // Try adding listeners anyway
          // Sometimes error occurs because we already have permission
          console.log('[DeviceOrientation] Trying to add listeners anyway...');
          addOrientationListeners();
          
          // Test if we're receiving events despite the error
          const hasAccess = await testSensorAccess();
          
          if (!hasAccess) {
            permissionGranted = false;
            handleNoSensors();
            return;
          }
        }
      }

      if (permissionGranted) {
        // Use dedicated function to add listeners
        addOrientationListeners();

        // Also try DeviceMotion for iOS
        try {
          if (
            'DeviceMotionEvent' in window &&
            typeof (DeviceMotionEvent as any).requestPermission === 'function'
          ) {
            await (DeviceMotionEvent as any).requestPermission();
            // DeviceMotion already added in addOrientationListeners
          }
        } catch (err) {
          // Ignore DeviceMotion errors as it's not essential
          console.warn('[DeviceOrientation] DeviceMotion not available:', err);
        }
      }
      
      // Check if events are arriving after 1 second
      setTimeout(async () => {
        const eventCounts = eventsReceivedRef.current;
        
        if (eventCounts.absolute === 0 && eventCounts.relative === 0) {
          console.warn('[DeviceOrientation] No events received after initialization!');
          
          // Try alternative approach
          window.removeEventListener('deviceorientationabsolute', handleAbsoluteOrientation);
          window.removeEventListener('deviceorientation', handleRelativeOrientation);
          
          console.log('[DeviceOrientation] Trying direct \'on\' events...');
          
          // Try adding with 'on' events which might work in some browsers
          if ('ondeviceorientationabsolute' in window) {
            console.log('[DeviceOrientation] Using ondeviceorientationabsolute');
            (window as any).ondeviceorientationabsolute = handleAbsoluteOrientation;
          }
          
          if ('ondeviceorientation' in window) {
            console.log('[DeviceOrientation] Using ondeviceorientation');
            (window as any).ondeviceorientation = handleRelativeOrientation;
          }
          
          // If still no events after another second, use fallback
          setTimeout(() => {
            if (eventsReceivedRef.current.absolute === 0 && 
                eventsReceivedRef.current.relative === 0) {
              console.error('[DeviceOrientation] Sensors not responding!');
              handleNoSensors();
            }
          }, 1000);
        }
      }, 1000);
    } catch (error) {
      console.error('[DeviceOrientation] Error initializing orientation sensors:', error);
      handleNoSensors();
    }
  }, [
    handleAbsoluteOrientation,
    handleRelativeOrientation,
    handleDeviceMotion,
    isCalibrated,
    handleNoSensors,
    addOrientationListeners,
    testSensorAccess,
  ]);

  // Main effect to set up orientation tracking
  useEffect(() => {
    isMountedRef.current = true;

    // Slight delay for initialization to ensure UI is ready
    setTimeout(() => {
      initOrientationSensors();
    }, 500);

    // Cleanup function
    return () => {
      isMountedRef.current = false;

      if (calibrationTimeoutRef.current) {
        window.clearTimeout(calibrationTimeoutRef.current);
      }
      
      if (initialSensorCheckTimeoutRef.current) {
        window.clearTimeout(initialSensorCheckTimeoutRef.current);
      }
      
      if (maxWaitTimeoutRef.current) {
        window.clearTimeout(maxWaitTimeoutRef.current);
      }

      // More robust cleanup of all event listeners
      window.removeEventListener(
        'deviceorientationabsolute',
        handleAbsoluteOrientation,
      );
      window.removeEventListener(
        'deviceorientation',
        handleRelativeOrientation,
      );
      window.removeEventListener(
        'devicemotion',
        handleDeviceMotion,
      );
      
      // Clean up 'on' events too
      if ('ondeviceorientationabsolute' in window) {
        (window as any).ondeviceorientationabsolute = null;
      }
      if ('ondeviceorientation' in window) {
        (window as any).ondeviceorientation = null;
      }
      
      console.log('[DeviceOrientation] Hook cleaned up and event listeners removed.');
    };
  }, [
    handleAbsoluteOrientation,
    handleRelativeOrientation,
    handleDeviceMotion,
    initOrientationSensors,
  ]);

  // Return the debug heading if we're in debug mode
  const effectiveHeading = useFallbackHeading ? 
    fallbackHeadingRef.current : (debugHeading !== null ? debugHeading : heading);

  return { 
    heading: effectiveHeading, 
    permissionState, 
    errorMessage, 
    isCalibrated,
    useFallbackHeading
  };
};