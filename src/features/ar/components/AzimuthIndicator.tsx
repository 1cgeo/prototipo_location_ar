// Path: features\ar\components\AzimuthIndicator.tsx
import React, { useMemo } from 'react';
import {
  Box,
  Typography,
  useTheme,
  SxProps,
  Theme,
  Tooltip,
} from '@mui/material';
import NavigationIcon from '@mui/icons-material/Navigation';
import CompassCalibrationIcon from '@mui/icons-material/CompassCalibration';
import { azimuthToCardinal } from '../utils/formatters';

interface AzimuthIndicatorProps {
  heading: number | null;
  isLandscape: boolean;
  isCalibrated?: boolean; // Novo prop para indicar calibração
}

// Definindo pontos cardeais fora do componente para evitar recriações
const CARDINAL_POINTS = [
  { short: 'N', long: 'Norte', position: 'top' },
  { short: 'E', long: 'Leste', position: 'right' },
  { short: 'S', long: 'Sul', position: 'bottom' },
  { short: 'W', long: 'Oeste', position: 'left' },
];

/**
 * Componente otimizado que exibe um indicador de azimute (direção) visual
 * Com memoização e prevenção de renderizações desnecessárias
 * Totalmente responsivo a diferentes tamanhos de tela
 */
const AzimuthIndicator: React.FC<AzimuthIndicatorProps> = React.memo(
  ({ heading, isLandscape, isCalibrated = true }) => {
    const theme = useTheme();

    // Retorna null rapidamente se não tiver heading
    if (heading === null) return null;

    // Memoiza todos os valores calculados para melhorar performance
    const computedValues = useMemo(() => {
      // Direção cardinal (N, NE, E, SE, etc)
      const cardinal = azimuthToCardinal(heading);

      // Arredonda o heading para evitar atualizações desnecessárias devido a pequenas mudanças
      const roundedHeading = Math.round(heading);

      // Estilo com base na orientação do dispositivo
      // Ajustado para ser totalmente responsivo em diferentes tamanhos de tela
      const containerStyle: SxProps<Theme> = isLandscape
        ? {
            position: 'absolute',
            top: theme.spacing(2),
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 5,
            paddingTop: 'env(safe-area-inset-top)', // Suporte a notch
          }
        : {
            position: 'absolute',
            top: theme.spacing(2),
            right: theme.spacing(2),
            zIndex: 5,
            paddingTop: 'env(safe-area-inset-top)', // Suporte a notch
            paddingRight: 'env(safe-area-inset-right)', // Suporte a áreas seguras
          };

      return {
        cardinal,
        roundedHeading,
        containerStyle,
      };
    }, [heading, isLandscape, theme]);

    // Memoiza os pontos cardeais com seus estilos para evitar recálculos
    const cardinalPointsWithStyles = useMemo(() => {
      return CARDINAL_POINTS.map(point => {
        const isNorth = point.short === 'N';
        const isSouth = point.short === 'S';
        const isEast = point.short === 'E';
        const isWest = point.short === 'W';
        const isHighlighted = computedValues.cardinal.includes(point.short);

        // Calcula posição uma única vez
        const positionStyle = {
          position: 'absolute',
          top: isNorth ? 0 : isSouth ? 'auto' : '50%',
          bottom: isSouth ? 0 : 'auto',
          left: isWest ? 0 : isEast ? 'auto' : '50%',
          right: isEast ? 0 : 'auto',
          transform:
            isNorth || isSouth
              ? 'translateX(-50%)'
              : isWest || isEast
                ? 'translateY(-50%)'
                : 'none',
          fontSize: '0.6rem',
          fontWeight: isHighlighted ? 'bold' : 'normal',
          color: isHighlighted ? theme.palette.primary.main : 'white',
        } as const;

        return {
          ...point,
          style: positionStyle,
        };
      });
    }, [computedValues.cardinal, theme.palette.primary.main]);

    // Calcula dimensões responsivas do indicador de bússola
    const { compassSize, iconSize, fontSize } = useMemo(() => {
      // Tamanho base varia com o menor valor da viewport
      const viewportMin = Math.min(window.innerWidth, window.innerHeight);

      // Tamanho da bússola adaptado à tela (6-10% da dimensão menor da viewport)
      const baseSize = Math.max(50, Math.min(70, viewportMin * 0.08));

      return {
        compassSize: baseSize,
        iconSize: baseSize * 0.47, // ~47% do tamanho da bússola
        fontSize: baseSize * 0.16, // ~16% do tamanho da bússola
      };
    }, []);

    return (
      <Box sx={computedValues.containerStyle}>
        <Box
          sx={{
            backgroundColor: 'rgba(0,0,0,0.6)',
            borderRadius: 2,
            padding: theme.spacing(1),
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            backdropFilter: 'blur(4px)',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: 2,
            transition: 'all 0.3s ease',
            animation: isCalibrated ? 'none' : 'pulse 2s infinite',
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
            {isCalibrated ? 'Direção' : 'Calibrando...'}
          </Typography>

          <Box
            sx={{
              position: 'relative',
              height: `${compassSize}px`,
              width: `${compassSize}px`,
            }}
          >
            {/* Círculo de fundo */}
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
                transition: 'all 0.3s ease',
                backgroundColor: isCalibrated
                  ? 'transparent'
                  : 'rgba(255,255,255,0.05)',
              }}
            >
              {/* Pontos cardeais */}
              {cardinalPointsWithStyles.map(point => (
                <Tooltip
                  key={point.short}
                  title={point.long}
                  arrow
                  placement="top"
                >
                  <Typography
                    variant="caption"
                    sx={{
                      ...point.style,
                      fontSize: `${fontSize}px`,
                    }}
                  >
                    {point.short}
                  </Typography>
                </Tooltip>
              ))}

              {/* Indicador de direção */}
              <Box
                sx={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: `translate(-50%, -50%) rotate(${computedValues.roundedHeading}deg)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: isCalibrated
                    ? 'transform 0.1s ease-out'
                    : 'transform 0.5s ease-out',
                }}
              >
                <NavigationIcon
                  color="primary"
                  sx={{
                    fontSize: iconSize,
                    opacity: isCalibrated ? 1 : 0.7,
                  }}
                />
              </Box>
            </Box>
          </Box>

          <Box
            sx={{
              mt: 0.5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 0.5,
            }}
          >
            <CompassCalibrationIcon
              sx={{
                fontSize: `${fontSize * 1.5}px`,
                color: theme.palette.primary.main,
                animation: isCalibrated ? 'none' : 'pulse 1.5s infinite',
              }}
            />
            <Typography
              variant="body2"
              sx={{
                fontWeight: 'medium',
                fontFamily: 'monospace',
                fontSize: `${fontSize * 1.3}px`,
              }}
            >
              {computedValues.roundedHeading}° {computedValues.cardinal}
            </Typography>
          </Box>
        </Box>
      </Box>
    );
  },
);

// Adiciona displayName para melhorar depuração
AzimuthIndicator.displayName = 'AzimuthIndicator';

export default AzimuthIndicator;
