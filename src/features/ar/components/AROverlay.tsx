// Path: features\ar\components\AROverlay.tsx
import React, { useMemo } from 'react';
import { Box, useTheme, SxProps, Theme } from '@mui/material';
import { useMarkersStore } from '../stores/markersStore';
import { getVisibleMarkers } from '../utils/distanceCalculations';
import {
  calculateMarkerPosition,
  calculateMarkerSize,
} from '../utils/arCalculations';
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

interface AdjustedMarker {
  marker: any;
  position: number;
  size: number;
  verticalOffset: number;
}

/**
 * Simplified component that displays AR markers over the camera feed
 */
const AROverlay: React.FC<AROverlayProps> = ({
  latitude,
  longitude,
  heading,
  orientation,
  dimensions,
}) => {
  const theme = useTheme();
  const { allMarkers, visibleMarkers, selectedMarkerId, setVisibleMarkers } =
    useMarkersStore();

  // Detect device type
  const { isTablet, fieldOfView, baseMarkerSize } = useMemo(() => {
    const isTablet = dimensions.width >= 768;

    // Adjust field of view based on device and orientation
    const fieldOfView = isTablet
      ? orientation === 'landscape'
        ? 65
        : 55
      : orientation === 'landscape'
        ? 70
        : 60;

    // Adjust marker size based on device
    const baseMarkerSize = isTablet ? 70 : 60;

    return { isTablet, fieldOfView, baseMarkerSize };
  }, [dimensions.width, orientation]);

  // Get visible markers based on location and heading
  useMemo(() => {
    if (latitude && longitude && heading !== undefined) {
      // Max distance depends on device size
      const maxDistance = isTablet ? 600 : 500;

      // Max markers depends on device size
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
    allMarkers,
    fieldOfView,
    heading,
    isTablet,
    latitude,
    longitude,
    setVisibleMarkers,
  ]);

  // Process markers to position them on screen
  const processedMarkers = useMemo(() => {
    if (!visibleMarkers.length) return [];

    const markers: AdjustedMarker[] = [];

    // Position each marker
    visibleMarkers.forEach(marker => {
      // Calculate horizontal position (0-1)
      const horizontalPosition = calculateMarkerPosition(
        marker.bearing,
        heading,
        fieldOfView,
      );

      // Calculate size based on distance
      const size = calculateMarkerSize(marker.distance, baseMarkerSize);

      // Calculate vertical offset to avoid overlaps
      // This is a simplified approach - just using distance to stagger markers
      const verticalOffset = (marker.distance % 100) - 50;

      markers.push({
        marker,
        position: horizontalPosition,
        size,
        verticalOffset,
      });
    });

    // Sort by distance so closer markers appear on top
    return markers.sort((a, b) => a.marker.distance - b.marker.distance);
  }, [visibleMarkers, heading, fieldOfView, baseMarkerSize]);

  // Find the selected marker
  const selectedMarker = useMemo(() => {
    return visibleMarkers.find(marker => marker.id === selectedMarkerId);
  }, [visibleMarkers, selectedMarkerId]);

  // Calculate InfoCard position based on orientation
  const infoCardPosition = useMemo((): SxProps<Theme> => {
    if (orientation === 'landscape') {
      return {
        position: 'absolute',
        right: theme.spacing(2),
        top: '50%',
        transform: 'translateY(-50%)',
        width: isTablet ? '35%' : '45%',
        maxWidth: 400,
        maxHeight: '80vh',
        overflowY: 'auto',
        zIndex: 100,
      };
    } else {
      return {
        position: 'absolute',
        bottom: theme.spacing(2),
        left: '50%',
        transform: 'translateX(-50%)',
        width: isTablet ? '70%' : '90%',
        maxWidth: 500,
        zIndex: 100,
      };
    }
  }, [orientation, theme, isTablet]);

  return (
    <Box
      sx={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        userSelect: 'none',
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
            zIndex: 10,
          }}
        >
          <Marker
            position={position}
            size={size}
            marker={marker}
            deviceSize={dimensions}
          />
        </Box>
      ))}

      {/* Show info card for selected marker */}
      {selectedMarker && (
        <Box sx={infoCardPosition}>
          <InfoCard
            marker={selectedMarker}
            orientation={orientation}
            isTablet={isTablet}
          />
        </Box>
      )}
    </Box>
  );
};

export default AROverlay;
