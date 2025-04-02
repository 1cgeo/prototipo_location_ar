// Path: features\ar\components\ARJSOverlay.tsx
import React, { useMemo } from 'react';
import { Box } from '@mui/material';
import { useARStore } from '../stores/arStore';
import InfoCard from './InfoCard';
import AzimuthIndicator from './AzimuthIndicator';

interface ARJSOverlayProps {
  orientation: 'portrait' | 'landscape';
  dimensions: {
    width: number;
    height: number;
  };
}

/**
 * UI overlay for AR.js scene
 */
const ARJSOverlay: React.FC<ARJSOverlayProps> = ({
  orientation,
  dimensions,
}) => {
  const { heading, selectedMarkerId, visibleMarkers } = useARStore();
  const isTablet = dimensions.width >= 768;

  // Find the selected marker
  const selectedMarker = useMemo(() => {
    return visibleMarkers.find(marker => marker.id === selectedMarkerId);
  }, [visibleMarkers, selectedMarkerId]);

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
      {/* Compass indicator */}
      {!selectedMarkerId && heading !== null && (
        <AzimuthIndicator
          heading={heading}
          isLandscape={orientation === 'landscape'}
          isCalibrated={true}
        />
      )}

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
          }}
        >
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

export default ARJSOverlay;
