// Path: features/ar/hooks/useCamera.ts
import { useState, useEffect, useRef, useCallback } from 'react';
import { useCameraStore } from '../stores/cameraStore';

interface UseCameraProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
}

/**
 * Improved camera hook with more reliable startup
 */
export const useCamera = ({ videoRef }: UseCameraProps) => {
  const { isActive, hasPermission, error, setActive, setPermission, setError } = useCameraStore();
  const streamRef = useRef<MediaStream | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const startupTimeoutRef = useRef<number | null>(null);
  const attemptCountRef = useRef(0);

  /**
   * Safely cleans up a video stream
   */
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
  }, []);

  /**
   * Attaches an existing stream to the video element with improved reliability
   */
  const attachStream = useCallback((stream: MediaStream) => {
    if (!videoRef.current) return false;

    try {
      // Set source object
      videoRef.current.srcObject = stream;
      
      // Setup event handlers
      const handleLoaded = () => {
        if (!videoRef.current) return;
        
        // Attempt to play video
        const playPromise = videoRef.current.play();
        
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              // Video is playing successfully
              console.log('Camera stream playing successfully');
              setActive(true);
            })
            .catch(playError => {
              console.error('Error playing video:', playError);
              setError('Error playing video: Please try again');
              
              // Even if play fails, we'll still consider camera attached
              // Many browsers block autoplay but the stream is still attached
              setActive(true);
            });
        } else {
          // Play returned undefined (older browsers)
          // Consider the camera active anyway
          setActive(true);
        }
      };
      
      // Add event listener for loadedmetadata
      videoRef.current.addEventListener('loadedmetadata', handleLoaded);
      
      // Add another event as fallback
      videoRef.current.addEventListener('loadeddata', handleLoaded);
      
      // Set up a timeout as a fallback - if metadata event doesn't fire
      // after 2 seconds, consider camera active anyway
      setTimeout(() => {
        if (!isActive) {
          console.log('Forcing camera active after timeout');
          setActive(true);
        }
      }, 2000);
      
      return true;
    } catch (err) {
      console.error('Error attaching stream:', err);
      setError('Error displaying camera feed');
      return false;
    }
  }, [isActive, setActive, setError, videoRef]);

  /**
   * Starts the camera with improved reliability
   */
  const startCamera = useCallback(async () => {
    if (isActive) return;
    
    attemptCountRef.current += 1;
    console.log(`Attempting to start camera (attempt ${attemptCountRef.current})`);
    
    setIsTransitioning(true);
    
    try {
      // Clean up any existing stream
      cleanupStream();
      
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera not supported in this browser');
      }
      
      // Determine if the device is in landscape mode
      const isLandscape = window.innerWidth > window.innerHeight;
      
      // Get camera stream
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: 'environment',
          width: { ideal: isLandscape ? 1280 : 720 },
          height: { ideal: isLandscape ? 720 : 1280 },
        },
        audio: false,
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('Camera stream obtained successfully');
      
      // Save the stream and attach to video element
      streamRef.current = stream;
      const attached = attachStream(stream);
      
      if (attached) {
        console.log('Stream attached to video element');
        setPermission(true);
        // Note: setActive(true) is now called in attachStream after playback starts
      } else {
        console.warn('Failed to attach stream to video element');
      }
      
      // Set a timeout to force the camera to be considered active
      // This is a failsafe in case other mechanisms don't work
      if (startupTimeoutRef.current) {
        clearTimeout(startupTimeoutRef.current);
      }
      
      startupTimeoutRef.current = window.setTimeout(() => {
        if (!isActive) {
          console.log('Force activate camera after 3-second timeout');
          setActive(true);
        }
      }, 3000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error accessing camera';
      console.error('Camera error:', errorMessage);
      
      // Handle permission errors
      if (err instanceof Error && err.name === 'NotAllowedError') {
        setPermission(false);
        setError('Camera access denied. Please allow camera access.');
      } else {
        setError(`Camera error: ${errorMessage}`);
      }
      
      setActive(false);
    } finally {
      setIsTransitioning(false);
    }
  }, [attachStream, cleanupStream, isActive, setActive, setError, setPermission]);

  /**
   * Stops the camera
   */
  const stopCamera = useCallback(() => {
    console.log('Stopping camera');
    cleanupStream();
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    setActive(false);
    
    if (startupTimeoutRef.current) {
      clearTimeout(startupTimeoutRef.current);
      startupTimeoutRef.current = null;
    }
  }, [cleanupStream, setActive, videoRef]);

  /**
   * Directly requests camera permission
   */
  const requestCameraPermission = useCallback(async () => {
    console.log('Requesting camera permission');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' }, 
        audio: false 
      });
      
      console.log('Camera permission granted');
      setPermission(true);
      setError(null);
      
      // We got a stream, might as well use it
      streamRef.current = stream;
      attachStream(stream);
      // Note: setActive(true) is now called in attachStream
    } catch (err) {
      console.error('Error requesting camera permission:', err);
      if (err instanceof Error && err.name === 'NotAllowedError') {
        setPermission(false);
        setError('Camera permission denied');
      } else {
        setError('Error requesting camera access');
      }
    }
  }, [attachStream, setError, setPermission]);

  // Update camera when orientation changes
  useEffect(() => {
    const handleOrientationChange = () => {
      if (isActive) {
        console.log('Orientation changed, restarting camera');
        stopCamera();
        setTimeout(() => {
          startCamera();
        }, 300);
      }
    };

    window.addEventListener('orientationchange', handleOrientationChange);
    
    return () => {
      window.removeEventListener('orientationchange', handleOrientationChange);
      stopCamera();
    };
  }, [isActive, startCamera, stopCamera]);

  // Check existing permissions on mount
  useEffect(() => {
    const checkPermission = async () => {
      try {
        if (navigator.permissions && navigator.permissions.query) {
          const result = await navigator.permissions.query({ name: 'camera' as PermissionName });
          
          if (result.state === 'granted') {
            console.log('Camera permission already granted');
            setPermission(true);
            startCamera();
          } else if (result.state === 'denied') {
            console.log('Camera permission denied');
            setPermission(false);
          } else {
            console.log('Camera permission status:', result.state);
          }
        } else {
          console.log('Permissions API not supported, trying direct camera access');
          startCamera();
        }
      } catch (err) {
        console.log('Error checking camera permission, trying direct access');
        startCamera();
      }
    };
    
    checkPermission();
    
    // Cleanup timeout on unmount
    return () => {
      if (startupTimeoutRef.current) {
        clearTimeout(startupTimeoutRef.current);
      }
    };
  }, [setPermission, startCamera]);

  return {
    startCamera,
    stopCamera,
    requestCameraPermission,
    isActive,
    hasPermission,
    error,
    isTransitioning
  };
};