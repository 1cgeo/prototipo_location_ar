// Path: features\ar\components\AzimuthIndicator.tsx
import React from 'react';
import { Box, Typography, useTheme, alpha, Tooltip } from '@mui/material';
import NavigationIcon from '@mui/icons-material/Navigation';
import LockIcon from '@mui/icons-material/Lock';
import { azimuthToCardinal } from '../utils/arjsUtils';

interface AzimuthIndicatorProps {
  heading: number | null;
  isLandscape: boolean;
  isLocked?: boolean;
  isCalibrated?: boolean;
}

/**
 * Indicador de bússola simplificado mostrando a direção atual do dispositivo
 * Versão com indicação de travamento
 */
const AzimuthIndicator: React.FC<AzimuthIndicatorProps> = React.memo(
  ({ heading, isLandscape, isLocked = false }) => {
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
            position: 'relative', // Para posicionar o ícone de travamento
          }}
        >
          {/* Status da bússola - indica se está travada */}
          <Typography
            variant="caption"
            sx={{
              mb: 0.5,
              opacity: 0.8,
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              color: isLocked ? 'warning.main' : 'inherit',
            }}
          >
            {isLocked ? 'Bússola travada' : 'Direção'}
            {isLocked && (
              <Tooltip
                title="A bússola está travada devido à inclinação vertical do dispositivo. Segure o dispositivo mais na horizontal para reativar."
                arrow
              >
                <LockIcon
                  fontSize="small"
                  color="warning"
                  sx={{ fontSize: '0.9rem' }}
                />
              </Tooltip>
            )}
          </Typography>

          <Box
            sx={{
              position: 'relative',
              height: 60,
              width: 60,
              borderRadius: '50%',
              border: `2px solid ${isLocked ? theme.palette.warning.main : 'rgba(255,255,255,0.2)'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'border-color 0.3s ease',
              backgroundColor: isLocked
                ? alpha(theme.palette.warning.main, 0.1)
                : 'transparent',
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
                    left:
                      angle === 270
                        ? 0
                        : angle === 0 || angle === 180
                          ? '50%'
                          : 'auto',
                    right: angle === 90 ? 0 : 'auto',
                    transform:
                      angle === 0 || angle === 180
                        ? 'translateX(-50%)'
                        : angle === 90 || angle === 270
                          ? 'translateY(-50%)'
                          : 'none',
                    fontWeight: isHighlighted ? 'bold' : 'normal',
                    color: isHighlighted
                      ? isLocked
                        ? theme.palette.warning.main
                        : theme.palette.primary.main
                      : 'white',
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
                color={isLocked ? 'warning' : 'primary'}
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
              color: isLocked ? theme.palette.warning.main : 'inherit',
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
