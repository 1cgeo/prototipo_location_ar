// Path: features\ar\components\ARMarkerOverlay.tsx
import React, { useMemo } from 'react';
import { Box, Typography, Tooltip, alpha } from '@mui/material';
import RestaurantIcon from '@mui/icons-material/Restaurant';
import StoreIcon from '@mui/icons-material/Store';
import MuseumIcon from '@mui/icons-material/Museum';
import LocalPharmacyIcon from '@mui/icons-material/LocalPharmacy';
import DirectionsSubwayIcon from '@mui/icons-material/DirectionsSubway';
import LocalCafeIcon from '@mui/icons-material/LocalCafe';
import TheaterComedyIcon from '@mui/icons-material/TheaterComedy';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import ExploreIcon from '@mui/icons-material/Explore';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { MarkerWithDistance } from '../schemas/markerSchema';
import { useARStore } from '../stores/arStore';
import { formatDistance } from '../utils/arjsUtils';

interface ARMarkerOverlayProps {
  markers: MarkerWithDistance[];
  heading: number;
  orientation: 'portrait' | 'landscape';
  dimensions: {
    width: number;
    height: number;
  };
}

// Constantes para configuração da visualização
const MAX_MARKER_DISTANCE = 500; // Distância máxima em metros
const MAX_VERTICAL_OFFSET = 0.2; // Deslocamento vertical máximo (20% da altura da tela)

// Mapeamento de categorias para cores
const CATEGORY_COLORS: Record<string, string> = {
  restaurante: '#FF5722', // Laranja
  cafeteria: '#795548', // Marrom
  loja: '#2196F3', // Azul
  atracao: '#9C27B0', // Roxo
  teatro: '#E91E63', // Rosa
  servico: '#00BCD4', // Ciano
  transporte: '#3F51B5', // Índigo
  default: '#4CAF50', // Verde
};

/**
 * UI overlay que mostra markers visíveis no campo de visão atual
 */
const ARMarkerOverlay: React.FC<ARMarkerOverlayProps> = ({
  markers,
  heading,
  orientation,
  dimensions,
}) => {
  const { selectMarker, coordinates } = useARStore();
  const isTablet = dimensions.width >= 768;

  // Determina o campo de visão com base no dispositivo e orientação
  const fieldOfView = useMemo(() => {
    return isTablet
      ? orientation === 'landscape'
        ? 65
        : 55
      : orientation === 'landscape'
        ? 70
        : 60;
  }, [dimensions.width, orientation, isTablet]);

  // Processa e filtra os markers
  const visibleMarkers = useMemo(() => {
    if (!markers.length) return [];

    // Filtra por distância máxima primeiro
    const distanceFiltered = markers.filter(
      marker => marker.distance <= MAX_MARKER_DISTANCE,
    );

    // Processa os markers para determinar posição e visibilidade
    return (
      distanceFiltered
        .map(marker => {
          // Calcula a posição horizontal relativa (0-1)
          // Onde 0 = extrema esquerda, 0.5 = centro, 1 = extrema direita
          const relativeBearing =
            ((marker.bearing - heading + 540) % 360) - 180;

          // Converte o ângulo relativo em posição na tela
          const position = 0.5 + relativeBearing / fieldOfView;

          // Determina se o marker está realmente dentro do campo de visão
          // com uma pequena margem para evitar aparecimento/desaparecimento abrupto
          const isInFieldOfView =
            Math.abs(relativeBearing) <= fieldOfView / 2 + 5;

          // Ajuste o tamanho com base na distância (mais próximo = maior)
          const sizeFactor = Math.max(
            0.2,
            Math.min(1.0, 1 - marker.distance / MAX_MARKER_DISTANCE),
          );
          const baseSize = isTablet ? 55 : 45;
          const size = baseSize * sizeFactor;

          // Calcula deslocamento vertical baseado na diferença de altitude
          // (altitudeDifference pode ser positivo, negativo ou zero)
          const altitudeDifference =
            (marker.geometry.coordinates[2] || 0) - (coordinates.altitude || 0);

          // Normaliza a diferença de altitude (quanto maior a diferença, maior o deslocamento)
          // Limite para diferenças muito grandes (considere ±100m como máximo)
          const maxAltitudeDiff = 100; // em metros
          const normalizedAltDiff = Math.max(
            -1,
            Math.min(1, altitudeDifference / maxAltitudeDiff),
          );

          // Converte para um deslocamento vertical na tela (-20% a +20% da altura)
          // Valores negativos: marcador aparece mais abaixo na tela
          // Valores positivos: marcador aparece mais acima na tela
          const verticalPositionOffset =
            -normalizedAltDiff * MAX_VERTICAL_OFFSET;

          return {
            marker,
            position,
            size,
            isInFieldOfView,
            relativeBearing,
            altitudeDifference,
            verticalPositionOffset,
          };
        })
        // Filtra apenas os markers que estão realmente no campo de visão
        .filter(item => item.isInFieldOfView)
        // Ordena por distância para que os markers mais próximos apareçam em cima
        .sort((a, b) => a.marker.distance - b.marker.distance)
    );
  }, [markers, heading, fieldOfView, isTablet, coordinates.altitude]);

  // Obtem ícone para cada categoria
  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'restaurante':
        return <RestaurantIcon />;
      case 'cafeteria':
        return <LocalCafeIcon />;
      case 'loja':
        return <StoreIcon />;
      case 'atracao':
        return <MuseumIcon />;
      case 'teatro':
        return <TheaterComedyIcon />;
      case 'servico':
        return <LocalPharmacyIcon />;
      case 'transporte':
        return <DirectionsSubwayIcon />;
      default:
        return <LocationOnIcon />;
    }
  };

  // Obtem ícone para indicar altitude
  const getAltitudeIcon = (altDiff: number) => {
    if (altDiff > 5) return <KeyboardArrowUpIcon />;
    if (altDiff < -5) return <KeyboardArrowDownIcon />;
    return null;
  };

  // Obtem cor para cada categoria
  const getCategoryColor = (category: string) => {
    return CATEGORY_COLORS[category] || CATEGORY_COLORS.default;
  };

  // Calcula distribuição vertical para evitar sobreposição
  const distributedMarkers = useMemo(() => {
    if (!visibleMarkers.length) return [];

    // Agrupa markers que estão próximos na horizontal
    const groups: Array<typeof visibleMarkers> = [];
    const POSITION_THRESHOLD = 0.15; // Limiar para considerar markers no mesmo grupo horizontal

    // Cria grupos de markers próximos
    visibleMarkers.forEach(marker => {
      // Procura um grupo existente onde este marker possa ser adicionado
      const existingGroup = groups.find(group => {
        return group.some(
          item =>
            Math.abs(item.position - marker.position) < POSITION_THRESHOLD,
        );
      });

      if (existingGroup) {
        existingGroup.push(marker);
      } else {
        groups.push([marker]);
      }
    });

    // Para cada grupo, distribui verticalmente os markers
    const result: Array<
      (typeof visibleMarkers)[0] & { verticalOffset: number }
    > = [];

    groups.forEach(group => {
      group.forEach((marker, index) => {
        // Distribui verticalmente com base no índice e altitude
        // Valores de offset entre -20% e +20% da altura da tela
        const totalMarkers = group.length;
        let verticalOffset = marker.verticalPositionOffset || 0;

        if (totalMarkers > 1) {
          // Adiciona uma distribuição adicional para evitar sobreposição dentro do grupo
          const step = 0.3 / (totalMarkers - 1);

          // Centraliza a distribuição vertical
          const groupOffset = -0.15 + index * step;

          // Combina o deslocamento baseado em altitude com o agrupamento
          // Peso maior para altitude (70%) e menor para agrupamento (30%)
          verticalOffset = verticalOffset * 0.7 + groupOffset * 0.3;
        }

        // Limita o deslocamento total para evitar que os markers fiquem fora da tela
        verticalOffset = Math.max(-0.3, Math.min(0.3, verticalOffset));

        result.push({
          ...marker,
          verticalOffset,
        });
      });
    });

    return result;
  }, [visibleMarkers]);

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
      {/* Renderiza apenas os markers visíveis */}
      {distributedMarkers.map(
        ({ marker, position, size, verticalOffset, altitudeDifference }) => {
          // Calcula opacidade com base na distância
          const opacityByDistance = Math.max(
            0.6,
            Math.min(1, 1 - marker.distance / MAX_MARKER_DISTANCE),
          );
          const isPulsingMarker = marker.distance < 100; // Pulsa para markers próximos
          const formattedDistance = formatDistance(marker.distance);
          const markerColor = getCategoryColor(marker.properties.category);
          const altitudeIcon = getAltitudeIcon(altitudeDifference);

          return (
            <Box
              key={marker.id}
              sx={{
                position: 'absolute',
                left: `${position * 100}%`,
                top: `${50 + verticalOffset * 100}%`,
                transform: 'translate(-50%, -50%)',
                zIndex: Math.round(MAX_MARKER_DISTANCE - marker.distance), // Mais próximos ficam na frente
                pointerEvents: 'auto',
                cursor: 'pointer',
              }}
              onClick={() => selectMarker(marker.id)}
            >
              <Tooltip
                title={`${marker.properties.name} - ${formattedDistance} ${
                  altitudeDifference > 5
                    ? `(${Math.round(altitudeDifference)}m acima)`
                    : altitudeDifference < -5
                      ? `(${Math.abs(Math.round(altitudeDifference))}m abaixo)`
                      : ''
                }`}
                placement="top"
                arrow
              >
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    transition: 'all 0.2s ease-out',
                    '&:hover': {
                      transform: 'scale(1.1)',
                      '& .marker-icon': {
                        boxShadow: `0 0 0 4px ${alpha(markerColor, 0.3)}, 0 4px 12px rgba(0,0,0,0.5)`,
                      },
                    },
                  }}
                >
                  {/* Ícone do marker - Com indicador de altitude */}
                  <Box
                    className="marker-icon"
                    sx={{
                      backgroundColor: markerColor,
                      color: '#fff',
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: size,
                      height: size,
                      boxShadow: `0 3px 10px ${alpha(markerColor, 0.5)}, 0 3px 6px rgba(0,0,0,0.4)`,
                      border: `2px solid ${alpha('#ffffff', 0.9)}`,
                      opacity: opacityByDistance,
                      animation: isPulsingMarker ? 'pulse 2s infinite' : 'none',
                      transition: 'all 0.2s ease',
                      background: `linear-gradient(135deg, ${markerColor}, ${alpha(markerColor, 0.7)})`,
                      '& .MuiSvgIcon-root': {
                        filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))',
                        fontSize: size * 0.55,
                      },
                      position: 'relative',
                    }}
                  >
                    {getCategoryIcon(marker.properties.category)}

                    {/* Indicador de altitude */}
                    {altitudeIcon && (
                      <Box
                        sx={{
                          position: 'absolute',
                          top: -8,
                          right: -8,
                          backgroundColor:
                            altitudeDifference > 0 ? '#4caf50' : '#f44336',
                          borderRadius: '50%',
                          width: size * 0.4,
                          height: size * 0.4,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          border: '2px solid white',
                          boxShadow: '0 2px 5px rgba(0,0,0,0.3)',
                          '& .MuiSvgIcon-root': {
                            fontSize: size * 0.25,
                          },
                        }}
                      >
                        {altitudeIcon}
                      </Box>
                    )}
                  </Box>

                  {/* Rótulo do marker - Estilo melhorado */}
                  <Box
                    sx={{
                      backgroundColor: alpha('#000000', 0.75),
                      color: 'white',
                      padding: '5px 10px',
                      borderRadius: 3,
                      marginTop: 0.8,
                      textAlign: 'center',
                      opacity: opacityByDistance,
                      backdropFilter: 'blur(8px)',
                      border: `1px solid ${alpha(markerColor, 0.3)}`,
                      boxShadow: '0 3px 8px rgba(0,0,0,0.25)',
                      maxWidth: '150px',
                      transform: 'translateZ(0)', // Para melhorar a renderização
                    }}
                  >
                    <Typography
                      variant="caption"
                      sx={{
                        display: 'block',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        fontWeight: 600,
                        lineHeight: 1.2,
                        letterSpacing: '0.01em',
                        fontSize: isTablet ? '0.75rem' : '0.7rem',
                      }}
                    >
                      {marker.properties.name}
                    </Typography>

                    {/* Indicador de distância - Estilo melhorado */}
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 0.5,
                        mt: 0.3,
                        fontSize: isTablet ? '0.7rem' : '0.65rem',
                        opacity: 0.85,
                      }}
                    >
                      <ExploreIcon
                        sx={{
                          fontSize: isTablet ? '0.9rem' : '0.8rem',
                          color: alpha(markerColor, 0.9),
                        }}
                      />
                      <span>{formattedDistance}</span>
                    </Box>
                  </Box>
                </Box>
              </Tooltip>
            </Box>
          );
        },
      )}
    </Box>
  );
};

export default ARMarkerOverlay;
