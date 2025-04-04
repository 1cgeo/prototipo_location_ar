// Path: features\ar\components\AzimuthIndicator.tsx
import React from 'react';
import { Box, Typography, useTheme, alpha } from '@mui/material';
import NavigationIcon from '@mui/icons-material/Navigation';
import { azimuthToCardinal } from '../utils/arjsUtils';

interface AzimuthIndicatorProps {
  heading: number | null;
  isLandscape: boolean;
  isCalibrated?: boolean;
}

/**
 * Indicador de bússola simplificado mostrando a direção atual do dispositivo
 * Versão sem calibração
 */
const AzimuthIndicator: React.FC<AzimuthIndicatorProps> = React.memo(
  ({ heading, isLandscape }) => {
    const theme = useTheme();
    
    // Não renderiza se não houver direção
    if (heading === null) return null;
    
    // Arredonda a direção para exibição
    const roundedHeading = Math.round(heading);
    const cardinalDirection = azimuthToCardinal(heading);
    
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
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 1,
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
            }}
          >
            Direction
          </Typography>
          
          <Box
            sx={{
              position: 'relative',
              height: 60,
              width: 60,
              borderRadius: '50%',
              border: '2px solid rgba(255,255,255,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/* Pontos cardeais */}
            {['N', 'E', 'S', 'W'].map((point, index) => {
              const angle = index * 90;
              const isHighlighted = cardinalDirection.includes(point);
              
              return (
                <Typography
                  key={point}
                  variant="caption"
                  sx={{
                    position: 'absolute',
                    top: angle === 0 ? 0 : 'auto',
                    bottom: angle === 180 ? 0 : 'auto',
                    left: angle === 270 ? 0 : (angle === 0 || angle === 180) ? '50%' : 'auto',
                    right: angle === 90 ? 0 : 'auto',
                    transform: (angle === 0 || angle === 180)
                      ? 'translateX(-50%)'
                      : (angle === 90 || angle === 270)
                        ? 'translateY(-50%)'
                        : 'none',
                    fontWeight: isHighlighted ? 'bold' : 'normal',
                    color: isHighlighted ? theme.palette.primary.main : 'white',
                  }}
                >
                  {point}
                </Typography>
              );
            })}
            
            {/* Indicador de direção */}
            <Box
              sx={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: `translate(-50%, -50%) rotate(${roundedHeading}deg)`,
                transition: 'transform 0.1s ease-out',
              }}
            >
              <NavigationIcon
                color="primary"
                sx={{
                  fontSize: 24,
                }}
              />
            </Box>
          </Box>
          
          {/* Exibição da direção */}
          <Typography
            variant="body2"
            sx={{
              mt: 0.5,
              fontWeight: 'medium',
              fontFamily: 'monospace',
            }}
          >
            {roundedHeading}° {cardinalDirection}
          </Typography>
        </Box>
      </Box>
    );
  }
);

AzimuthIndicator.displayName = 'AzimuthIndicator';

export default AzimuthIndicator;