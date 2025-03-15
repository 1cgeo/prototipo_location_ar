// Path: features/ar/hooks/useCamera.ts
import { useState, useEffect, useRef, useCallback } from 'react';
import { useCameraStore } from '../stores/cameraStore';

interface UseCameraProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
}

/**
 * Completely reworked camera hook that addresses endless retry issues
 */
export const useCamera = ({ videoRef }: UseCameraProps) => {
  const { isActive, hasPermission, error, setActive, setPermission, setError } = useCameraStore();
  const streamRef = useRef<MediaStream | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const hasAttemptedRef = useRef(false);
  const videoAttachedRef = useRef(false);
  
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
    
    // Also clean video element
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current.onloadedmetadata = null;
      videoRef.current.onloadeddata = null;
      videoRef.current.onerror = null;
    }
    
    videoAttachedRef.current = false;
  }, [videoRef]);

  /**
   * Attaches stream to video element with enhanced reliability
   */
  const attachStream = useCallback((stream: MediaStream): boolean => {
    if (!videoRef.current) {
      console.error('No video element available');
      return false;
    }
    
    try {
      // Clean up any existing event listeners first to prevent duplicates
      videoRef.current.onloadedmetadata = null;
      videoRef.current.onloadeddata = null;
      videoRef.current.onerror = null;
      
      // Directly set stream
      videoRef.current.srcObject = stream;
      videoAttachedRef.current = true;
      
      // Handle video loaded event
      const handleVideoReady = () => {
        if (!videoRef.current) return;
        
        try {
          videoRef.current.play()
            .then(() => {
              console.log('✅ Camera playing successfully');
              setActive(true);
            })
            .catch(err => {
              console.error('⚠️ Video play error:', err.name);
              
              // Mobile browsers often block autoplay - in AR contexts
              // most browsers make an exception, but we'll handle it just in case
              if (err.name === 'NotAllowedError') {
                console.log('⚠️ Autoplay blocked - using manual play workaround');
                
                // For AR use cases, we'll still consider camera active and
                // let user tap to interact if needed
                setActive(true);
              } else {
                setError(`Camera playback error: ${err.name}`);
              }
            });
        } catch (err) {
          console.error('⚠️ General video error:', err);
          setError('Camera playback failed');
        }
      };
      
      // Set up multiple event handlers to increase chances of successful initialization
      videoRef.current.onloadedmetadata = handleVideoReady;
      videoRef.current.onloadeddata = handleVideoReady;
      
      // Handle video errors
      videoRef.current.onerror = (event) => {
        console.error('⚠️ Video element error:', event);
        setError('Video element error');
      };
      
      return true;
    } catch (err) {
      console.error('⚠️ Error attaching stream:', err);
      setError('Failed to display camera feed');
      return false;
    }
  }, [setActive, setError, videoRef]);

  /**
   * Main camera initialization function
   * Completely redesigned with better fallbacks and error detection
   */
  const startCamera = useCallback(async () => {
    // Don't retry if already active
    if (isActive) {
      console.log('📷 Camera already active, skipping start');
      return;
    }
    
    hasAttemptedRef.current = true;
    console.log('📷 Starting camera...');
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
        audio: false
      };
      
      // Request camera stream
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('✅ Camera stream obtained');
      
      // Store the stream reference
      streamRef.current = stream;
      
      // Check for video tracks
      if (stream.getVideoTracks().length === 0) {
        throw new Error('No video tracks in camera stream');
      }
      
      // Update permission state
      setPermission(true);
      
      // Attach to video element
      if (attachStream(stream)) {
        console.log('✅ Stream attached to video element');
        
        // Set a fallback timer to force camera active if events don't fire
        setTimeout(() => {
          if (!isActive) {
            console.log('⚠️ Fallback: Forcing camera active after timeout');
            setActive(true);
          }
        }, 2000);
      } else {
        console.error('⚠️ Failed to attach stream to video element');
        setError('Failed to initialize video display');
        throw new Error('Failed to attach stream');
      }
    } catch (err) {
      console.error('⚠️ Camera error:', err);
      
      // Handle specific error types
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          console.log('❌ Camera permission denied');
          setPermission(false);
          setError('Camera access denied. Please check browser permissions.');
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
          setError('No camera found on this device');
        } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
          setError('Camera is in use by another application');
        } else if (err.name === 'OverconstrainedError') {
          setError('Camera cannot satisfy the requested constraints');
        } else {
          setError(`Camera error: ${err.message || err.name || 'Unknown error'}`);
        }
      } else {
        setError('Unknown camera error');
      }
      
      setActive(false);
    } finally {
      setIsTransitioning(false);
      
      // Critically important: if video element has a stream but we didn't activate,
      // force set active state to true after a delay
      setTimeout(() => {
        if (videoRef.current?.srcObject && !isActive && videoAttachedRef.current) {
          console.log('⚠️ Stream detected but camera not active - forcing active state');
          setActive(true);
        }
      }, 1000);
    }
  }, [attachStream, cleanupStream, isActive, setActive, setError, setPermission, videoRef]);

  /**
   * Stops the camera
   */
  const stopCamera = useCallback(() => {
    console.log('📷 Stopping camera');
    cleanupStream();
    setActive(false);
  }, [cleanupStream, setActive]);

  /**
   * Requests camera permission with better error handling
   */
  const requestCameraPermission = useCallback(async () => {
    console.log('📷 Requesting camera permission');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false
      });
      
      console.log('✅ Camera permission granted');
      setPermission(true);
      setError(null);
      
      // Store and attach the stream
      streamRef.current = stream;
      attachStream(stream);
    } catch (err) {
      console.error('❌ Error requesting camera permission:', err);
      
      if (err instanceof Error && err.name === 'NotAllowedError') {
        setPermission(false);
        setError('Camera permission denied');
      } else {
        setPermission(false);
        setError('Error accessing camera');
      }
    }
  }, [attachStream, setError, setPermission]);

  // Handle orientation changes
  useEffect(() => {
    const handleOrientationChange = () => {
      // Only restart if already active
      if (isActive) {
        console.log('📱 Orientation changed, restarting camera');
        stopCamera();
        
        // Brief delay to allow cleanup
        setTimeout(() => {
          startCamera();
        }, 300);
      }
    };
    
    window.addEventListener('orientationchange', handleOrientationChange);
    
    return () => {
      window.removeEventListener('orientationchange', handleOrientationChange);
    };
  }, [isActive, startCamera, stopCamera]);
  
  // Check permissions on mount and auto-start camera if granted
  useEffect(() => {
    const checkPermissions = async () => {
      // Only run this once
      if (hasAttemptedRef.current) return;
      
      try {
        // Try to use Permissions API if available
        if (navigator.permissions && navigator.permissions.query) {
          try {
            const result = await navigator.permissions.query({ name: 'camera' as PermissionName });
            
            if (result.state === 'granted') {
              console.log('✅ Camera permission already granted');
              setPermission(true);
              startCamera();
            } else if (result.state === 'denied') {
              console.log('❌ Camera permission denied');
              setPermission(false);
            } else {
              console.log('⚠️ Camera permission status:', result.state);
              // For 'prompt' state, wait for user to request
            }
            return;
          } catch (err) {
            console.log('⚠️ Permissions API error, falling back to direct access');
          }
        }
        
        // If Permissions API fails or isn't available, try direct access
        // This will either get a stream (permission granted) or throw (denied/prompt)
        console.log('📷 Trying direct camera access');
        startCamera();
      } catch (err) {
        console.error('❌ Permission check error:', err);
      }
    };
    
    // Run permission check
    checkPermissions();
    
    // Cleanup on unmount
    return () => {
      stopCamera();
    };
  }, [setPermission, startCamera, stopCamera]);

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