// Path: features/ar/components/CameraView.tsx
import React, { useRef, useState, useEffect } from 'react';
import { Box, Typography, Button, CircularProgress, Snackbar, IconButton, Alert } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import BugReportIcon from '@mui/icons-material/BugReport';
import RefreshIcon from '@mui/icons-material/Refresh';
import CameraAltIcon from '@mui/icons-material/CameraAlt';

import { useCamera } from '../hooks/useCamera';
import { useGeolocation } from '../hooks/useGeolocation';
import { useDeviceOrientation } from '../hooks/useDeviceOrientation';
import { useScreenOrientation } from '../hooks/useScreenOrientation';
import AROverlay from './AROverlay';
import PermissionRequest from './PermissionRequest';
import AzimuthIndicator from './AzimuthIndicator';
import LoadingState from './LoadingState';
import { useLocationStore } from '../stores/locationStore';
import { useMarkersStore } from '../stores/markersStore';
import { useCameraStore } from '../stores/cameraStore';
import ErrorBoundary from './ErrorBoundary';

const CameraView: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const { orientation, dimensions } = useScreenOrientation();
  const [isInitializing, setIsInitializing] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showDebugMode, setShowDebugMode] = useState(false);
  const [forceOverrideMode, setForceOverrideMode] = useState(false);
  const initTimeoutRef = useRef<number | null>(null);
  const maxWaitTimeoutRef = useRef<number | null>(null);
  const startupTimestampRef = useRef(Date.now());

  // Get direct access to camera store's setActive function for overrides
  const { setActive } = useCameraStore();

  // Get data from stores
  const { heading } = useLocationStore();
  const { selectedMarkerId, setVisibleMarkers } = useMarkersStore();

  // Use hooks
  const {
    startCamera,
    requestCameraPermission,
    isActive,
    hasPermission: cameraPermission,
    error: cameraError,
    isTransitioning
  } = useCamera({ videoRef });

  const {
    coordinates,
    hasPermission: locationPermission,
    error: locationError
  } = useGeolocation();

  const {
    isCalibrated,
    errorMessage: orientationError,
    useFallbackHeading
  } = useDeviceOrientation();

  // Reset visible markers when component mounts
  useEffect(() => {
    setVisibleMarkers([]);
  }, [setVisibleMarkers]);

  // Cleanup function for timeouts
  const clearTimeouts = () => {
    if (initTimeoutRef.current) {
      clearTimeout(initTimeoutRef.current);
      initTimeoutRef.current = null;
    }
    if (maxWaitTimeoutRef.current) {
      clearTimeout(maxWaitTimeoutRef.current);
      maxWaitTimeoutRef.current = null;
    }
  };

  // Calculate how long the app has been initializing
  const getStartupDuration = () => {
    return Math.floor((Date.now() - startupTimestampRef.current) / 1000);
  };

  // Initialize app when permissions are granted
  useEffect(() => {
    // Check if we have all required permissions
    if (cameraPermission === true && locationPermission === true) {
      // Start camera if not already active
      if (!isActive && !forceOverrideMode) {
        startCamera();
      }
      
      // Set a timeout to move past initialization after a reasonable time
      if (initTimeoutRef.current === null) {
        initTimeoutRef.current = window.setTimeout(() => {
          console.log('Init timeout reached, continuing');
          setIsInitializing(false);
        }, 2500);
      }
      
      // Set absolute maximum wait time to prevent getting stuck
      if (maxWaitTimeoutRef.current === null) {
        maxWaitTimeoutRef.current = window.setTimeout(() => {
          console.log('Maximum wait time exceeded');
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
  }, [cameraPermission, locationPermission, isActive, startCamera, forceOverrideMode]);

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
  const enableOverrideMode = () => {
    console.log('OVERRIDE: Continuing without camera');
    setForceOverrideMode(true);
    setActive(true); // Pretend camera is active
  };

  // Force reload function for when things get stuck
  const handleForceReload = () => {
    window.location.reload();
  };

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
        <Box sx={{ padding: 2, height: '100vh', bgcolor: 'background.paper', overflow: 'auto' }}>
          <Typography variant="h5" gutterBottom>Debug Mode</Typography>
          
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle1">Status:</Typography>
            <Typography>Camera: {isActive ? 'Active' : 'Inactive'}</Typography>
            <Typography>Location: {coordinates.latitude ? 'Available' : 'Unavailable'}</Typography>
            <Typography>Heading: {heading !== null ? `${heading.toFixed(1)}°` : 'Unavailable'}</Typography>
            <Typography>Using Fallback: {useFallbackHeading ? 'Yes' : 'No'}</Typography>
            <Typography>Camera Permission: {cameraPermission === null ? 'Unknown' : cameraPermission ? 'Granted' : 'Denied'}</Typography>
            <Typography>Override Mode: {forceOverrideMode ? 'Enabled' : 'Disabled'}</Typography>
            <Typography>Initialization Time: {getStartupDuration()}s</Typography>
          </Box>
          
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle1">Coordinates:</Typography>
            <Typography>Latitude: {coordinates.latitude?.toFixed(6) || 'N/A'}</Typography>
            <Typography>Longitude: {coordinates.longitude?.toFixed(6) || 'N/A'}</Typography>
            <Typography>Accuracy: {coordinates.accuracy?.toFixed(1) || 'N/A'}m</Typography>
          </Box>
          
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mt: 2 }}>
            <Button 
              variant="contained" 
              onClick={() => setShowDebugMode(false)}
            >
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
                  setActive(true);
                  setForceOverrideMode(true);
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
            position: 'relative'
          }}
        >
          <LoadingState message="Initializing AR View..." />
          
          {/* Hidden video element to help with initialization */}
          <Box sx={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0, overflow: 'hidden' }}>
            <video ref={videoRef} autoPlay playsInline muted />
          </Box>
          
          <Box sx={{ position: 'absolute', bottom: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
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
            padding: 2
          }}
        >
          {/* Hidden video element to help with initialization */}
          <Box sx={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 0, height: 0, overflow: 'hidden' }}>
            <video ref={videoRef} autoPlay playsInline muted />
          </Box>
          
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
              Camera initialization is taking longer than expected. This may be due to browser restrictions 
              or hardware issues. You can try the options below.
            </Alert>
          )}
          
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, width: '100%', maxWidth: 350 }}>
            <Button
              variant="contained"
              color="primary"
              onClick={startCamera}
              startIcon={<CameraAltIcon />}
              fullWidth
            >
              Retry Camera
            </Button>
            
            <Button
              variant="outlined"
              onClick={() => setShowDebugMode(true)}
              startIcon={<BugReportIcon />}
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
          bgcolor: 'background.default' // Background color helps in override mode
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
              opacity: isTransitioning ? 0.5 : 1
            }}
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
              opacity: 0.7
            }}
          >
            <Typography variant="body2" color="white">
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

        {/* Debug mode button */}
        <Button
          variant="contained"
          size="small"
          onClick={() => setShowDebugMode(true)}
          startIcon={<BugReportIcon />}
          sx={{
            position: 'absolute',
            bottom: 16,
            right: 16,
            zIndex: 1000,
            opacity: 0.7
          }}
        >
          Debug
        </Button>
      </Box>
    </ErrorBoundary>
  );
};

export default CameraView;