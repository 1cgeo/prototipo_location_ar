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
/**
 * UI overlay que mostra markers visíveis no campo de visão atual
 */
const ARMarkerOverlay: React.FC<ARMarkerOverlayProps> = ({
  markers,
  heading,
  orientation,
  dimensions
}) => {
  const { selectMarker } = useARStore();
  const isTablet = dimensions.width >= 768;
  
  // Determina o campo de visão com base no dispositivo e orientação
  const fieldOfView = useMemo(() => {
    return isTablet
      ? orientation === 'landscape' ? 65 : 55
      : orientation === 'landscape' ? 70 : 60;
  }, [dimensions.width, orientation, isTablet]);
  
  // Processa e filtra os markers
  const visibleMarkers = useMemo(() => {
    if (!markers.length) return [];
    
    // Filtra por distância máxima primeiro
    const distanceFiltered = markers.filter(marker => marker.distance <= MAX_MARKER_DISTANCE);
    
    // Processa os markers para determinar posição e visibilidade
    return distanceFiltered.map(marker => {
      // Calcula a posição horizontal relativa (0-1)
      // Onde 0 = extrema esquerda, 0.5 = centro, 1 = extrema direita
      const relativeBearing = ((marker.bearing - heading + 540) % 360) - 180;
      
      // Converte o ângulo relativo em posição na tela
      const position = 0.5 + relativeBearing / fieldOfView;
      
      // Determina se o marker está realmente dentro do campo de visão
      // com uma pequena margem para evitar aparecimento/desaparecimento abrupto
      const isInFieldOfView = Math.abs(relativeBearing) <= (fieldOfView / 2 + 5);

      // Ajuste o tamanho com base na distância (mais próximo = maior)
      const sizeFactor = Math.max(0.2, Math.min(1.0, 1 - (marker.distance / MAX_MARKER_DISTANCE)));
      const baseSize = isTablet ? 55 : 45;
      const size = baseSize * sizeFactor;
      
      return {
        marker,
        position,
        size,
        isInFieldOfView,
        relativeBearing
      };
    })
    // Filtra apenas os markers que estão realmente no campo de visão
    .filter(item => item.isInFieldOfView)
    // Ordena por distância para que os markers mais próximos apareçam em cima
    .sort((a, b) => a.marker.distance - b.marker.distance);
  }, [markers, heading, fieldOfView, isTablet]);
  
  // Obtem ícone para cada categoria
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
        return group.some(item => 
          Math.abs(item.position - marker.position) < POSITION_THRESHOLD
        );
      });
      
      if (existingGroup) {
        existingGroup.push(marker);
      } else {
        groups.push([marker]);
      }
    });
    
    // Para cada grupo, distribui verticalmente os markers
    const result: Array<typeof visibleMarkers[0] & { verticalOffset: number }> = [];
    
    groups.forEach(group => {
      group.forEach((marker, index) => {
        // Distribui verticalmente com base no índice
        // Valores de offset entre -20% e +20% da altura da tela
        const totalMarkers = group.length;
        let verticalOffset = 0;
        
        if (totalMarkers > 1) {
          // Centraliza a distribuição vertical
          const step = 0.4 / (totalMarkers - 1);
          verticalOffset = -0.2 + (index * step);
        }
        
        result.push({
          ...marker,
          verticalOffset
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
      {distributedMarkers.map(({ marker, position, size, verticalOffset }) => {
        // Calcula opacidade com base na distância
        const opacityByDistance = Math.max(0.5, Math.min(1, 1 - marker.distance / MAX_MARKER_DISTANCE));
        const isPulsingMarker = marker.distance < 100; // Pulsa para markers próximos
        const formattedDistance = formatDistance(marker.distance);
        
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
                {/* Ícone do marker */}
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
                    opacity: opacityByDistance,
                    animation: isPulsingMarker ? 'pulse 2s infinite' : 'none',
                  }}
                >
                  {getCategoryIcon(marker.properties.category)}
                </Box>
                
                {/* Rótulo do marker */}
                <Box
                  sx={{
                    backgroundColor: alpha('#000000', 0.7),
                    color: 'white',
                    padding: '4px 8px',
                    borderRadius: 1,
                    marginTop: 0.5,
                    textAlign: 'center',
                    opacity: opacityByDistance,
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
                  
                  {/* Indicador de distância */}
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