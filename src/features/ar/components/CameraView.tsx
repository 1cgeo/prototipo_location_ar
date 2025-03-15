// Path: features\ar\components\CameraView.tsx
import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  Snackbar,
  IconButton,
  Alert,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import RefreshIcon from '@mui/icons-material/Refresh';

import { useCamera } from '../hooks/useCamera';
import { useGeolocation } from '../hooks/useGeolocation';
import { useDeviceOrientation } from '../hooks/useDeviceOrientation';
import { useScreenOrientation } from '../hooks/useScreenOrientation';
import AROverlay from './AROverlay';
import PermissionRequest from './PermissionRequest';
import AzimuthIndicator from './AzimuthIndicator';
import LoadingState from './LoadingState';
import FloatingDebugInfo from './FloatingDebugInfo';
import EnhancedDebugOverlay from './EnhancedDebugOverlay';
import { useLocationStore } from '../stores/locationStore';
import { useMarkersStore } from '../stores/markersStore';
import { useCameraStore } from '../stores/cameraStore';
import ErrorBoundary from './ErrorBoundary';

/**
 * Optimized camera view with enhanced error handling and debugging
 */
const CameraView: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const { orientation, dimensions } = useScreenOrientation();
  const [isInitializing, setIsInitializing] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showDebugMode, setShowDebugMode] = useState(false);
  const [showFloatingDebug, setShowFloatingDebug] = useState(false);
  const [forceOverrideMode, setForceOverrideMode] = useState(false);
  const [isFirstRender, setIsFirstRender] = useState(true);

  // Refs to avoid unnecessary re-renders
  const initTimeoutRef = useRef<number | null>(null);
  const maxWaitTimeoutRef = useRef<number | null>(null);
  const startupTimestampRef = useRef(Date.now());

  // Camera and location stores
  const {
    setActive: setCameraActive,
    addLog: addCameraLog,
    isActive: _cameraStoreActive,
    hasPermission: _cameraStorePermission,
    error: _cameraStoreError,
  } = useCameraStore();

  // Don't destructure too many values that could cause unnecessary re-renders
  const { heading } = useLocationStore();
  const { selectedMarkerId, setVisibleMarkers } = useMarkersStore();

  // Use hooks with minimal dependencies for re-renders
  const {
    startCamera,
    requestCameraPermission,
    isActive,
    hasPermission: cameraPermission,
    error: cameraError,
    isTransitioning,
    logEvent,
  } = useCamera({ videoRef });

  const {
    coordinates,
    hasPermission: locationPermission,
    error: locationError,
  } = useGeolocation();

  const {
    isCalibrated,
    errorMessage: orientationError,
    useFallbackHeading,
  } = useDeviceOrientation();

  // Log component render time to help debug performance issues
  useEffect(() => {
    if (isFirstRender) {
      logEvent('CameraView component mounted');
      setIsFirstRender(false);
    } else {
      logEvent('CameraView component re-rendered');
    }
  });

  // Reset visible markers when component mounts
  useEffect(() => {
    setVisibleMarkers([]);
  }, [setVisibleMarkers]);

  // Add logging util that will be visible even without console
  const debugLog = useCallback(
    (message: string, type: 'info' | 'error' | 'warn' = 'info') => {
      // Add to camera store log
      addCameraLog(message, type);
      // Also try console
      logEvent(message, type);
    },
    [addCameraLog, logEvent],
  );

  // Cleanup function for timeouts
  const clearTimeouts = useCallback(() => {
    if (initTimeoutRef.current) {
      clearTimeout(initTimeoutRef.current);
      initTimeoutRef.current = null;
    }
    if (maxWaitTimeoutRef.current) {
      clearTimeout(maxWaitTimeoutRef.current);
      maxWaitTimeoutRef.current = null;
    }
  }, []);

  // Calculate how long the app has been initializing
  const getStartupDuration = useCallback(() => {
    return Math.floor((Date.now() - startupTimestampRef.current) / 1000);
  }, []);

  // Initialize app when permissions are granted
  useEffect(() => {
    // Check if we have all required permissions
    if (cameraPermission === true && locationPermission === true) {
      // Start camera if not already active
      if (!isActive && !forceOverrideMode) {
        debugLog('Permissions granted, starting camera');
        startCamera();
      }

      // Set a timeout to move past initialization after a reasonable time
      if (initTimeoutRef.current === null) {
        initTimeoutRef.current = window.setTimeout(() => {
          debugLog('Init timeout reached, continuing');
          setIsInitializing(false);
        }, 2500);
      }

      // Set absolute maximum wait time to prevent getting stuck
      if (maxWaitTimeoutRef.current === null) {
        maxWaitTimeoutRef.current = window.setTimeout(() => {
          debugLog('Maximum wait time exceeded', 'warn');
          setIsInitializing(false);
        }, 6000);
      }

      // If camera becomes active or we're in override mode, move past initialization
      if (isActive || forceOverrideMode) {
        clearTimeouts();
        setIsInitializing(false);
      }
    }

    // Cleanup timeouts on unmount
    return clearTimeouts;
  }, [
    cameraPermission,
    locationPermission,
    isActive,
    startCamera,
    forceOverrideMode,
    clearTimeouts,
    debugLog,
  ]);

  // Show any errors that occur
  useEffect(() => {
    if (cameraError) {
      setErrorMessage(cameraError);
    } else if (locationError) {
      setErrorMessage(locationError);
    } else if (orientationError) {
      setErrorMessage(orientationError);
    }
  }, [cameraError, locationError, orientationError]);

  // Handle override mode - skips camera completely if needed
  const enableOverrideMode = useCallback(() => {
    debugLog('OVERRIDE: Continuing without camera', 'warn');
    setForceOverrideMode(true);
    setCameraActive(true); // Pretend camera is active
  }, [debugLog, setCameraActive]);

  // Force reload function for when things get stuck
  const handleForceReload = useCallback(() => {
    debugLog('User requested force reload', 'warn');
    window.location.reload();
  }, [debugLog]);

  // Generate floating debug info status items
  const getFloatingDebugItems = useCallback(() => {
    return [
      {
        label: 'Camera',
        value: isActive ? 'Active' : 'Inactive',
        color: isActive ? 'success' : cameraError ? 'error' : 'warning',
      } as const,
      {
        label: 'Location',
        value: coordinates.latitude ? 'OK' : 'N/A',
        color: coordinates.latitude ? 'success' : 'error',
      } as const,
      {
        label: 'Heading',
        value: heading !== null ? `${Math.round(heading)}°` : 'N/A',
        color:
          heading !== null
            ? useFallbackHeading
              ? 'warning'
              : 'success'
            : 'error',
      } as const,
    ];
  }, [
    coordinates.latitude,
    heading,
    isActive,
    cameraError,
    useFallbackHeading,
  ]);

  // UI for when permissions haven't been granted
  if (cameraPermission === false || locationPermission === false) {
    return (
      <ErrorBoundary>
        <PermissionRequest
          cameraPermission={cameraPermission}
          locationPermission={locationPermission}
          cameraError={cameraError}
          locationError={locationError}
          orientationError={orientationError}
          onRequestPermissions={requestCameraPermission}
        />
      </ErrorBoundary>
    );
  }

  // Debug mode view
  if (showDebugMode) {
    return (
      <ErrorBoundary>
        <Box
          sx={{
            padding: 2,
            height: '100vh',
            bgcolor: 'background.paper',
            overflow: 'auto',
          }}
        >
          <Typography variant="h5" gutterBottom>
            Debug Mode
          </Typography>

          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle1">Status:</Typography>
            <Typography>Camera: {isActive ? 'Active' : 'Inactive'}</Typography>
            <Typography>
              Location: {coordinates.latitude ? 'Available' : 'Unavailable'}
            </Typography>
            <Typography>
              Heading:{' '}
              {heading !== null ? `${heading.toFixed(1)}°` : 'Unavailable'}
            </Typography>
            <Typography>
              Using Fallback: {useFallbackHeading ? 'Yes' : 'No'}
            </Typography>
            <Typography>
              Camera Permission:{' '}
              {cameraPermission === null
                ? 'Unknown'
                : cameraPermission
                  ? 'Granted'
                  : 'Denied'}
            </Typography>
            <Typography>
              Override Mode: {forceOverrideMode ? 'Enabled' : 'Disabled'}
            </Typography>
            <Typography>
              Initialization Time: {getStartupDuration()}s
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

          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mt: 2 }}>
            <Button variant="contained" onClick={() => setShowDebugMode(false)}>
              RETURN TO AR VIEW
            </Button>

            <Button
              variant="contained"
              color="warning"
              onClick={handleForceReload}
              startIcon={<RefreshIcon />}
            >
              FORCE RELOAD
            </Button>

            {!isActive && (
              <Button
                variant="contained"
                color="success"
                onClick={() => {
                  setCameraActive(true);
                  setForceOverrideMode(true);
                  debugLog('Forced camera active via debug mode');
                }}
              >
                FORCE CAMERA ACTIVE
              </Button>
            )}
          </Box>
        </Box>
      </ErrorBoundary>
    );
  }

  // Loading state
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
            position: 'relative',
          }}
        >
          <LoadingState message="Initializing AR View..." />

          {/* Hidden video element to help with initialization */}
          <Box
            sx={{
              position: 'absolute',
              opacity: 0,
              pointerEvents: 'none',
              width: 0,
              height: 0,
              overflow: 'hidden',
            }}
          >
            <video ref={videoRef} autoPlay playsInline muted />
          </Box>

          {/* Enhanced debugging in loading state */}
          <FloatingDebugInfo
            position="bottom"
            statusItems={[
              {
                label: 'Camera Permission',
                value: cameraPermission
                  ? 'Granted'
                  : cameraPermission === false
                    ? 'Denied'
                    : 'Pending',
                color: cameraPermission
                  ? 'success'
                  : cameraPermission === false
                    ? 'error'
                    : 'warning',
              },
              {
                label: 'Location Permission',
                value: locationPermission
                  ? 'Granted'
                  : locationPermission === false
                    ? 'Denied'
                    : 'Pending',
                color: locationPermission
                  ? 'success'
                  : locationPermission === false
                    ? 'error'
                    : 'warning',
              },
              {
                label: 'Initializing',
                value: `${getStartupDuration()}s`,
                color: getStartupDuration() > 5 ? 'error' : 'info',
              },
            ]}
            maxWidth={300}
          />

          <Box
            sx={{
              position: 'absolute',
              bottom: 24,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
            }}
          >
            <Typography variant="caption" color="text.secondary">
              Initializing for {getStartupDuration()}s
            </Typography>

            <Button
              variant="contained"
              size="small"
              onClick={() => setIsInitializing(false)}
            >
              Continue Anyway
            </Button>

            <Button
              variant="outlined"
              size="small"
              onClick={() => setShowDebugMode(true)}
            >
              Show Debug Info
            </Button>
          </Box>
        </Box>
      </ErrorBoundary>
    );
  }

  // If camera isn't active but we've passed initialization, show a loading spinner with enhanced options
  if (!isActive && !forceOverrideMode) {
    const startupTime = getStartupDuration();
    const showForceOptions = startupTime >= 5; // Show force options after 5 seconds

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
            padding: 2,
            position: 'relative',
          }}
        >
          {/* Enhanced debugging in camera loading state */}
          {showFloatingDebug && (
            <FloatingDebugInfo
              position="left"
              statusItems={getFloatingDebugItems()}
              maxWidth={250}
            />
          )}

          {/* Hidden video element to help with initialization */}
          <Box
            sx={{
              position: 'absolute',
              opacity: 0,
              pointerEvents: 'none',
              width: 0,
              height: 0,
              overflow: 'hidden',
            }}
          >
            <video ref={videoRef} autoPlay playsInline muted />
          </Box>

          <IconButton
            sx={{
              position: 'absolute',
              top: 16,
              right: 16,
            }}
            onClick={() => setShowFloatingDebug(!showFloatingDebug)}
          >
            <RefreshIcon />
          </IconButton>

          <CircularProgress size={50} color="primary" />
          <Typography variant="h6" sx={{ mt: 3, mb: 1 }}>
            Starting camera...
          </Typography>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Waiting for camera initialization ({startupTime}s)
          </Typography>

          {/* Show warning after a while */}
          {showForceOptions && (
            <Alert severity="warning" sx={{ mb: 3, maxWidth: 450 }}>
              Camera initialization is taking longer than expected. This may be
              due to browser restrictions or hardware issues. You can try the
              options below.
            </Alert>
          )}

          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: 1.5,
              width: '100%',
              maxWidth: 350,
            }}
          >
            <Button
              variant="contained"
              color="primary"
              onClick={() => {
                debugLog('Retry camera button clicked');
                startCamera();
              }}
              startIcon={<CameraAltIcon />}
              fullWidth
            >
              Retry Camera
            </Button>

            <Button
              variant="outlined"
              onClick={() => {
                debugLog('Debug mode opened from camera loading screen');
                setShowDebugMode(true);
              }}
              startIcon={<RefreshIcon />}
              fullWidth
            >
              Debug Mode
            </Button>

            {showForceOptions && (
              <>
                <Button
                  variant="outlined"
                  color="warning"
                  onClick={handleForceReload}
                  startIcon={<RefreshIcon />}
                  fullWidth
                >
                  Reload Page
                </Button>

                <Button
                  variant="outlined"
                  color="success"
                  onClick={enableOverrideMode}
                  fullWidth
                >
                  Continue Without Camera
                </Button>
              </>
            )}
          </Box>
        </Box>
      </ErrorBoundary>
    );
  }

  // Main AR view - now supporting both camera and override mode
  return (
    <ErrorBoundary>
      <Box
        sx={{
          position: 'relative',
          width: '100%',
          height: '100%',
          overflow: 'hidden',
          bgcolor: 'background.default', // Background color helps in override mode
        }}
      >
        {/* Camera video element - only shown if not in override mode */}
        {!forceOverrideMode && (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              position: 'absolute',
              top: 0,
              left: 0,
              opacity: isTransitioning ? 0.5 : 1,
            }}
          />
        )}

        {/* Toggle floating debug */}
        <IconButton
          sx={{
            position: 'absolute',
            top: 8,
            left: 8,
            zIndex: 1100,
            backgroundColor: 'rgba(0,0,0,0.3)',
            '&:hover': { backgroundColor: 'rgba(0,0,0,0.5)' },
          }}
          color="inherit"
          onClick={() => {
            debugLog(
              `Floating debug ${showFloatingDebug ? 'hidden' : 'shown'}`,
            );
            setShowFloatingDebug(!showFloatingDebug);
          }}
        >
          <RefreshIcon fontSize="small" />
        </IconButton>

        {/* Floating debug panel */}
        {showFloatingDebug && (
          <FloatingDebugInfo
            position="left"
            statusItems={getFloatingDebugItems()}
            maxWidth={250}
          />
        )}

        {/* Override mode notice */}
        {forceOverrideMode && (
          <Box
            sx={{
              position: 'absolute',
              top: '30%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 5,
              textAlign: 'center',
              maxWidth: '80%',
              bgcolor: 'rgba(0,0,0,0.6)',
              color: 'white',
              padding: '8px 16px',
              borderRadius: 2,
            }}
          >
            <Typography variant="body2">
              Running in override mode - camera not available
            </Typography>
          </Box>
        )}

        {/* AR Overlay with markers */}
        {coordinates.latitude && coordinates.longitude && heading !== null && (
          <AROverlay
            latitude={coordinates.latitude}
            longitude={coordinates.longitude}
            heading={heading}
            orientation={orientation}
            dimensions={dimensions}
          />
        )}

        {/* Compass indicator */}
        {!selectedMarkerId && (
          <AzimuthIndicator
            heading={heading}
            isLandscape={orientation === 'landscape'}
            isCalibrated={isCalibrated}
          />
        )}

        {/* Error message */}
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
        />

        {/* Fallback mode indicator */}
        {useFallbackHeading && (
          <Box
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              zIndex: 50,
              backgroundColor: 'rgba(0,0,0,0.6)',
              color: 'white',
              padding: '8px 16px',
              borderRadius: 2,
              pointerEvents: 'none',
              textAlign: 'center',
            }}
          >
            <Typography variant="caption">
              Demo mode - simulated compass
            </Typography>
          </Box>
        )}

        {/* Enhanced debug overlay */}
        <EnhancedDebugOverlay
          onForceReload={handleForceReload}
          onCameraRetry={startCamera}
          onToggleDebugMode={setShowDebugMode}
          onEnableOverrideMode={enableOverrideMode}
          isActive={isActive}
          forceOverrideMode={forceOverrideMode}
          startupDuration={getStartupDuration()}
          useFallbackHeading={useFallbackHeading}
        />
      </Box>
    </ErrorBoundary>
  );
};

export default CameraView;
