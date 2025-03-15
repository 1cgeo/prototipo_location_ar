// Path: features\ar\components\CameraView.tsx
import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Alert,
  CircularProgress,
  Snackbar,
  IconButton,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import CameraEnhanceIcon from '@mui/icons-material/CameraEnhance';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import BugReportIcon from '@mui/icons-material/BugReport';
import CloseIcon from '@mui/icons-material/Close';

import { useCamera } from '../hooks/useCamera';
import { useGeolocation } from '../hooks/useGeolocation';
import { useDeviceOrientation } from '../hooks/useDeviceOrientation';
import { useScreenOrientation } from '../hooks/useScreenOrientation';
import AROverlay from './AROverlay';
import PermissionRequest from './PermissionRequest';
import AzimuthIndicator from './AzimuthIndicator';
import LoadingState from './LoadingState';
import { useMarkersStore } from '../stores/markersStore';
import ErrorBoundary from './ErrorBoundary';

// Interface for camera element props
interface CameraElementProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  isActive: boolean;
}

// Separated component for video element rendering
const CameraElement: React.FC<CameraElementProps> = React.memo(
  ({ videoRef, isActive }) => {
    return (
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted // Important for autoplay in some browsers
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          position: 'absolute',
          top: 0,
          left: 0,
          zIndex: 1, // Ensures camera is behind other elements
          opacity: isActive ? 1 : 0.5, // Reduces opacity when not active
        }}
      />
    );
  },
);

CameraElement.displayName = 'CameraElement';

/**
 * Optimized version of CameraView that resolves initialization and rendering issues
 */
const CameraView: React.FC = () => {
  // Stable ref for video element
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const { orientation, dimensions } = useScreenOrientation();
  const [isInitializing, setIsInitializing] = useState(true);
  const [debugMode, setDebugMode] = useState(false);
  const initTimeoutRef = useRef<number | null>(null);
  const hasAttemptedInitRef = useRef(false);
  const initStartTimeRef = useRef<number>(Date.now());
  const [showRetryPrompt, setShowRetryPrompt] = useState(false);
  const errorStateRef = useRef<{ camera: boolean; location: boolean }>({
    camera: false,
    location: false,
  });

  // Real state for forcing re-renders
  const [refreshFlag, setRefreshFlag] = useState(0);
  const [cameraStarted, setCameraStarted] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Access custom hooks
  const {
    startCamera,
    requestCameraPermission,
    isActive,
    hasPermission: cameraPermission,
    error: cameraError,
  } = useCamera(videoRef);

  const {
    coordinates,
    hasPermission: locationPermission,
    error: locationError,
  } = useGeolocation();

  const {
    heading,
    errorMessage: orientationError,
    isCalibrated,
  } = useDeviceOrientation();

  const { selectedMarkerId, setVisibleMarkers } = useMarkersStore();

  // Reset visible markers to avoid rendering issues with old data
  useEffect(() => {
    setVisibleMarkers([]);
  }, [setVisibleMarkers]);

  // Force periodic re-rendering in debug mode
  useEffect(() => {
    if (debugMode) {
      const timer = setInterval(() => {
        setRefreshFlag(prev => prev + 1); // This ensures a re-render
      }, 200); // Updates every 200ms

      return () => clearInterval(timer);
    }
  }, [debugMode]);

  // Explicitly start camera and track state
  const handleStartCamera = useCallback(() => {
    console.log('Explicitly starting camera');
    setCameraStarted(true);
    startCamera();

    // Reset error state when manually starting camera
    errorStateRef.current.camera = false;
    setErrorMessage(null);
  }, [startCamera]);

  // Function to force camera permission request
  const forceRequestCamera = useCallback(() => {
    console.log('Forcing camera permission request');
    hasAttemptedInitRef.current = false;
    requestCameraPermission();
    setShowRetryPrompt(false);
  }, [requestCameraPermission]);

  // Function to force location permission request
  const forceRequestLocation = useCallback(() => {
    console.log('Forcing location permission request');
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        () => console.log('Location permission granted'),
        err => console.error('Location permission error:', err),
      );
    }
  }, []);

  // Function to reload the application
  const handleReload = useCallback(() => {
    window.location.reload();
  }, []);

  // Function to continue without waiting for full initialization
  const handleContinueAnyway = useCallback(() => {
    setIsInitializing(false);
    setShowRetryPrompt(false);
  }, []);

  // Function to toggle debug mode
  const toggleDebugMode = useCallback(() => {
    setDebugMode(prevMode => !prevMode);
  }, []);

  // Effect to show retry prompt if initialization takes too long
  useEffect(() => {
    if (isInitializing && !showRetryPrompt) {
      const timeoutId = setTimeout(() => {
        // If we've been initializing for more than 5 seconds, show retry prompt
        const initTime = Date.now() - initStartTimeRef.current;
        if (initTime > 5000 && !showRetryPrompt) {
          console.log('Initialization taking too long, showing retry prompt');
          setShowRetryPrompt(true);
        }
      }, 5000);

      return () => clearTimeout(timeoutId);
    }
  }, [isInitializing, showRetryPrompt]);

  // Improved effect for initializing automatically when permissions are ready
  useEffect(() => {
    // For debugging
    console.log('State:', {
      cameraPermission,
      locationPermission,
      heading,
      isInitializing,
      isActive,
      cameraStarted,
    });

    // Update error state refs for tracking initialization issues
    if (cameraError) {
      errorStateRef.current.camera = true;
      setErrorMessage(cameraError);
    }

    if (locationError) {
      errorStateRef.current.location = true;
    }

    // If we have permissions and not in debug mode, start camera automatically
    if (
      cameraPermission === true &&
      locationPermission === true &&
      !debugMode
    ) {
      // If we haven't tried to initialize yet
      if (!hasAttemptedInitRef.current) {
        hasAttemptedInitRef.current = true;
        console.log('Automatically starting camera');
        setCameraStarted(true);
        startCamera();

        // Timeout to continue initialization even if heading isn't available
        if (initTimeoutRef.current === null) {
          initTimeoutRef.current = window.setTimeout(() => {
            console.log('Initialization timeout reached, continuing');
            setIsInitializing(false);
          }, 3000);
        }
      }

      // If heading is available, or camera is active, we can continue
      if ((heading !== null || isActive) && isInitializing) {
        if (initTimeoutRef.current) {
          clearTimeout(initTimeoutRef.current);
          initTimeoutRef.current = null;
        }
        console.log('Conditions satisfied, continuing');
        setIsInitializing(false);
      }

      // If camera is active but initialization hasn't completed within 4 seconds,
      // proceed anyway to avoid getting stuck
      if (isActive && isInitializing) {
        const initTime = Date.now() - initStartTimeRef.current;
        if (initTime > 4000) {
          console.log(
            'Camera active but initialization taking too long, proceeding anyway',
          );
          setIsInitializing(false);
        }
      }
    }

    return () => {
      if (initTimeoutRef.current) {
        clearTimeout(initTimeoutRef.current);
        initTimeoutRef.current = null;
      }
    };
  }, [
    cameraPermission,
    locationPermission,
    heading,
    startCamera,
    isInitializing,
    isActive,
    debugMode,
    cameraError,
    locationError,
  ]);

  // Calculate initialization progress for LoadingState
  const calculateInitProgress = useCallback(() => {
    let progress = 0;
    if (cameraPermission === true) progress += 40;
    if (locationPermission === true) progress += 40;
    if (heading !== null) progress += 20;
    return progress;
  }, [cameraPermission, locationPermission, heading]);

  // Function to detect real camera permission
  const detectRealPermission = useCallback(async () => {
    try {
      if (!navigator.mediaDevices) {
        console.error('MediaDevices API not available');
        return false;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });

      // If we get here, we have permission
      console.log('Camera permission detected');

      // Clean up the test stream
      stream.getTracks().forEach(track => track.stop());

      return true;
    } catch (err) {
      console.error('Error detecting real permission:', err);
      return false;
    }
  }, []);

  // UI for when permissions haven't been granted
  if (cameraPermission === false || locationPermission === false) {
    return (
      <ErrorBoundary>
        <PermissionRequest
          cameraPermission={cameraPermission}
          locationPermission={locationPermission}
          cameraError={cameraError}
          locationError={locationError}
          orientationError={orientationError || null}
          onRequestPermissions={async () => {
            // Check real permission first
            const realPermission = await detectRealPermission();

            if (realPermission) {
              console.log('Real permission detected. Continuing...');
              hasAttemptedInitRef.current = false;
              handleStartCamera();
            } else {
              console.log('No real permission. Requesting...');
              hasAttemptedInitRef.current = false;
              requestCameraPermission();
            }
          }}
        />
      </ErrorBoundary>
    );
  }

  // Debug mode display
  if (debugMode) {
    // Force re-render to show updated values
    const debugHeading = `${refreshFlag > 0 ? `[${refreshFlag}] ` : ''}${heading?.toFixed(1) || 'N/A'}°`;

    return (
      <ErrorBoundary>
        <Box
          sx={{
            padding: 2,
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            bgcolor: 'background.paper',
            color: 'text.primary',
            overflow: 'auto',
            overflowX: 'hidden',
            '&::-webkit-scrollbar': {
              display: 'block',
              width: '8px',
            },
            '&::-webkit-scrollbar-thumb': {
              backgroundColor: 'rgba(0,0,0,0.2)',
              borderRadius: '4px',
            },
          }}
        >
          <Typography variant="h5" gutterBottom>
            Debug Mode
          </Typography>

          <Alert severity="info" sx={{ mb: 2 }}>
            Use this mode to identify initialization and permission issues.
          </Alert>

          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle1">Permission State:</Typography>
            <Typography>
              Camera (Reported):{' '}
              {cameraPermission === null
                ? 'Not requested'
                : cameraPermission
                  ? 'Allowed'
                  : 'Denied'}
            </Typography>
            <Typography>
              Camera (Real):{' '}
              <Button
                size="small"
                onClick={async () => {
                  const real = await detectRealPermission();
                  alert(
                    `Real camera permission: ${real ? 'ALLOWED' : 'DENIED'}`,
                  );
                }}
              >
                Check
              </Button>
            </Typography>
            <Typography>
              Location:{' '}
              {locationPermission === null
                ? 'Not requested'
                : locationPermission
                  ? 'Allowed'
                  : 'Denied'}
            </Typography>
            <Typography>
              Orientation: {heading === null ? 'Not available' : 'Available'}
            </Typography>
          </Box>

          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle1">Errors:</Typography>
            <Typography color="error">
              {cameraError || 'No camera error'}
            </Typography>
            <Typography color="error">
              {locationError || 'No location error'}
            </Typography>
            <Typography color="error">
              {orientationError || 'No orientation error'}
            </Typography>
          </Box>

          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle1">Coordinates:</Typography>
            <Typography>
              Latitude: {coordinates.latitude?.toFixed(6) || 'N/A'}
            </Typography>
            <Typography>
              Longitude: {coordinates.longitude?.toFixed(6) || 'N/A'}
            </Typography>
            <Typography>
              Accuracy: {coordinates.accuracy?.toFixed(1) || 'N/A'}m
            </Typography>
          </Box>

          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle1">Orientation:</Typography>
            <Typography>Heading: {debugHeading}</Typography>
            <Typography>Calibrated: {isCalibrated ? 'Yes' : 'No'}</Typography>
          </Box>

          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle1">Camera:</Typography>
            <Typography>State: {isActive ? 'Active' : 'Inactive'}</Typography>
            <Typography>
              Video Ref: {videoRef.current ? 'Available' : 'Not available'}
            </Typography>
            <Typography>
              Stream Started: {cameraStarted ? 'Yes' : 'No'}
            </Typography>

            {/* Camera container */}
            <Box
              sx={{
                width: '100%',
                height: 200,
                my: 1,
                border: '1px solid #ccc',
                borderRadius: 8,
                overflow: 'hidden',
                position: 'relative',
                bgcolor: '#111',
              }}
            >
              {/* Video element is always rendered */}
              <CameraElement videoRef={videoRef} isActive={isActive} />

              {!isActive && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'rgba(0,0,0,0.7)',
                    zIndex: 2,
                  }}
                >
                  <Typography color="error">Camera inactive</Typography>
                </Box>
              )}
            </Box>
          </Box>

          <Box
            sx={{
              mt: 2,
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
              pb: 4,
            }}
          >
            <Button
              variant="contained"
              color="primary"
              onClick={forceRequestCamera}
              startIcon={<CameraAltIcon />}
            >
              Request Camera Permission
            </Button>

            <Button
              variant="contained"
              color="primary"
              onClick={forceRequestLocation}
              startIcon={<LocationOnIcon />}
            >
              Request Location Permission
            </Button>

            <Button
              variant="contained"
              color="success"
              onClick={handleStartCamera}
              startIcon={<CameraEnhanceIcon />}
            >
              Start Camera
            </Button>

            <Button
              variant="contained"
              color="secondary"
              onClick={handleReload}
              startIcon={<RefreshIcon />}
            >
              Reload Application
            </Button>

            <Button variant="outlined" onClick={handleContinueAnyway}>
              Continue Without Waiting
            </Button>

            <Button variant="outlined" onClick={() => setDebugMode(false)}>
              Return to Normal Mode
            </Button>
          </Box>
        </Box>
      </ErrorBoundary>
    );
  }

  // Display normal loading screen
  if (isInitializing) {
    return (
      <ErrorBoundary>
        <Box
          sx={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'background.default',
            padding: 3,
            position: 'relative',
          }}
        >
          {/* Video element is rendered even during loading,
              but is invisible. This allows the stream to be set up
              before display */}
          <Box
            sx={{
              position: 'absolute',
              width: 0,
              height: 0,
              overflow: 'hidden',
            }}
          >
            <CameraElement videoRef={videoRef} isActive={isActive} />
          </Box>

          <LoadingState
            message={`Initializing... ${calculateInitProgress()}%`}
            progress={calculateInitProgress()}
          />

          {/* Show retry options if taking too long */}
          {showRetryPrompt && (
            <Box
              sx={{
                position: 'absolute',
                bottom: '25%',
                left: '50%',
                transform: 'translateX(-50%)',
                width: '90%',
                maxWidth: 400,
                zIndex: 10,
              }}
            >
              <Alert
                severity="warning"
                sx={{ mb: 2 }}
                action={
                  <IconButton
                    size="small"
                    onClick={() => setShowRetryPrompt(false)}
                  >
                    <CloseIcon fontSize="small" />
                  </IconButton>
                }
              >
                <Typography variant="body2" gutterBottom>
                  Initialization is taking longer than expected.
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                  <Button
                    size="small"
                    variant="outlined"
                    color="warning"
                    onClick={handleStartCamera}
                    startIcon={<CameraAltIcon />}
                  >
                    Retry Camera
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={handleContinueAnyway}
                  >
                    Continue
                  </Button>
                </Box>
              </Alert>
            </Box>
          )}

          <Box
            sx={{ position: 'absolute', bottom: 16, display: 'flex', gap: 1 }}
          >
            <Button
              variant="contained"
              color="primary"
              size="small"
              onClick={toggleDebugMode}
            >
              Debug Mode
            </Button>

            <Button
              variant="outlined"
              size="small"
              onClick={forceRequestCamera}
            >
              Camera Permission
            </Button>

            <Button
              variant="outlined"
              size="small"
              onClick={handleContinueAnyway}
            >
              Continue Anyway
            </Button>
          </Box>
        </Box>
      </ErrorBoundary>
    );
  }

  // If camera isn't active but we've passed initialization,
  // try to start again and show a loading state
  if (!isActive && !isInitializing) {
    // If we haven't started yet, try explicitly
    if (!cameraStarted) {
      handleStartCamera();
    }

    return (
      <ErrorBoundary>
        <Box
          sx={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'background.default',
          }}
        >
          {/* Video element is rendered even during loading */}
          <Box
            sx={{
              position: 'absolute',
              width: 0,
              height: 0,
              overflow: 'hidden',
            }}
          >
            <CameraElement videoRef={videoRef} isActive={isActive} />
          </Box>

          <CircularProgress color="primary" />
          <Typography variant="body1" sx={{ mt: 2, mb: 4 }}>
            Starting camera...
          </Typography>

          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="contained"
              color="primary"
              size="small"
              onClick={handleStartCamera}
            >
              Retry Camera
            </Button>

            <Button
              variant="outlined"
              color="secondary"
              size="small"
              onClick={toggleDebugMode}
            >
              Debug Mode
            </Button>
          </Box>
        </Box>
      </ErrorBoundary>
    );
  }

  // Normal app rendering - camera is active
  return (
    <ErrorBoundary>
      <Box
        sx={{
          position: 'relative',
          width: '100%',
          height: '100%',
          paddingTop: 'env(safe-area-inset-top)',
          paddingRight: 'env(safe-area-inset-right)',
          paddingBottom: 'env(safe-area-inset-bottom)',
          paddingLeft: 'env(safe-area-inset-left)',
        }}
      >
        {/* Main video element */}
        <CameraElement videoRef={videoRef} isActive={isActive} />

        {/* AR Overlay when camera is active and we have location */}
        {isActive && coordinates.latitude && coordinates.longitude && (
          <AROverlay
            latitude={coordinates.latitude}
            longitude={coordinates.longitude}
            heading={heading ?? 0}
            orientation={orientation}
            dimensions={dimensions}
          />
        )}

        {/* Azimuth indicator */}
        {!selectedMarkerId && (
          <AzimuthIndicator
            heading={heading ?? 0}
            isLandscape={orientation === 'landscape'}
            isCalibrated={Boolean(isCalibrated)}
          />
        )}

        {/* Error snackbar */}
        <Snackbar
          open={!!errorMessage}
          autoHideDuration={6000}
          onClose={() => setErrorMessage(null)}
          message={errorMessage}
          action={
            <IconButton
              size="small"
              color="inherit"
              onClick={() => setErrorMessage(null)}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          }
          anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        />

        {/* Debug mode button */}
        <Button
          variant="contained"
          size="small"
          onClick={toggleDebugMode}
          startIcon={<BugReportIcon />}
          sx={{
            position: 'absolute',
            bottom: 16,
            right: 16,
            zIndex: 1000,
            opacity: 0.7,
          }}
        >
          Debug
        </Button>

        {/* Additional retry button if camera has error */}
        {errorStateRef.current.camera && (
          <Button
            variant="contained"
            color="warning"
            size="small"
            onClick={handleStartCamera}
            startIcon={<ErrorOutlineIcon />}
            sx={{
              position: 'absolute',
              bottom: 16,
              left: 16,
              zIndex: 1000,
              opacity: 0.8,
            }}
          >
            Retry Camera
          </Button>
        )}
      </Box>
    </ErrorBoundary>
  );
};

// Wrapper component with ErrorBoundary
const CameraViewWithErrorHandling: React.FC = () => {
  return (
    <ErrorBoundary>
      <CameraView />
    </ErrorBoundary>
  );
};

export default CameraViewWithErrorHandling;
