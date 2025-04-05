// Path: features\ar\components\ARJSOverlay.tsx
import React from 'react';
import { Box } from '@mui/material';
import { useARStore } from '../stores/arStore';
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
 * Versão simplificada - não gerencia mais o InfoCard
 */
const ARJSOverlay: React.FC<ARJSOverlayProps> = ({
  orientation,
  dimensions: _dimensions,
}) => {
  const { heading, selectedMarkerId } = useARStore();

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
        />
      )}
    </Box>
  );
};

export default ARJSOverlay;
