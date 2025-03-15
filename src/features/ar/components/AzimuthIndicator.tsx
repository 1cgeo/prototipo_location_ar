// Path: features\ar\components\AzimuthIndicator.tsx
import React from 'react';
import { Box, Typography, useTheme, Tooltip, alpha } from '@mui/material';
import NavigationIcon from '@mui/icons-material/Navigation';
import { azimuthToCardinal } from '../utils/formatters';

interface AzimuthIndicatorProps {
  heading: number | null;
  isLandscape: boolean;
  isCalibrated?: boolean;
}

// Cardinal points definition
const CARDINAL_POINTS = [
  { short: 'N', long: 'Norte', angle: 0 },
  { short: 'E', long: 'Leste', angle: 90 },
  { short: 'S', long: 'Sul', angle: 180 },
  { short: 'W', long: 'Oeste', angle: 270 },
];

/**
 * Compass indicator showing current device heading
 */
const AzimuthIndicator: React.FC<AzimuthIndicatorProps> = React.memo(
  ({ heading, isLandscape, isCalibrated = true }) => {
    const theme = useTheme();

    // Don't render if no heading
    if (heading === null) return null;

    // Round heading for display
    const roundedHeading = Math.round(heading);
    const cardinalDirection = azimuthToCardinal(heading);

    // Size calculations
    const viewportMin = Math.min(window.innerWidth, window.innerHeight);
    const baseSize = Math.max(50, Math.min(70, viewportMin * 0.08));
    const fontSize = baseSize * 0.16;

    return (
      <Box
        sx={{
          position: 'absolute',
          ...(isLandscape
            ? {
                top: theme.spacing(2),
                left: '50%',
                transform: 'translateX(-50%)',
              }
            : {
                top: theme.spacing(2),
                right: theme.spacing(2),
              }),
          zIndex: 5,
        }}
      >
        <Box
          sx={{
            backgroundColor: alpha(theme.palette.background.paper, 0.7),
            borderRadius: 2,
            padding: theme.spacing(1),
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            backdropFilter: 'blur(4px)',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: 2,
          }}
        >
          <Typography
            variant="caption"
            sx={{
              mb: 0.5,
              opacity: 0.8,
              fontSize: `${fontSize}px`,
            }}
          >
            {isCalibrated ? 'Direction' : 'Calibrating...'}
          </Typography>

          <Box
            sx={{
              position: 'relative',
              height: `${baseSize}px`,
              width: `${baseSize}px`,
            }}
          >
            {/* Circle background */}
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                height: '100%',
                width: '100%',
                borderRadius: '50%',
                border: '2px solid rgba(255,255,255,0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {/* Cardinal points */}
              {CARDINAL_POINTS.map(point => {
                const isHighlighted = cardinalDirection.includes(point.short);

                // Position based on angle
                const position = {
                  top: point.angle === 0 ? 0 : 'auto',
                  bottom: point.angle === 180 ? 0 : 'auto',
                  left:
                    point.angle === 270
                      ? 0
                      : point.angle === 0 || point.angle === 180
                        ? '50%'
                        : 'auto',
                  right: point.angle === 90 ? 0 : 'auto',
                  transform:
                    point.angle === 0 || point.angle === 180
                      ? 'translateX(-50%)'
                      : point.angle === 90 || point.angle === 270
                        ? 'translateY(-50%)'
                        : 'none',
                };

                return (
                  <Tooltip
                    key={point.short}
                    title={point.long}
                    arrow
                    placement="top"
                  >
                    <Typography
                      variant="caption"
                      sx={{
                        position: 'absolute',
                        ...position,
                        fontSize: `${fontSize}px`,
                        fontWeight: isHighlighted ? 'bold' : 'normal',
                        color: isHighlighted
                          ? theme.palette.primary.main
                          : 'white',
                      }}
                    >
                      {point.short}
                    </Typography>
                  </Tooltip>
                );
              })}

              {/* Direction indicator */}
              <Box
                sx={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: `translate(-50%, -50%) rotate(${roundedHeading}deg)`,
                  transition: isCalibrated
                    ? 'transform 0.1s ease-out'
                    : 'transform 0.5s ease-out',
                }}
              >
                <NavigationIcon
                  color="primary"
                  sx={{
                    fontSize: baseSize * 0.47,
                    opacity: isCalibrated ? 1 : 0.7,
                  }}
                />
              </Box>
            </Box>
          </Box>

          {/* Heading display */}
          <Typography
            variant="body2"
            sx={{
              mt: 0.5,
              fontWeight: 'medium',
              fontFamily: 'monospace',
              fontSize: `${fontSize * 1.3}px`,
            }}
          >
            {roundedHeading}° {cardinalDirection}
          </Typography>
        </Box>
      </Box>
    );
  },
);

AzimuthIndicator.displayName = 'AzimuthIndicator';

export default AzimuthIndicator;
