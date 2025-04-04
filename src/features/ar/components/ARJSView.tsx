// Path: features\ar\components\ARJSView.tsx
import React, { useEffect, useRef, useState } from 'react';
import { Box, Button, Snackbar, Alert, Typography } from '@mui/material';
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

// Note: Removed the problematic isMobile override
// AFRAME.utils.device.isMobile = function () { return true; };

/**
 * AR.js View component for location-based AR
 */
const ARJSView: React.FC = () => {
  // Using RefObject<any> as a workaround for the Scene component ref
  const sceneRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showDebugMode, setShowDebugMode] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showMarkerMessage, setShowMarkerMessage] = useState(false);
  const [permissionsGranted, setPermissionsGranted] = useState(false);
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
      await navigator.mediaDevices.getUserMedia({ video: true });
      setPermissionsGranted(true);
      setIsLoading(false);
    } catch (error) {
      setPermissionsGranted(false);
      setErrorMessage("Camera permission denied");
    }
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
            Accuracy: {coordinates.accuracy?.toFixed(1) || 'N/A'}m
          </Alert>
          
          <Button 
            variant="contained" 
            color="warning" 
            onClick={() => window.location.reload()}
          >
            Reload Page
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
            performanceProfile: 'lowpower'
          }}
          vr-mode-ui={{ enabled: false }}
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

        {/* Compass indicator */}
        {!selectedMarkerId && heading !== null && (
          <AzimuthIndicator
            heading={heading}
            isLandscape={orientation === 'landscape'}
            isCalibrated={true}
          />
        )}

        {/* Marker UI Overlay */}
        <ARMarkerOverlay 
          markers={visibleMarkers}
          orientation={orientation}
          dimensions={dimensions}
          heading={heading || 0}
        />

        {/* Info Card for selected marker */}
        {selectedMarkerId && (
          <ARJSOverlay
            orientation={orientation}
            dimensions={dimensions}
          />
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