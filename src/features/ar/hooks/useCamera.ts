// Path: features\ar\hooks\useCamera.ts
import { useState, useEffect, useRef, useCallback } from 'react';
import { useCameraStore } from '../stores/cameraStore';

interface UseCameraProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
}

/**
 * Enhanced camera hook with improved initialization, error handling and cleanup
 */
export const useCamera = ({ videoRef }: UseCameraProps) => {
  // Get store methods but don't depend on their values for rerenders
  const { setActive, setPermission, setError } = useCameraStore();

  // Local state to track what's happening
  const [isActive, setLocalActive] = useState(false);
  const [hasPermission, setLocalPermission] = useState<boolean | null>(null);
  const [error, setLocalError] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Refs to track internal state without triggering rerenders
  const streamRef = useRef<MediaStream | null>(null);
  const hasAttemptedRef = useRef(false);
  const isInitializingRef = useRef(false);
  const videoAttachedRef = useRef(false);
  const cameraTimeoutRef = useRef<number | null>(null);

  /**
   * Logs both to console and maintains a log history for in-app display
   */
  const logEvent = useCallback(
    (message: string, type: 'info' | 'error' | 'warn' = 'info') => {
      const timestamp = new Date().toISOString().split('T')[1].slice(0, 8);
      const logEntry = `[${timestamp}] ${message}`;

      switch (type) {
        case 'error':
          console.error(logEntry);
          break;
        case 'warn':
          console.warn(logEntry);
          break;
        default:
          console.log(logEntry);
      }

      // We'll add these logs to the debug UI later
      return logEntry;
    },
    [],
  );

  /**
   * Safely and thoroughly cleans up a video stream
   */
  const cleanupStream = useCallback(() => {
    logEvent('Cleaning up camera stream');

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        try {
          track.stop();
          logEvent(`Stopped track: ${track.kind}`);
        } catch (err) {
          // Silent cleanup
        }
      });
      streamRef.current = null;
    }

    // Also clean video element
    if (videoRef.current) {
      try {
        videoRef.current.srcObject = null;
        videoRef.current.onloadedmetadata = null;
        videoRef.current.onloadeddata = null;
        videoRef.current.onerror = null;
        logEvent('Cleaned video element');
      } catch (err) {
        logEvent(`Error cleaning video element: ${err}`, 'error');
      }
    }

    // Clear any pending timeout
    if (cameraTimeoutRef.current) {
      clearTimeout(cameraTimeoutRef.current);
      cameraTimeoutRef.current = null;
    }

    videoAttachedRef.current = false;
  }, [logEvent, videoRef]);

  /**
   * Updates both local and global state
   */
  const updateCameraState = useCallback(
    (
      isActive: boolean,
      hasPermission: boolean | null,
      errorMessage: string | null,
    ) => {
      // Update local state
      setLocalActive(isActive);
      setLocalPermission(hasPermission);
      setLocalError(errorMessage);

      // Update global state
      setActive(isActive);
      if (hasPermission !== null) setPermission(hasPermission);
      setError(errorMessage);

      logEvent(
        `Camera state updated: active=${isActive}, permission=${hasPermission}, error=${errorMessage || 'none'}`,
      );
    },
    [logEvent, setActive, setError, setPermission],
  );

  /**
   * Attaches stream to video element with enhanced reliability
   */
  const attachStream = useCallback(
    (stream: MediaStream): boolean => {
      if (!videoRef.current) {
        logEvent('No video element available', 'error');
        return false;
      }

      try {
        // Clean up any existing event listeners first to prevent duplicates
        videoRef.current.onloadedmetadata = null;
        videoRef.current.onloadeddata = null;
        videoRef.current.onerror = null;

        // Store the stream
        streamRef.current = stream;

        // Directly set stream
        videoRef.current.srcObject = stream;
        videoAttachedRef.current = true;
        logEvent('Stream attached to video element');

        // Handle video loaded event
        const handleVideoReady = () => {
          if (!videoRef.current) return;

          try {
            videoRef.current
              .play()
              .then(() => {
                logEvent('✅ Camera playing successfully');
                updateCameraState(true, true, null);
              })
              .catch(err => {
                logEvent(`⚠️ Video play error: ${err.name}`, 'warn');

                // Mobile browsers often block autoplay - in AR contexts
                // most browsers make an exception, but we'll handle it just in case
                if (err.name === 'NotAllowedError') {
                  logEvent(
                    '⚠️ Autoplay blocked - using manual play workaround',
                    'warn',
                  );

                  // For AR use cases, we'll still consider camera active and
                  // let user tap to interact if needed
                  updateCameraState(true, true, null);
                } else {
                  updateCameraState(
                    false,
                    true,
                    `Camera playback error: ${err.name}`,
                  );
                }
              });
          } catch (err) {
            logEvent(`⚠️ General video error: ${err}`, 'error');
            updateCameraState(false, true, 'Camera playback failed');
          }
        };

        // Set up multiple event handlers to increase chances of successful initialization
        videoRef.current.onloadedmetadata = handleVideoReady;
        videoRef.current.onloadeddata = handleVideoReady;

        // Handle video errors
        videoRef.current.onerror = event => {
          logEvent(`⚠️ Video element error: ${event}`, 'error');
          updateCameraState(false, true, 'Video element error');
        };

        return true;
      } catch (err) {
        logEvent(`⚠️ Error attaching stream: ${err}`, 'error');
        updateCameraState(false, true, 'Failed to display camera feed');
        return false;
      }
    },
    [logEvent, updateCameraState, videoRef],
  );

  /**
   * Main camera initialization function
   * Completely redesigned with better fallbacks and error detection
   */
  const startCamera = useCallback(async () => {
    // Prevent concurrent initialization
    if (isInitializingRef.current) {
      logEvent('Camera initialization already in progress, skipping');
      return;
    }

    // Don't retry if already active
    if (isActive) {
      logEvent('📷 Camera already active, skipping start');
      return;
    }

    isInitializingRef.current = true;
    hasAttemptedRef.current = true;
    logEvent('📷 Starting camera...');
    setIsTransitioning(true);

    try {
      // Cleanup any existing stream
      cleanupStream();

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API not supported in this browser');
      }

      // Simple camera constraints - trying to keep it simple for better compatibility
      const constraints: MediaStreamConstraints = {
        video: { facingMode: 'environment' },
        audio: false,
      };

      // Request camera stream
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      logEvent('✅ Camera stream obtained');

      // Check for video tracks
      if (stream.getVideoTracks().length === 0) {
        throw new Error('No video tracks in camera stream');
      }

      // Update permission state
      updateCameraState(isActive, true, null);

      // Attach to video element
      if (attachStream(stream)) {
        logEvent('✅ Stream attached to video element');

        // Set a fallback timer to force camera active if events don't fire
        cameraTimeoutRef.current = window.setTimeout(() => {
          if (!isActive) {
            logEvent(
              '⚠️ Fallback: Forcing camera active after timeout',
              'warn',
            );
            updateCameraState(true, true, null);
          }
        }, 2000);
      } else {
        logEvent('⚠️ Failed to attach stream to video element', 'error');
        updateCameraState(false, true, 'Failed to initialize video display');
        throw new Error('Failed to attach stream');
      }
    } catch (err) {
      logEvent(`⚠️ Camera error: ${err}`, 'error');

      // Handle specific error types
      if (err instanceof Error) {
        if (
          err.name === 'NotAllowedError' ||
          err.name === 'PermissionDeniedError'
        ) {
          logEvent('❌ Camera permission denied', 'error');
          updateCameraState(
            false,
            false,
            'Camera access denied. Please check browser permissions.',
          );
        } else if (
          err.name === 'NotFoundError' ||
          err.name === 'DevicesNotFoundError'
        ) {
          updateCameraState(false, true, 'No camera found on this device');
        } else if (
          err.name === 'NotReadableError' ||
          err.name === 'TrackStartError'
        ) {
          updateCameraState(
            false,
            true,
            'Camera is in use by another application',
          );
        } else if (err.name === 'OverconstrainedError') {
          updateCameraState(
            false,
            true,
            'Camera cannot satisfy the requested constraints',
          );
        } else {
          updateCameraState(
            false,
            hasPermission,
            `Camera error: ${err.message || err.name || 'Unknown error'}`,
          );
        }
      } else {
        updateCameraState(false, hasPermission, 'Unknown camera error');
      }
    } finally {
      setIsTransitioning(false);
      isInitializingRef.current = false;

      // Critically important: if video element has a stream but we didn't activate,
      // force set active state to true after a delay
      cameraTimeoutRef.current = window.setTimeout(() => {
        if (
          videoRef.current?.srcObject &&
          !isActive &&
          videoAttachedRef.current
        ) {
          logEvent(
            '⚠️ Stream detected but camera not active - forcing active state',
            'warn',
          );
          updateCameraState(true, true, null);
        }
      }, 1000);
    }
  }, [
    attachStream,
    cleanupStream,
    hasPermission,
    isActive,
    logEvent,
    updateCameraState,
    videoRef,
  ]);

  /**
   * Stops the camera
   */
  const stopCamera = useCallback(() => {
    logEvent('📷 Stopping camera');
    cleanupStream();
    updateCameraState(false, hasPermission, null);
  }, [cleanupStream, hasPermission, logEvent, updateCameraState]);

  /**
   * Requests camera permission with better error handling
   */
  const requestCameraPermission = useCallback(async () => {
    logEvent('📷 Requesting camera permission');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });

      logEvent('✅ Camera permission granted');
      updateCameraState(false, true, null);

      // Store and attach the stream
      streamRef.current = stream;
      attachStream(stream);
    } catch (err) {
      logEvent(`❌ Error requesting camera permission: ${err}`, 'error');

      if (err instanceof Error && err.name === 'NotAllowedError') {
        updateCameraState(false, false, 'Camera permission denied');
      } else {
        updateCameraState(false, false, 'Error accessing camera');
      }
    }
  }, [attachStream, logEvent, updateCameraState]);

  // Handle orientation changes
  useEffect(() => {
    const handleOrientationChange = () => {
      // Only restart if already active
      if (isActive) {
        logEvent('📱 Orientation changed, restarting camera');
        stopCamera();

        // Brief delay to allow cleanup
        setTimeout(() => {
          startCamera();
        }, 500);
      }
    };

    window.addEventListener('orientationchange', handleOrientationChange);

    return () => {
      window.removeEventListener('orientationchange', handleOrientationChange);
    };
  }, [isActive, logEvent, startCamera, stopCamera]);

  // Check permissions on mount and auto-start camera if granted
  useEffect(() => {
    const checkPermissions = async () => {
      // Only run this once
      if (hasAttemptedRef.current) return;

      try {
        // Try to use Permissions API if available
        if (navigator.permissions && navigator.permissions.query) {
          try {
            const result = await navigator.permissions.query({
              name: 'camera' as PermissionName,
            });

            if (result.state === 'granted') {
              logEvent('✅ Camera permission already granted');
              updateCameraState(false, true, null);
              startCamera();
            } else if (result.state === 'denied') {
              logEvent('❌ Camera permission denied');
              updateCameraState(false, false, null);
            } else {
              logEvent(`⚠️ Camera permission status: ${result.state}`);
              // For 'prompt' state, wait for user to request
            }
            return;
          } catch (err) {
            logEvent(
              '⚠️ Permissions API error, falling back to direct access',
              'warn',
            );
          }
        }

        // If Permissions API fails or isn't available, try direct access
        // This will either get a stream (permission granted) or throw (denied/prompt)
        logEvent('📷 Trying direct camera access');
        startCamera();
      } catch (err) {
        logEvent(`❌ Permission check error: ${err}`, 'error');
      }
    };

    // Run permission check
    checkPermissions();

    // Cleanup on unmount
    return () => {
      stopCamera();
    };
  }, [logEvent, startCamera, stopCamera, updateCameraState]);

  return {
    startCamera,
    stopCamera,
    requestCameraPermission,
    isActive,
    hasPermission,
    error,
    isTransitioning,
    logEvent,
  };
};
