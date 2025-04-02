// Path: features\ar\components\CameraView.tsx
import React, { useRef, useState, useEffect } from 'react';
import {
  Box,
  Button,
  Snackbar,
  Alert,
  Typography,
  CircularProgress,
  Backdrop,
  IconButton,
  Tooltip,
} from '@mui/material';
import BugReportIcon from '@mui/icons-material/BugReport';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import MyLocationIcon from '@mui/icons-material/MyLocation';

import { useAR } from '../hooks/useAR';
import { useScreenOrientation } from '../hooks/useScreenOrientation';
import AROverlay from './AROverlay';
import PermissionRequest from './PermissionRequest';
import AzimuthIndicator from './AzimuthIndicator';
import LoadingState from './LoadingState';
import { useARStore } from '../stores/arStore';
import ErrorBoundary from './ErrorBoundary';

/**
 * Improved camera view component with better error handling and UX
 * Specifically enhanced for Android compatibility
 */
const CameraView: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const { orientation, dimensions } = useScreenOrientation();
  const [showDebugMode, setShowDebugMode] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showMarkerMessage, setShowMarkerMessage] = useState(false);
  const [showLoading, setShowLoading] = useState(false);
  const [loadingTimeout, setLoadingTimeout] = useState<NodeJS.Timeout | null>(null);
  const [initializationTime, setInitializationTime] = useState(0);
  
  // Get data from store
  const { 
    selectedMarkerId, 
    markersGenerated, 
    allMarkers,
    refreshMarkers
  } = useARStore();
  
  // Use unified AR hook with improved capabilities
  const {
    // Camera
    startCamera,
    restartCamera,
    isCameraActive,
    cameraPermission,
    cameraError,
    isTransitioning,
    requestCameraPermission,
    
    // Location
    coordinates,
    heading,
    locationPermission,
    locationError,
    
    // Orientation
    isOrientationCalibrated,
    useFallbackHeading,
  } = useAR(videoRef);
  
  // Track initialization time
  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      setInitializationTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);
  
  // Handle marker refresh with loading state
  const handleRefreshMarkers = () => {
    setShowLoading(true);
    refreshMarkers();
    
    // Clear any existing timeout
    if (loadingTimeout) {
      clearTimeout(loadingTimeout);
    }
    
    // Set timeout to hide loading after 2 seconds
    const timeout = setTimeout(() => {
      setShowLoading(false);
    }, 2000);
    
    setLoadingTimeout(timeout);
  };
  
  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (loadingTimeout) {
        clearTimeout(loadingTimeout);
      }
    };
  }, [loadingTimeout]);
  
  // Set any error messages to display
  useEffect(() => {
    if (cameraError) {
      setErrorMessage(cameraError);
    } else if (locationError) {
      setErrorMessage(locationError);
    }
  }, [cameraError, locationError]);
  
  // Show markers generated message
  useEffect(() => {
    if (markersGenerated && allMarkers.length > 0) {
      setShowMarkerMessage(true);
      // Hide loading if it was showing
      setShowLoading(false);
      
      // Hide message after 4 seconds
      const timer = setTimeout(() => {
        setShowMarkerMessage(false);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [markersGenerated, allMarkers.length]);
  
  // Recover from errors by retrying camera access
  const handleRetry = () => {
    setErrorMessage(null);
    restartCamera();
  };
  
  // Debug view
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
          <Button 
            variant="contained" 
            onClick={() => setShowDebugMode(false)}
            sx={{ mb: 2 }}
          >
            RETURN TO AR VIEW
          </Button>
          
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>AR System Status</Typography>
            <Box component="ul" sx={{ pl: 2, mt: 0 }}>
              <li>Camera: {isCameraActive ? 'Active' : 'Inactive'}</li>
              <li>Camera Permission: {cameraPermission === true ? 'Granted' : cameraPermission === false ? 'Denied' : 'Unknown'}</li>
              <li>Location Permission: {locationPermission === true ? 'Granted' : locationPermission === false ? 'Denied' : 'Unknown'}</li>
              <li>Location: {coordinates.latitude ? 'Available' : 'Unavailable'}</li>
              <li>Location Accuracy: {coordinates.accuracy?.toFixed(1) || 'N/A'}m</li>
              <li>Heading: {heading !== null ? `${heading.toFixed(1)}°` : 'Unavailable'}</li>
              <li>Orientation Calibrated: {isOrientationCalibrated ? 'Yes' : 'No'}</li>
              <li>Using Fallback Heading: {useFallbackHeading ? 'Yes' : 'No'}</li>
              <li>Markers Generated: {markersGenerated ? 'Yes' : 'No'}</li>
              <li>Number of POIs: {allMarkers.length}</li>
              <li>Latitude: {coordinates.latitude?.toFixed(6) || 'N/A'}</li>
              <li>Longitude: {coordinates.longitude?.toFixed(6) || 'N/A'}</li>
            </Box>
          </Alert>
          
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
            <Button 
              variant="contained" 
              color="primary" 
              onClick={startCamera}
            >
              Restart Camera
            </Button>
            
            <Button 
              variant="contained" 
              color="secondary" 
              onClick={handleRefreshMarkers}
            >
              Refresh POIs
            </Button>
            
            <Button 
              variant="contained" 
              color="warning" 
              onClick={() => window.location.reload()}
            >
              Reload Page
            </Button>
          </Box>
          
          <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>All POIs</Typography>
          <Box sx={{ maxHeight: 300, overflow: 'auto', border: '1px solid rgba(255,255,255,0.1)', p: 1, borderRadius: 1 }}>
            {allMarkers.map(marker => (
              <Box key={marker.id} sx={{ mb: 1, p: 1, bgcolor: 'rgba(0,0,0,0.1)', borderRadius: 1 }}>
                <Typography variant="subtitle2">{marker.properties.name}</Typography>
                <Typography variant="caption" component="div">
                  Category: {marker.properties.category}
                </Typography>
                <Typography variant="caption" component="div">
                  Coordinates: [{marker.geometry.coordinates[1].toFixed(6)}, {marker.geometry.coordinates[0].toFixed(6)}]
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>
      </ErrorBoundary>
    );
  }
  
  // UI for when permissions haven't been granted
  if (cameraPermission === false || locationPermission === false) {
    return (
      <ErrorBoundary>
        <PermissionRequest
          cameraPermission={cameraPermission}
          locationPermission={locationPermission}
          cameraError={cameraError}
          locationError={locationError}
          onRequestPermissions={requestCameraPermission}
        />
      </ErrorBoundary>
    );
  }
  
  // Loading state
  if (!isCameraActive || isTransitioning) {
    return (
      <ErrorBoundary>
        <LoadingState message={
          isTransitioning 
            ? "Starting camera..." 
            : initializationTime > 10
              ? "AR initialization is taking longer than usual..."
              : "Initializing AR View..."
        } />
        
        {/* Hidden video element to help with initialization */}
        <Box sx={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 2, height: 2, overflow: 'hidden' }}>
          <video ref={videoRef} autoPlay playsInline muted style={{ width: 1, height: 1 }} />
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
          bgcolor: 'background.default',
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
            isCalibrated={isOrientationCalibrated}
          />
        )}
        
        {/* Refresh location button */}
        {!selectedMarkerId && (
          <Tooltip title="Refresh nearby places">
            <IconButton
              color="primary"
              onClick={handleRefreshMarkers}
              sx={{
                position: 'absolute',
                top: 16,
                left: 16,
                zIndex: 1000,
                bgcolor: 'rgba(0,0,0,0.4)',
                '&:hover': {
                  bgcolor: 'rgba(0,0,0,0.6)',
                },
                boxShadow: 2,
              }}
            >
              <MyLocationIcon />
            </IconButton>
          </Tooltip>
        )}
        
        {/* Error message */}
        <Snackbar
          open={!!errorMessage}
          autoHideDuration={6000}
          onClose={() => setErrorMessage(null)}
          anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        >
          <Alert 
            severity="error"
            sx={{ width: '100%' }}
            action={
              <Button color="inherit" size="small" onClick={handleRetry}>
                Retry
              </Button>
            }
          >
            {errorMessage}
          </Alert>
        </Snackbar>
        
        {/* Fallback mode indicator */}
        {useFallbackHeading && (
          <Alert 
            severity="info"
            sx={{
              position: 'absolute',
              top: orientation === 'portrait' ? 70 : 16,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 50,
              maxWidth: '80%',
              opacity: 0.9,
              backdropFilter: 'blur(4px)',
            }}
          >
            Demo mode - simulated compass. Your device compass may not be available.
          </Alert>
        )}
        
        {/* Marker generation notice */}
        <Snackbar
          open={showMarkerMessage}
          autoHideDuration={4000}
          onClose={() => setShowMarkerMessage(false)}
          anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        >
          <Alert 
            severity="success" 
            icon={<LocationOnIcon />}
            sx={{ width: '100%' }}
          >
            <Typography variant="body2">
              {allMarkers.length} pontos de interesse gerados ao seu redor!
            </Typography>
            <Typography variant="caption">
              Gire a câmera para encontrá-los
            </Typography>
          </Alert>
        </Snackbar>
        
        {/* Loading backdrop for marker refresh */}
        <Backdrop
          sx={{ 
            color: '#fff', 
            zIndex: 9999,
            backdropFilter: 'blur(4px)',
            backgroundColor: 'rgba(0,0,0,0.4)'
          }}
          open={showLoading}
        >
          <Box sx={{ textAlign: 'center' }}>
            <CircularProgress color="primary" />
            <Typography sx={{ mt: 2 }}>Updating nearby places...</Typography>
          </Box>
        </Backdrop>
        
        {/* Debug mode button */}
        <Tooltip title="Debug Mode">
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
              minWidth: 0,
              p: 1,
            }}
          >
            Debug
          </Button>
        </Tooltip>
      </Box>
    </ErrorBoundary>
  );
};

export default CameraView;