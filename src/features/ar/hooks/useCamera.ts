// Path: features\ar\hooks\useCamera.ts
import { useEffect, useRef, useState, useCallback } from 'react';
import { useCameraStore } from '../stores/cameraStore';

// Improved configuration constants
const ORIENTATION_DEBOUNCE = 500; // ms for orientation debounce
const CAMERA_RESTART_DELAY = 300; // ms wait before restarting
const CAMERA_INIT_RETRY_MAX = 5; // Increased from 3 to 5
const CAMERA_INIT_RETRY_DELAY_BASE = 1000; // Base ms between init attempts
const VIDEO_CHECK_INTERVAL = 50; // More frequent checks for video element

/**
 * Enhanced camera hook with improved initialization and error recovery
 */
export const useCamera = (
  videoRef: React.RefObject<HTMLVideoElement | null>,
) => {
  const { isActive, hasPermission, error, setActive, setPermission, setError } =
    useCameraStore();
  const streamRef = useRef<MediaStream | null>(null);
  const [lastOrientation, setLastOrientation] = useState<string | null>(null);
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const permissionCheckedRef = useRef(false);
  const initAttemptsRef = useRef(0);
  const videoElementCheckIntervalRef = useRef<number | null>(null);
  const streamAttachmentAttempted = useRef(false);

  // Using useRef for timer variables
  const debounceTimerRef = useRef<number | null>(null);
  const restartTimerRef = useRef<number | null>(null);
  const retryTimerRef = useRef<number | null>(null);
  const permissionCheckTimerRef = useRef<number | null>(null);

  /**
   * Safely cleans up a video stream
   */
  const cleanupStream = useCallback((stream?: MediaStream | null) => {
    const streamToClean = stream || streamRef.current;
    if (streamToClean) {
      streamToClean.getTracks().forEach(track => {
        try {
          track.stop();
        } catch (err) {
          console.warn('Error stopping video track:', err);
        }
      });
    }
  }, []);

  /**
   * Checks if orientation has significantly changed
   */
  const hasOrientationChanged = useCallback((): boolean => {
    const isLandscape = window.innerWidth > window.innerHeight;
    const currentOrientation = isLandscape ? 'landscape' : 'portrait';

    if (!lastOrientation) {
      setLastOrientation(currentOrientation);
      return true;
    }

    const changed = lastOrientation !== currentOrientation;
    if (changed) {
      setLastOrientation(currentOrientation);
    }

    return changed;
  }, [lastOrientation]);

  /**
   * Enhanced function to attach an existing stream to the video element
   * with improved error handling and retry logic
   */
  const attachExistingStream = useCallback(() => {
    // Improved logging
    console.log('Attempting to attach stream to video element...');
    streamAttachmentAttempted.current = true;

    // If we don't have a stream, return false
    if (!streamRef.current) {
      console.warn('No stream available to attach');
      return false;
    }

    // If we don't have a video element yet, schedule a retry
    if (!videoRef.current) {
      console.log('Video element not available, will retry shortly');

      // Clear any existing interval
      if (videoElementCheckIntervalRef.current !== null) {
        clearInterval(videoElementCheckIntervalRef.current);
      }

      // Set up a more frequent check for the video element
      videoElementCheckIntervalRef.current = window.setInterval(() => {
        if (videoRef.current) {
          console.log('Video element now available, attaching stream...');
          const success = attachExistingStream();

          if (success) {
            clearInterval(videoElementCheckIntervalRef.current!);
            videoElementCheckIntervalRef.current = null;
            setActive(true);
          }
        }
      }, VIDEO_CHECK_INTERVAL);

      return false;
    }

    try {
      // Check if the stream is already attached
      const currentStream = videoRef.current.srcObject as MediaStream | null;

      // If the stream is already attached and is the same, return true
      if (currentStream === streamRef.current) {
        console.log('Stream already attached to video element');
        return true;
      }

      // Attach the stream to the video element
      videoRef.current.srcObject = streamRef.current;
      console.log('Stream attached to video element');

      // Configure events
      videoRef.current.onloadedmetadata = () => {
        if (videoRef.current) {
          videoRef.current.play().catch(e => {
            console.warn('Error starting automatic playback:', e);
            // Try again after a short delay
            setTimeout(() => {
              videoRef.current?.play().catch(e2 => {
                console.error('Second playback attempt failed:', e2);
              });
            }, 500);
          });
        }
      };

      // Add error handler
      videoRef.current.onerror = event => {
        console.error('Video element error:', event);
        // Try to recover by reattaching the stream
        setTimeout(() => attachExistingStream(), 1000);
      };

      return true;
    } catch (err) {
      console.error('Error attaching stream to video element:', err);

      // Try to recover by retrying once after a short delay
      setTimeout(() => {
        console.log('Retrying stream attachment after error...');
        try {
          if (videoRef.current && streamRef.current) {
            videoRef.current.srcObject = streamRef.current;
            return true;
          }
        } catch (retryErr) {
          console.error('Stream attachment retry failed:', retryErr);
        }
      }, 1000);

      return false;
    }
  }, [videoRef, setActive]);

  /**
   * Checks if we already have camera permission
   */
  const checkExistingPermission = useCallback(async () => {
    if (permissionCheckedRef.current) return;

    try {
      console.log('Checking existing camera permissions...');

      // Try using the Permissions API first
      if (navigator.permissions && navigator.permissions.query) {
        try {
          const result = await navigator.permissions.query({
            name: 'camera' as PermissionName,
          });

          if (result.state === 'granted') {
            console.log('Camera permission already granted by browser');
            setPermission(true);
            setError(null);
            permissionCheckedRef.current = true;
            return true;
          } else if (result.state === 'denied') {
            console.log('Camera permission denied by browser');
            setPermission(false);
            setError('Camera permission denied by browser');
            permissionCheckedRef.current = true;
            return false;
          }

          console.log('Permission state:', result.state);
        } catch (err) {
          console.warn('Unable to check permissions via API:', err);
        }
      }

      // Alternative method: try to get a stream quickly and discard it
      const constraints = {
        video: {
          facingMode: 'environment',
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      if (stream) {
        console.log('Permission verified successfully via getUserMedia');

        // Instead of discarding this test stream, let's use it!
        streamRef.current = stream;

        // Attempt to attach the stream right away
        attachExistingStream();

        setPermission(true);
        setError(null);
        permissionCheckedRef.current = true;
        return true;
      }
    } catch (err) {
      // Handle NotAllowedError as explicit permission denial
      if (err instanceof Error && err.name === 'NotAllowedError') {
        console.log('Camera permission explicitly denied');
        setPermission(false);
        setError('Camera access denied. Check browser permissions.');
        permissionCheckedRef.current = true;
        return false;
      }

      console.log('Existing permission check failed:', err);
      return null;
    }

    // If we get here, the check was inconclusive
    return null;
  }, [setError, setPermission, attachExistingStream]);

  // Declare startCamera here, but assign later due to circular reference
  let startCamera: () => Promise<void>;

  /**
   * Improved function that directly requests camera permission
   */
  const requestCameraPermission = useCallback(async () => {
    // Reset initialization attempts when explicitly requesting permission
    initAttemptsRef.current = 0;

    // First, check if we already have permission
    const hasExistingPermission = await checkExistingPermission();

    // If we already have confirmed permission, no need to request again
    if (hasExistingPermission === true) {
      console.log('Permission already granted, starting camera');
      // Here we use the startCamera variable that will be assigned later
      if (startCamera) {
        startCamera();
      } else {
        console.warn('startCamera not yet available');
        // Fallback: Create a timeout to start camera once it's available
        setTimeout(() => {
          if (startCamera) startCamera();
        }, 100);
      }
      return;
    }

    // If permission is explicitly denied, don't try again
    if (hasExistingPermission === false) {
      console.log('Permission already denied, not requesting again');
      return;
    }

    console.log('Explicitly requesting camera permission');

    try {
      // Request camera access with minimal parameters
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });

      // If we get here, we have permission
      console.log('Camera permission granted');

      // Save this stream for use
      streamRef.current = stream;

      // Mark as permitted
      setPermission(true);
      setError(null);
      permissionCheckedRef.current = true;

      // Try to attach the stream to the video element
      attachExistingStream();
      setActive(true);

      // Also try to start the camera normally
      if (startCamera) {
        startCamera();
      } else {
        console.warn('startCamera not yet available');
        // Fallback: Create a timeout to start camera once it's available
        setTimeout(() => {
          if (startCamera) startCamera();
        }, 100);
      }
    } catch (err) {
      console.error('Error requesting camera permission:', err);

      // Check the specific error type
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError') {
          setPermission(false);
          setError('Camera access denied by user');
        } else if (err.name === 'NotFoundError') {
          setPermission(false);
          setError('No camera found on device');
        } else {
          setPermission(false);
          setError(err.message || 'Error accessing camera');
        }
      } else {
        setPermission(false);
        setError('Unknown error accessing camera');
      }

      permissionCheckedRef.current = true;
    }
  }, [
    attachExistingStream,
    checkExistingPermission,
    setActive,
    setError,
    setPermission,
  ]);

  /**
   * Enhanced function to start the camera with improved error handling and retry logic
   */
  startCamera = useCallback(async () => {
    // Clear any pending retry timer
    if (retryTimerRef.current) {
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }

    // If we already have a stream, try to attach it first
    if (streamRef.current) {
      console.log('Existing stream found, attempting to use it...');
      const attached = attachExistingStream();
      if (attached) {
        setActive(true);
        console.log('Camera started with existing stream');
        return;
      }
    }

    try {
      // Prevent multiple simultaneous initializations
      if (isAdjusting) {
        console.log('Camera adjustment already in progress, skipping');
        return;
      }
      setIsAdjusting(true);

      // Check if API is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API not supported in this browser');
      }

      // If the video element isn't available, set up periodic checks and continue anyway
      if (!videoRef.current) {
        console.log(
          'Video element not available, continuing anyway with periodic checks',
        );

        if (videoElementCheckIntervalRef.current === null) {
          videoElementCheckIntervalRef.current = window.setInterval(() => {
            if (videoRef.current && streamRef.current) {
              console.log('Video element now available, attaching stream');
              clearInterval(videoElementCheckIntervalRef.current!);
              videoElementCheckIntervalRef.current = null;
              attachExistingStream();
              setActive(true);
            }
          }, VIDEO_CHECK_INTERVAL);
        }

        // IMPORTANT: We continue with initialization even without the video element
        // This is a change from the original code which returned early
      }

      // Get current dimensions to determine ideal ratio
      const isLandscape = window.innerWidth > window.innerHeight;
      const currentOrientation = isLandscape ? 'landscape' : 'portrait';

      // Update current orientation
      setLastOrientation(currentOrientation);

      // Clean up previous stream safely
      cleanupStream();

      // Determine ideal constraints based on device and orientation
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: 'environment', // Use back camera
          width: {
            min: 640,
            ideal: isLandscape ? 1280 : 720,
            max: 1920,
          },
          height: {
            min: 480,
            ideal: isLandscape ? 720 : 1280,
            max: 1080,
          },
          aspectRatio: isLandscape ? 16 / 9 : 9 / 16,
          frameRate: { ideal: 30, max: 60 },
        } as MediaTrackConstraints,
        audio: false,
      };

      console.log(`Starting camera with orientation: ${currentOrientation}`);
      console.log(`Initialization attempt: ${initAttemptsRef.current + 1}`);

      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      // Save the stream reference first
      streamRef.current = stream;

      // Try to attach the stream, but don't block on it
      attachExistingStream();

      // Update states regardless of attachment success - we got the stream!
      setPermission(true);
      setActive(true);
      setError(null);
      initAttemptsRef.current = 0; // Reset attempts after success

      console.log('Camera initialized successfully');

      // Even if everything went well, set isTransitioning to false
      // after a short delay to ensure the transition is smooth
      setTimeout(() => {
        setIsTransitioning(false);
      }, 150);
    } catch (err) {
      console.error('Error accessing camera:', err);

      const errorMessage =
        err instanceof Error ? err.message : 'Unknown error accessing camera';

      setError(errorMessage);

      // Don't change permission state here unless the error is specific
      if (err instanceof Error && err.name === 'NotAllowedError') {
        setPermission(false);
      }

      // Increment attempt counter
      initAttemptsRef.current++;

      // If we haven't exceeded the maximum number of attempts, try again with exponential backoff
      if (initAttemptsRef.current < CAMERA_INIT_RETRY_MAX) {
        const delay =
          CAMERA_INIT_RETRY_DELAY_BASE *
          Math.pow(1.5, initAttemptsRef.current - 1);
        console.log(
          `Retrying in ${delay}ms (attempt ${initAttemptsRef.current + 1}/${CAMERA_INIT_RETRY_MAX})...`,
        );

        retryTimerRef.current = window.setTimeout(() => {
          console.log(`Starting attempt ${initAttemptsRef.current + 1}`);
          setIsAdjusting(false);
          startCamera();
        }, delay);
      } else {
        console.error(
          `Exceeded maximum number of attempts (${CAMERA_INIT_RETRY_MAX})`,
        );
      }

      setIsTransitioning(false);
    } finally {
      // Ensure isAdjusting is reset after a short delay
      setTimeout(() => {
        setIsAdjusting(false);
      }, 100);
    }
  }, [
    attachExistingStream,
    cleanupStream,
    isAdjusting,
    setActive,
    setError,
    setPermission,
    videoRef,
  ]);

  /**
   * Stops camera streaming and cleans up resources
   */
  const stopCamera = useCallback(() => {
    // Clear pending timers
    if (debounceTimerRef.current) {
      window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    if (restartTimerRef.current) {
      window.clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }

    if (retryTimerRef.current) {
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }

    if (permissionCheckTimerRef.current) {
      window.clearTimeout(permissionCheckTimerRef.current);
      permissionCheckTimerRef.current = null;
    }

    if (videoElementCheckIntervalRef.current) {
      window.clearInterval(videoElementCheckIntervalRef.current);
      videoElementCheckIntervalRef.current = null;
    }

    cleanupStream();

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    streamRef.current = null;
    setActive(false);

    console.log('Camera stopped and resources cleaned up');
  }, [cleanupStream, setActive, videoRef]);

  /**
   * Handles orientation changes with debouncing
   */
  const handleOrientationChange = useCallback(() => {
    // Clear previous debounce timer, if it exists
    if (debounceTimerRef.current) {
      window.clearTimeout(debounceTimerRef.current);
    }

    // Use a dedicated function to check for real orientation change
    if (!hasOrientationChanged() || isAdjusting) {
      return;
    }

    // Start visual transition before restarting the camera
    setIsTransitioning(true);

    // Implement debounce to avoid multiple reinitializations
    // during device rotation
    debounceTimerRef.current = window.setTimeout(() => {
      // Only stop the camera if there was actually a change
      stopCamera();

      // Short delay before restarting for stability
      restartTimerRef.current = window.setTimeout(() => {
        startCamera();
      }, CAMERA_RESTART_DELAY);
    }, ORIENTATION_DEBOUNCE);
  }, [hasOrientationChanged, isAdjusting, startCamera, stopCamera]);

  // Watch for orientation changes
  useEffect(() => {
    window.addEventListener('resize', handleOrientationChange);
    window.addEventListener('orientationchange', handleOrientationChange);

    return () => {
      window.removeEventListener('resize', handleOrientationChange);
      window.removeEventListener('orientationchange', handleOrientationChange);

      // Clear pending timers
      if (debounceTimerRef.current) {
        window.clearTimeout(debounceTimerRef.current);
      }

      if (restartTimerRef.current) {
        window.clearTimeout(restartTimerRef.current);
      }

      if (retryTimerRef.current) {
        window.clearTimeout(retryTimerRef.current);
      }

      if (permissionCheckTimerRef.current) {
        window.clearTimeout(permissionCheckTimerRef.current);
      }

      if (videoElementCheckIntervalRef.current) {
        window.clearInterval(videoElementCheckIntervalRef.current);
      }

      stopCamera();
    };
  }, [handleOrientationChange, stopCamera]);

  // Check existing permissions on mount
  useEffect(() => {
    // Short delay to ensure the UI is ready
    permissionCheckTimerRef.current = window.setTimeout(() => {
      checkExistingPermission().then(hasPermission => {
        // If we already have permission, start the camera directly
        if (hasPermission === true) {
          startCamera();
        }
        // If the check was inconclusive, try to request permission explicitly
        else if (hasPermission === null) {
          requestCameraPermission();
        }
      });
    }, 300); // Reduced from 500ms to 300ms for faster startup

    return () => {
      if (permissionCheckTimerRef.current) {
        window.clearTimeout(permissionCheckTimerRef.current);
        permissionCheckTimerRef.current = null;
      }
    };
  }, [checkExistingPermission, requestCameraPermission, startCamera]);

  // Try to attach the existing stream when the video element is rendered
  useEffect(() => {
    // If we have a stream but not a video element, set up periodic checks
    if (
      streamRef.current &&
      !videoRef.current &&
      !videoElementCheckIntervalRef.current
    ) {
      videoElementCheckIntervalRef.current = window.setInterval(() => {
        if (videoRef.current) {
          const success = attachExistingStream();
          if (success) {
            setActive(true);
            clearInterval(videoElementCheckIntervalRef.current!);
            videoElementCheckIntervalRef.current = null;
          }
        }
      }, VIDEO_CHECK_INTERVAL);
    }

    return () => {
      if (videoElementCheckIntervalRef.current) {
        clearInterval(videoElementCheckIntervalRef.current);
        videoElementCheckIntervalRef.current = null;
      }
    };
  }, [attachExistingStream, setActive, videoRef]);

  // Extra check for camera status - retry if not active after a delay
  useEffect(() => {
    // If we have permission but camera isn't active after 2 seconds, try again
    if (
      hasPermission === true &&
      !isActive &&
      streamAttachmentAttempted.current
    ) {
      const retryTimer = setTimeout(() => {
        console.log(
          'Camera not active despite having permission - attempting restart',
        );
        startCamera();
      }, 2000);

      return () => clearTimeout(retryTimer);
    }
  }, [hasPermission, isActive, startCamera]);

  return {
    startCamera,
    stopCamera,
    requestCameraPermission,
    isActive,
    hasPermission,
    error,
    isAdjusting,
    isTransitioning,
  };
};
