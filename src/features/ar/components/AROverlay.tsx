// Path: features\ar\components\AROverlay.tsx
import React, { useMemo } from 'react';
import { Box } from '@mui/material';
import { useARStore } from '../stores/arStore';
import {
  getVisibleMarkers,
  calculateMarkerPosition,
  calculateMarkerSize,
  calculateVerticalOffset,
} from '../utils/arUtils';
import Marker from './Marker';
import InfoCard from './InfoCard';

interface AROverlayProps {
  latitude: number;
  longitude: number;
  heading: number;
  orientation: 'portrait' | 'landscape';
  dimensions: {
    width: number;
    height: number;
  };
}

/**
 * Improved AR overlay component that displays markers over the camera feed
 * with better positioning logic and performance optimizations
 */
const AROverlay: React.FC<AROverlayProps> = ({
  latitude,
  longitude,
  heading,
  orientation,
  dimensions,
}) => {
  const {
    allMarkers,
    visibleMarkers,
    selectedMarkerId,
    setVisibleMarkers,
    refreshMarkers,
  } = useARStore();

  const isTablet = dimensions.width >= 768;

  // Determine field of view and marker size based on device and camera specs
  const { fieldOfView, baseMarkerSize } = useMemo(() => {
    // Get estimated field of view based on device type and orientation
    // These values are approximations and should be calibrated for actual devices
    const getEstimatedFOV = () => {
      // Check if device is probably an ultrawide camera phone
      const isUltrawide = dimensions.width > 1000 || dimensions.height > 1000;

      if (isTablet) {
        // Tablet cameras typically have narrower FOV
        return orientation === 'landscape'
          ? isUltrawide
            ? 70
            : 60
          : isUltrawide
            ? 60
            : 50;
      } else {
        // Phone cameras typically have wider FOV
        return orientation === 'landscape'
          ? isUltrawide
            ? 80
            : 70
          : isUltrawide
            ? 70
            : 60;
      }
    };

    // Adjust marker size based on screen density and size
    const getBaseMarkerSize = () => {
      const screenDensity = window.devicePixelRatio || 1;
      const baseSizeByDevice = isTablet ? 70 : 60;

      // Scale by device pixel ratio but with a cap to prevent huge markers on high DPI
      return Math.min(baseSizeByDevice * Math.min(screenDensity, 1.5), 90);
    };

    return {
      fieldOfView: getEstimatedFOV(),
      baseMarkerSize: getBaseMarkerSize(),
    };
  }, [dimensions, orientation, isTablet]);

  // Get visible markers based on location and heading with caching
  useMemo(() => {
    if (latitude && longitude && heading !== undefined) {
      // Only recalculate if we have valid data
      const maxDistance = isTablet ? 600 : 500;
      const maxMarkers = isTablet ? 12 : 8;

      const markers = getVisibleMarkers(
        allMarkers,
        latitude,
        longitude,
        heading,
        maxDistance,
        fieldOfView,
        maxMarkers,
      );

      setVisibleMarkers(markers);
    }
  }, [
    // Only recalculate on significant changes
    allMarkers,
    fieldOfView,
    // Round heading to nearest 5 degrees to prevent excessive recalculation
    Math.round(heading / 5) * 5,
    isTablet,
    latitude,
    longitude,
    setVisibleMarkers,
  ]);

  // Process markers to position them on screen with improved layout
  const processedMarkers = useMemo(() => {
    if (!visibleMarkers.length) return [];

    return visibleMarkers
      .map((marker, index) => {
        // Calculate horizontal position (0-1) with improved edge handling
        const position = calculateMarkerPosition(
          marker.bearing,
          heading,
          fieldOfView,
        );

        // Calculate size based on distance with smoother scaling
        const size = calculateMarkerSize(marker.distance, baseMarkerSize);

        // Calculate vertical offset using more sophisticated algorithm
        // to minimize overlapping markers
        const verticalOffset = calculateVerticalOffset(
          index,
          marker.bearing,
          marker.distance,
          size,
        );

        return {
          marker,
          position,
          size,
          verticalOffset,
        };
      })
      .sort((a, b) => a.marker.distance - b.marker.distance);
  }, [visibleMarkers, heading, fieldOfView, baseMarkerSize]);

  // Find the selected marker
  const selectedMarker = useMemo(() => {
    return visibleMarkers.find(marker => marker.id === selectedMarkerId);
  }, [visibleMarkers, selectedMarkerId]);

  // Handle location refresh when AR view is active
  const handleRefreshLocation = () => {
    refreshMarkers();
  };

  return (
    <Box
      sx={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
      }}
    >
      {/* Render markers */}
      {processedMarkers.map(({ marker, position, size, verticalOffset }) => (
        <Box
          key={marker.id}
          sx={{
            position: 'absolute',
            left: `${position * 100}%`,
            top: '50%',
            transform: `translate(-50%, -50%) translateY(${verticalOffset}px)`,
            zIndex: marker.distance < 100 ? 20 : 10,
            transition: 'transform 0.2s ease-out, left 0.3s ease-out',
          }}
        >
          <Marker size={size} marker={marker} />
        </Box>
      ))}

      {/* Show info card for selected marker */}
      {selectedMarker && (
        <Box
          sx={{
            position: 'absolute',
            ...(orientation === 'landscape'
              ? {
                  right: 16,
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: isTablet ? '35%' : '45%',
                }
              : {
                  bottom: 16,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: isTablet ? '70%' : '90%',
                }),
            maxWidth: orientation === 'landscape' ? 400 : 500,
            zIndex: 100,
            opacity: 1,
            transition: 'opacity 0.2s ease-in',
          }}
        >
          <InfoCard
            marker={selectedMarker}
            orientation={orientation}
            isTablet={isTablet}
            onRefreshLocation={handleRefreshLocation}
          />
        </Box>
      )}
    </Box>
  );
};

export default React.memo(AROverlay);
