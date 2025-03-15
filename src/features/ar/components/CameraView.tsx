// Path: features\ar\components\CameraView.tsx
import React, { useRef, useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  Snackbar,
  IconButton,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import BugReportIcon from '@mui/icons-material/BugReport';

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
import ErrorBoundary from './ErrorBoundary';

const CameraView: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const { orientation, dimensions } = useScreenOrientation();
  const [isInitializing, setIsInitializing] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showDebugMode, setShowDebugMode] = useState(false);

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
    isTransitioning,
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

  // Reset visible markers when component mounts
  useEffect(() => {
    setVisibleMarkers([]);
  }, [setVisibleMarkers]);

  // Initialize app when permissions are granted
  useEffect(() => {
    // Check if we have all required permissions
    if (cameraPermission === true && locationPermission === true) {
      // Start camera if not already active
      if (!isActive) {
        startCamera();
      }

      // After a short delay, consider initialization complete
      const timer = setTimeout(() => {
        setIsInitializing(false);
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [cameraPermission, locationPermission, isActive, startCamera]);

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

          <Button
            variant="contained"
            onClick={() => setShowDebugMode(false)}
            sx={{ mt: 2 }}
          >
            Return to AR View
          </Button>
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
          }}
        >
          <LoadingState message="Initializing AR View..." />

          <Button
            variant="outlined"
            size="small"
            onClick={() => setIsInitializing(false)}
            sx={{ position: 'absolute', bottom: 16 }}
          >
            Continue Anyway
          </Button>
        </Box>
      </ErrorBoundary>
    );
  }

  // If camera isn't active but we've passed initialization, show a loading spinner
  if (!isActive) {
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
          <CircularProgress />
          <Typography variant="body1" sx={{ mt: 2 }}>
            Starting camera...
          </Typography>

          <Button variant="contained" onClick={startCamera} sx={{ mt: 2 }}>
            Retry Camera
          </Button>
        </Box>
      </ErrorBoundary>
    );
  }

  // Main AR view
  return (
    <ErrorBoundary>
      <Box
        sx={{
          position: 'relative',
          width: '100%',
          height: '100%',
          overflow: 'hidden',
        }}
      >
        {/* Camera video element */}
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
            transition: isTransitioning ? 'opacity 0.3s' : 'none',
            opacity: isTransitioning ? 0.5 : 1,
          }}
        />

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
            opacity: 0.7,
          }}
        >
          Debug
        </Button>
      </Box>
    </ErrorBoundary>
  );
};

export default CameraView;
