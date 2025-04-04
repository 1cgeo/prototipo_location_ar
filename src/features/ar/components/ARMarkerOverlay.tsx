// Path: features\ar\components\ARMarkerOverlay.tsx
import React, { useMemo } from 'react';
import { Box, Typography, Tooltip, alpha } from '@mui/material';
import RestaurantIcon from '@mui/icons-material/Restaurant';
import StoreIcon from '@mui/icons-material/Store';
import MuseumIcon from '@mui/icons-material/Museum';
import LocalPharmacyIcon from '@mui/icons-material/LocalPharmacy';
import DirectionsSubwayIcon from '@mui/icons-material/DirectionsSubway';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import ExploreIcon from '@mui/icons-material/Explore';
import { MarkerWithDistance } from '../schemas/markerSchema';
import { useARStore } from '../stores/arStore';
import { formatDistance, calculateMarkerPosition } from '../utils/arjsUtils';

interface ARMarkerOverlayProps {
  markers: MarkerWithDistance[];
  heading: number;
  orientation: 'portrait' | 'landscape';
  dimensions: {
    width: number;
    height: number;
  };
}

/**
 * UI overlay that shows marker labels and information on top of AR.js scene
 */
const ARMarkerOverlay: React.FC<ARMarkerOverlayProps> = ({
  markers,
  heading,
  orientation,
  dimensions
}) => {
  const { selectMarker } = useARStore();
  const isTablet = dimensions.width >= 768;
  
  // Determine field of view based on device
  const fieldOfView = useMemo(() => {
    return isTablet
      ? orientation === 'landscape' ? 65 : 55
      : orientation === 'landscape' ? 70 : 60;
  }, [dimensions.width, orientation, isTablet]);
  
  // Process markers to position them on screen with improved spacing
  const processedMarkers = useMemo(() => {
    if (!markers.length) return [];
    
    // Sort by distance first (closer markers are more important)
    const sortedMarkers = [...markers].sort((a, b) => a.distance - b.distance);
    
    // Take only a reasonable number of markers to prevent overcrowding
    // and prioritize nearby markers
    const MAX_VISIBLE_MARKERS = 8;
    const limitedMarkers = sortedMarkers.slice(0, MAX_VISIBLE_MARKERS);
    
    return limitedMarkers.map((marker, index) => {
      // Calculate horizontal position (0-1)
      const position = calculateMarkerPosition(
        marker.bearing,
        heading,
        fieldOfView
      );
      
      // Calculate size based on distance (closer = bigger)
      const maxSize = isTablet ? 60 : 50;
      const minSize = isTablet ? 40 : 34;
      const sizeFactor = Math.max(0.1, Math.min(1.0, 1 - (marker.distance / 500)));
      const size = minSize + (maxSize - minSize) * sizeFactor;
      
      // Distribute markers vertically to avoid overlaps
      // Use distance and index in a formula that staggers them
      const verticalPosition = (index % 3) * 0.2 - 0.2; // -0.2, 0, 0.2
      
      return {
        marker,
        position,
        size,
        verticalPosition
      };
    });
  }, [markers, heading, fieldOfView, isTablet]);
  
  // Get category icon
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'restaurante':
        return <RestaurantIcon />;
      case 'loja':
        return <StoreIcon />;
      case 'atracao':
        return <MuseumIcon />;
      case 'servico':
        return <LocalPharmacyIcon />;
      case 'transporte':
        return <DirectionsSubwayIcon />;
      default:
        return <LocationOnIcon />;
    }
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
        zIndex: 10,
      }}
    >
      {/* Render marker UI elements */}
      {processedMarkers.map(({ marker, position, size, verticalPosition }) => {
        // Calculate opacity based on distance (farther = more transparent)
        const opacity = Math.max(0.4, Math.min(1, 1 - marker.distance / 500));
        const isPulsingMarker = marker.distance < 100;
        const formattedDistance = formatDistance(marker.distance);
        
        return (
          <Box
            key={marker.id}
            sx={{
              position: 'absolute',
              left: `${position * 100}%`,
              top: `${50 + verticalPosition * 100}%`,
              transform: 'translate(-50%, -50%)',
              zIndex: 20,
              pointerEvents: 'auto',
              cursor: 'pointer',
            }}
            onClick={() => selectMarker(marker.id)}
          >
            <Tooltip
              title={`${marker.properties.name} - ${formattedDistance}`}
              placement="top"
              arrow
            >
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  transition: 'transform 0.2s ease-out',
                  '&:hover': {
                    transform: 'scale(1.1)',
                  },
                }}
              >
                {/* Marker icon */}
                <Box
                  sx={{
                    backgroundColor: 'primary.main',
                    color: 'primary.contrastText',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: size,
                    height: size,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                    border: '2px solid white',
                    opacity,
                    animation: isPulsingMarker ? 'pulse 2s infinite' : 'none',
                  }}
                >
                  {getCategoryIcon(marker.properties.category)}
                </Box>
                
                {/* Marker label */}
                <Box
                  sx={{
                    backgroundColor: alpha('#000000', 0.7),
                    color: 'white',
                    padding: '4px 8px',
                    borderRadius: 1,
                    marginTop: 0.5,
                    textAlign: 'center',
                    opacity,
                    backdropFilter: 'blur(4px)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    maxWidth: '150px',
                  }}
                >
                  <Typography
                    variant="caption"
                    sx={{
                      display: 'block',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      fontWeight: 500,
                      lineHeight: 1.2,
                    }}
                  >
                    {marker.properties.name}
                  </Typography>
                  
                  {/* Distance indicator */}
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 0.5,
                      mt: 0.3,
                      fontSize: '0.7rem',
                    }}
                  >
                    <ExploreIcon sx={{ fontSize: '0.9rem' }} />
                    <span>{formattedDistance}</span>
                  </Box>
                </Box>
              </Box>
            </Tooltip>
          </Box>
        );
      })}
    </Box>
  );
};

export default ARMarkerOverlay;