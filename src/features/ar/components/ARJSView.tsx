// Path: features\ar\components\ARJSView.tsx
import React, { useEffect, useRef, useState } from 'react';
import { Box, Button, Snackbar, Alert, Typography, Modal } from '@mui/material';
import BugReportIcon from '@mui/icons-material/BugReport';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import 'aframe';
import 'ar.js/aframe/build/aframe-ar';
import { Entity, Scene } from 'aframe-react';

import { useARStore } from '../stores/arStore';
import PermissionRequest from './PermissionRequest';
import LoadingState from './LoadingState';
import ErrorBoundary from './ErrorBoundary';
import ARJSOverlay from './ARJSOverlay';
import ARMarkerOverlay from './ARMarkerOverlay';
import AzimuthIndicator from './AzimuthIndicator';
import { useScreenOrientation } from '../hooks/useScreenOrientation';

/**
 * AR.js View component for location-based AR
 */
const ARJSView: React.FC = () => {
  // Using RefObject<any> as a workaround for the Scene component ref
  const sceneRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showDebugMode, setShowDebugMode] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showCameraError, setShowCameraError] = useState(false);
  const [cameraErrorDetails, setCameraErrorDetails] = useState<string>("");
  const [showMarkerMessage, setShowMarkerMessage] = useState(false);
  const [permissionsGranted, setPermissionsGranted] = useState(false);
  const [cameraRetryCount, setCameraRetryCount] = useState(0);
  const { orientation, dimensions } = useScreenOrientation();

  // Get data from store
  const { 
    coordinates,
    heading,
    selectedMarkerId, 
    markersGenerated, 
    allMarkers,
    visibleMarkers,
    setCoordinates,
    setHeading,
    selectMarker,
    generateMarkersAtLocation,
    updateVisibleMarkers
  } = useARStore();

  // Initialize location tracking
  useEffect(() => {
    if (!navigator.geolocation) {
      setErrorMessage("Geolocation is not supported by your browser");
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setCoordinates(
          position.coords.latitude,
          position.coords.longitude,
          position.coords.accuracy
        );
        setPermissionsGranted(true);
        
        // Generate markers if not already generated
        if (!markersGenerated && position.coords.latitude && position.coords.longitude) {
          generateMarkersAtLocation(position.coords.latitude, position.coords.longitude);
        }
      },
      (error) => {
        let message = "Location error";
        
        if (error.code === 1) { // PERMISSION_DENIED
          message = "Location permission denied";
          setPermissionsGranted(false);
        } else if (error.code === 2) { // POSITION_UNAVAILABLE
          message = "Location unavailable";
        } else if (error.code === 3) { // TIMEOUT
          message = "Location request timed out";
        }
        
        setErrorMessage(message);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10000
      }
    );
    
    return () => navigator.geolocation.clearWatch(watchId);
  }, [markersGenerated, setCoordinates, generateMarkersAtLocation]);

  // Handle device orientation for heading
  useEffect(() => {
    const handleOrientation = (event: DeviceOrientationEvent) => {
      if (event.alpha !== null) {
        // Alpha value gives us the compass heading (0-360)
        // We need to normalize the value
        const heading = 360 - event.alpha;
        setHeading(heading);
      }
    };

    window.addEventListener('deviceorientation', handleOrientation, true);
    
    return () => {
      window.removeEventListener('deviceorientation', handleOrientation, true);
    };
  }, [setHeading]);

  // Monitor and handle camera errors from A-Frame
  useEffect(() => {
    // Helper to capture camera errors from A-Frame/AR.js
    const handleCameraError = (error: ErrorEvent) => {
      // Check if it's a camera-related error from AR.js
      if (error.message && (
          error.message.includes('camera') || 
          error.message.includes('video') || 
          error.message.includes('getUserMedia') ||
          error.message.includes('NotReadableError')
        )) {
        console.error('Camera error detected:', error);
        setCameraErrorDetails(error.message || "Camera access error");
        setShowCameraError(true);
        setIsLoading(false);
      }
    };

    // Listen for AR.js specific errors
    window.addEventListener('error', handleCameraError);
    
    // Also set up a specific handler for A-Frame's camera errors
    if (typeof window !== 'undefined' && window.AFRAME) {
      const onArError = (ev: any) => {
        if (ev.detail && ev.detail.error) {
          handleCameraError(new ErrorEvent('error', {
            message: `AR.js: ${ev.detail.error}`
          }));
        }
      };
      document.addEventListener('ar-camera-error', onArError);
      return () => {
        window.removeEventListener('error', handleCameraError);
        document.removeEventListener('ar-camera-error', onArError);
      };
    }
    
    return () => {
      window.removeEventListener('error', handleCameraError);
    };
  }, []);

  // Set up communication bridge with AR.js
  useEffect(() => {
    // Bridge between React and AR.js
    window.arjsEventHandlers = {
      onMarkerSelect: (markerId) => {
        selectMarker(markerId);
      }
    };

    return () => {
      delete window.arjsEventHandlers;
    };
  }, [selectMarker]);

  // Handle camera permissions
  const requestCameraPermission = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ 
        video: {
          facingMode: 'environment' // Prefer back camera
        } 
      });
      setPermissionsGranted(true);
      setIsLoading(false);
      setShowCameraError(false);
      setCameraRetryCount(0);
    } catch (error) {
      console.error('Camera permission error:', error);
      setPermissionsGranted(false);
      setErrorMessage("Camera permission denied");
      if (error instanceof Error) {
        setCameraErrorDetails(error.message);
      }
    }
  };

  // Handle camera retry
  const retryCameraAccess = async () => {
    setShowCameraError(false);
    setIsLoading(true);
    setCameraRetryCount(prev => prev + 1);
    
    // Release camera if possible before retrying
    try {
      const tracks = await navigator.mediaDevices.getUserMedia({ video: true });
      tracks.getTracks().forEach(track => track.stop());
    } catch (e) {
      // Ignore errors here, just trying to release the camera
    }
    
    // Wait a moment and retry
    setTimeout(() => {
      requestCameraPermission();
    }, 1000);
  };

  // Show markers generated message
  useEffect(() => {
    if (markersGenerated && allMarkers.length > 0) {
      setShowMarkerMessage(true);
      // Hide message after 4 seconds
      const timer = setTimeout(() => {
        setShowMarkerMessage(false);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [markersGenerated, allMarkers.length]);

  // Initialize AR.js
  useEffect(() => {
    if (sceneRef.current) {
      // AR.js initialization logic - executed after scene is ready
      const timer = setTimeout(() => {
        setIsLoading(false);
        updateVisibleMarkers();
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [sceneRef, updateVisibleMarkers]);

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
            AR.js Mode: Active<br />
            Location: {coordinates.latitude ? 'Available' : 'Unavailable'}<br />
            Heading: {heading !== null ? `${heading.toFixed(1)}°` : 'Unavailable'}<br />
            Markers Generated: {markersGenerated ? 'Yes' : 'No'}<br />
            Number of POIs: {allMarkers.length}<br />
            Visible Markers: {visibleMarkers.length}<br />
            Latitude: {coordinates.latitude?.toFixed(6) || 'N/A'}<br />
            Longitude: {coordinates.longitude?.toFixed(6) || 'N/A'}<br />
            Accuracy: {coordinates.accuracy?.toFixed(1) || 'N/A'}m<br />
            Camera Retries: {cameraRetryCount}
          </Alert>
          
          <Button 
            variant="contained" 
            color="warning" 
            onClick={() => window.location.reload()}
          >
            Reload Page
          </Button>
          
          <Button 
            variant="contained" 
            color="primary" 
            onClick={retryCameraAccess}
            sx={{ ml: 2 }}
          >
            Retry Camera
          </Button>
        </Box>
      </ErrorBoundary>
    );
  }

  // UI for when permissions haven't been granted
  if (!permissionsGranted) {
    return (
      <ErrorBoundary>
        <PermissionRequest
          cameraPermission={permissionsGranted}
          locationPermission={coordinates.latitude !== null}
          cameraError={errorMessage}
          locationError={errorMessage}
          onRequestPermissions={requestCameraPermission}
        />
      </ErrorBoundary>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <ErrorBoundary>
        <LoadingState message="Initializing AR View..." />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <Box sx={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
        {/* AR.js Scene */}
        <Scene
          ref={sceneRef}
          embedded
          arjs={{
            sourceType: 'webcam',
            trackingMethod: 'best',
            debugUIEnabled: false,
            areaLearningButton: false,
            detectionMode: 'mono_and_matrix',
            matrixCodeType: '3x3',
            patternRatio: 0.5,
            sourceWidth: dimensions.width,
            sourceHeight: dimensions.height,
            displayWidth: dimensions.width,
            displayHeight: dimensions.height,
            // Enhanced mobile performance settings
            maxDetectionRate: 30,
            canvasWidth: dimensions.width,
            canvasHeight: dimensions.height,
            performanceProfile: 'lowpower',
            facingMode: 'environment' // Prefer back camera
          }}
          vr-mode-ui={{ enabled: false }} // Disable VR mode UI
          renderer={{ 
            logarithmicDepthBuffer: true, 
            alpha: true,
            antialias: false, // Disable antialiasing for better performance
            precision: 'mediump', // Use medium precision for shaders
            powerPreference: 'high-performance'
          }}
          style={{
            zIndex: 0,
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
          }}
        >
          {/* Camera */}
          <Entity 
            primitive="a-camera" 
            gps-camera={{ 
              simulateLatitude: coordinates.latitude, 
              simulateLongitude: coordinates.longitude,
              gpsMinDistance: 5,
              gpsTimeInterval: 1000
            }} 
          />

          {/* AR content - POI markers */}
          {markersGenerated && coordinates.latitude && coordinates.longitude && allMarkers.map(marker => {
            const [lng, lat] = marker.geometry.coordinates;
            // Only create entities for markers in the current visible list
            const isVisible = visibleMarkers.some(visibleMarker => visibleMarker.id === marker.id);
            
            if (!isVisible) return null;
            
            return (
              <Entity
                key={marker.id}
                primitive="a-box"
                gps-entity-place={`latitude: ${lat}; longitude: ${lng};`}
                material={{ color: '#2196f3' }}
                position={{ x: 0, y: 0, z: 0 }}
                scale={{ x: 0.5, y: 0.5, z: 0.5 }}
                look-at="[gps-camera]"
                animation__click={{ 
                  property: 'scale', 
                  startEvents: 'click', 
                  easing: 'easeInCubic', 
                  dur: 150, 
                  from: '0.5 0.5 0.5', 
                  to: '1 1 1' 
                }}
                animation__clickend={{ 
                  property: 'scale', 
                  startEvents: 'mouseup', 
                  easing: 'easeOutCubic', 
                  dur: 150, 
                  from: '1 1 1', 
                  to: '0.5 0.5 0.5' 
                }}
                gps-entity-click-handler
                data-marker-id={marker.id}
                data-marker-name={marker.properties.name}
                data-marker-category={marker.properties.category}
              />
            );
          })}
        </Scene>

        {/* Compass indicator - only show when no marker is selected */}
        {!selectedMarkerId && heading !== null && (
          <AzimuthIndicator
            heading={heading}
            isLandscape={orientation === 'landscape'}
            isCalibrated={true}
          />
        )}

        {/* Marker UI Overlay - Only show when no marker is selected */}
        {!selectedMarkerId && (
          <ARMarkerOverlay 
            markers={visibleMarkers}
            orientation={orientation}
            dimensions={dimensions}
            heading={heading || 0}
          />
        )}

        {/* Info Card for selected marker as Modal */}
        {selectedMarkerId && (
          <Modal
            open={!!selectedMarkerId}
            onClose={() => selectMarker(null)}
            aria-labelledby="marker-info-modal"
            aria-describedby="marker-information-details"
            sx={{
              display: 'flex',
              alignItems: orientation === 'landscape' ? 'center' : 'flex-end',
              justifyContent: 'center',
              p: 2,
            }}
            BackdropProps={{
              sx: { backgroundColor: 'rgba(0,0,0,0.5)' }
            }}
          >
            <Box
              sx={{
                width: orientation === 'landscape' 
                  ? (dimensions.width >= 768 ? '40%' : '60%')
                  : (dimensions.width >= 768 ? '70%' : '90%'),
                maxWidth: 500,
                outline: 'none',
              }}
            >
              <ARJSOverlay
                orientation={orientation}
                dimensions={dimensions}
              />
            </Box>
          </Modal>
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

        {/* Camera Error Dialog */}
        <Modal
          open={showCameraError}
          onClose={() => setShowCameraError(false)}
          aria-labelledby="camera-error-dialog"
        >
          <Box sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '85%',
            maxWidth: 400,
            bgcolor: 'background.paper',
            borderRadius: 2,
            boxShadow: 24,
            p: 3,
          }}>
            <Typography variant="h6" component="h2" sx={{ mb: 2 }}>
              Webcam Error
            </Typography>
            <Typography variant="body2" sx={{ mb: 2 }}>
              {cameraErrorDetails || "Could not start video source"}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              This may happen if another app is using your camera or if permissions were denied.
            </Typography>
            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between' }}>
              <Button variant="outlined" onClick={() => setShowCameraError(false)}>
                Ignore
              </Button>
              <Button variant="contained" onClick={retryCameraAccess}>
                Retry Camera
              </Button>
              <Button variant="outlined" color="info" onClick={() => setShowDebugMode(true)}>
                Debug Mode
              </Button>
            </Box>
          </Box>
        </Modal>

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

export default ARJSView;