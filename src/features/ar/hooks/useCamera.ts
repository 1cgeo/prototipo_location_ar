// Path: features\ar\hooks\useCamera.ts
import { useState, useEffect, useRef, useCallback } from 'react';
import { useCameraStore } from '../stores/cameraStore';

interface UseCameraProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
}

/**
 * Simplified hook for managing camera access
 */
export const useCamera = ({ videoRef }: UseCameraProps) => {
  const { isActive, hasPermission, error, setActive, setPermission, setError } =
    useCameraStore();
  const streamRef = useRef<MediaStream | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

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
   * Attaches an existing stream to the video element
   */
  const attachStream = useCallback(
    (stream: MediaStream) => {
      if (!videoRef.current) return false;

      try {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch(() => {
            setError('Error playing video: Please try again');
          });
        };
        return true;
      } catch (err) {
        setError('Error displaying camera feed');
        return false;
      }
    },
    [setError, videoRef],
  );

  /**
   * Starts the camera
   */
  const startCamera = useCallback(async () => {
    if (isActive) return;

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

      // Save the stream and attach to video element
      streamRef.current = stream;
      const attached = attachStream(stream);

      if (attached) {
        setPermission(true);
        setActive(true);
        setError(null);
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Error accessing camera';

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
  }, [
    attachStream,
    cleanupStream,
    isActive,
    setActive,
    setError,
    setPermission,
  ]);

  /**
   * Stops the camera
   */
  const stopCamera = useCallback(() => {
    cleanupStream();
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setActive(false);
  }, [cleanupStream, setActive, videoRef]);

  /**
   * Directly requests camera permission
   */
  const requestCameraPermission = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });

      setPermission(true);
      setError(null);

      // We got a stream, might as well use it
      streamRef.current = stream;
      attachStream(stream);
      setActive(true);
    } catch (err) {
      if (err instanceof Error && err.name === 'NotAllowedError') {
        setPermission(false);
        setError('Camera permission denied');
      } else {
        setError('Error requesting camera access');
      }
    }
  }, [attachStream, setActive, setError, setPermission]);

  // Update camera when orientation changes
  useEffect(() => {
    const handleOrientationChange = () => {
      if (isActive) {
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
          const result = await navigator.permissions.query({
            name: 'camera' as PermissionName,
          });

          if (result.state === 'granted') {
            setPermission(true);
            startCamera();
          } else if (result.state === 'denied') {
            setPermission(false);
          }
        }
      } catch (err) {
        // Permissions API might not be supported, ignore
      }
    };

    checkPermission();
  }, [setPermission, startCamera]);

  return {
    startCamera,
    stopCamera,
    requestCameraPermission,
    isActive,
    hasPermission,
    error,
    isTransitioning,
  };
};
