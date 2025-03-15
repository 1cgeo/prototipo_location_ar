// Path: features\ar\components\Marker.tsx
import React, { useMemo } from 'react';
import {
  Box,
  Typography,
  SvgIconProps,
  Tooltip,
  Badge,
  alpha,
} from '@mui/material';
import RestaurantIcon from '@mui/icons-material/Restaurant';
import StoreIcon from '@mui/icons-material/Store';
import MuseumIcon from '@mui/icons-material/Museum';
import LocalPharmacyIcon from '@mui/icons-material/LocalPharmacy';
import DirectionsSubwayIcon from '@mui/icons-material/DirectionsSubway';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import NavigationIcon from '@mui/icons-material/Navigation';
import ExploreIcon from '@mui/icons-material/Explore';
import { MarkerWithDistance } from '../schemas/markerSchema';
import { useMarkersStore } from '../stores/markersStore';
import { calculateMarkerOpacity } from '../utils/arCalculations';
import { formatDistance } from '../utils/formatters';

interface MarkerProps {
  position: number; // 0-1, posição horizontal na tela
  size: number; // tamanho em pixels
  marker: MarkerWithDistance;
  deviceSize: {
    width: number;
    height: number;
  };
}

// Cache de ícones para evitar recriações desnecessárias
const iconCache: Record<string, React.ReactElement> = {};

// Componente de ícone de categoria memoizado para evitar re-renderizações
const CategoryIcon = React.memo(
  ({ category, iconProps }: { category: string; iconProps: SvgIconProps }) => {
    // Verifica se o ícone já está em cache
    const cacheKey = `${category}_${iconProps.fontSize}`;
    if (iconCache[cacheKey]) {
      return iconCache[cacheKey];
    }

    // Cria o ícone adequado
    let icon;
    switch (category) {
      case 'restaurante':
        icon = <RestaurantIcon {...iconProps} />;
        break;
      case 'loja':
        icon = <StoreIcon {...iconProps} />;
        break;
      case 'atracao':
        icon = <MuseumIcon {...iconProps} />;
        break;
      case 'servico':
        icon = <LocalPharmacyIcon {...iconProps} />;
        break;
      case 'transporte':
        icon = <DirectionsSubwayIcon {...iconProps} />;
        break;
      default:
        icon = <LocationOnIcon {...iconProps} />;
    }

    // Armazena em cache para uso futuro
    iconCache[cacheKey] = icon;
    return icon;
  },
);

CategoryIcon.displayName = 'CategoryIcon';

// Componente de conteúdo do marcador memoizado
const MarkerContent = React.memo(
  ({
    marker,
    formattedDistance,
    formattedAzimuth,
    fontSizeForDevice,
    opacity,
  }: {
    marker: MarkerWithDistance;
    formattedDistance: string;
    formattedAzimuth: string;
    fontSizeForDevice: string;
    opacity: number;
  }) => (
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
        maxWidth: '100%',
        width: 'max-content',
      }}
    >
      {/* Nome do local */}
      <Typography
        variant="caption"
        sx={{
          display: 'block',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          fontWeight: 500,
          fontSize: fontSizeForDevice,
          lineHeight: 1.2,
          maxWidth: '150px',
        }}
      >
        {marker.properties.name}
      </Typography>

      {/* Distância e azimute */}
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
        <span style={{ opacity: 0.7 }}>•</span>
        <NavigationIcon
          sx={{
            fontSize: '0.9rem',
            transform: `rotate(${marker.bearing}deg)`,
          }}
        />
        <span>{formattedAzimuth}</span>
      </Box>
    </Box>
  ),
);

MarkerContent.displayName = 'MarkerContent';

/**
 * Componente que representa um marcador de ponto de interesse na visualização AR
 * Otimizado para performance com menor aninhamento e melhor memoização
 */
const Marker: React.FC<MarkerProps> = React.memo(
  ({ position, size, marker, deviceSize }) => {
    const { selectMarker } = useMarkersStore();
    const isTablet = deviceSize.width >= 768;

    // Memoiza todos os valores calculados para evitar recálculos e re-renderizações
    const {
      opacity,
      formattedDistance,
      formattedAzimuth,
      isPulsingMarker,
      fontSizeForDevice,
      iconProps,
      markerStyle,
    } = useMemo(() => {
      const opacity = calculateMarkerOpacity(marker.distance);
      const formattedDistance = formatDistance(marker.distance);
      const formattedAzimuth = `${Math.round(marker.bearing)}°`;
      const isPulsingMarker = marker.distance < 100;
      const fontSizeForDevice = isTablet ? '0.8rem' : '0.75rem';

      // Props do ícone calculados uma única vez
      const iconProps: SvgIconProps = {
        fontSize: isTablet ? 'large' : 'medium',
        color: 'inherit',
      };

      // Estilo memoizado - utilizando position para ajustar z-index
      // Marcadores mais centrais têm um z-index ligeiramente mais alto
      // e marcadores mais próximos da borda têm z-index mais baixo
      const centerOffset = Math.abs(position - 0.5) * 2; // 0 no centro, 1 nas bordas
      const positionFactor = 1 - centerOffset; // 1 no centro, 0 nas bordas

      const markerStyle = {
        pointerEvents: 'auto' as const,
        cursor: 'pointer',
        transition: 'transform 0.2s ease-out',
        '&:hover': {
          transform: 'scale(1.1)',
        },
        display: 'flex',
        flexDirection: 'column' as const,
        alignItems: 'center',
        // Z-index baseado na posição central e na distância
        zIndex: Math.max(
          1,
          Math.floor(
            10 - Math.floor(marker.distance / 100) + positionFactor * 2,
          ),
        ),
      };

      return {
        opacity,
        formattedDistance,
        formattedAzimuth,
        isPulsingMarker,
        fontSizeForDevice,
        iconProps,
        markerStyle,
      };
    }, [marker.distance, marker.bearing, isTablet, position]);

    // Função otimizada para selecionar marcador
    const handleMarkerClick = React.useCallback(() => {
      selectMarker(marker.id);
    }, [marker.id, selectMarker]);

    // Otimização: só renderiza os componentes quando realmente necessário
    return (
      <Tooltip
        title={`${marker.properties.name} - ${formattedDistance}`}
        placement="top"
        arrow
      >
        <Box sx={markerStyle} onClick={handleMarkerClick}>
          {/* Ícone principal do marcador */}
          <Badge
            overlap="circular"
            anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
            badgeContent={
              <Box
                sx={{
                  backgroundColor: 'background.paper',
                  borderRadius: '50%',
                  width: 22,
                  height: 22,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '2px solid',
                  borderColor: 'primary.main',
                }}
              >
                <NavigationIcon
                  fontSize="small"
                  sx={{
                    fontSize: 14,
                    transform: `rotate(${marker.bearing}deg)`,
                    color: 'primary.main',
                  }}
                />
              </Box>
            }
          >
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
                fontSize: size * 0.5,
                boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                border: '2px solid white',
                opacity,
                animation: isPulsingMarker ? 'pulse 2s infinite' : 'none',
                willChange: 'transform', // Otimização para animações
              }}
            >
              <CategoryIcon
                category={marker.properties.category}
                iconProps={iconProps}
              />
            </Box>
          </Badge>

          {/* Informações do marcador */}
          <MarkerContent
            marker={marker}
            formattedDistance={formattedDistance}
            formattedAzimuth={formattedAzimuth}
            fontSizeForDevice={fontSizeForDevice}
            opacity={opacity}
          />
        </Box>
      </Tooltip>
    );
  },
  // Função de comparação otimizada para React.memo
  (prevProps, nextProps) => {
    // Compara apenas os valores essenciais
    return (
      prevProps.marker.id === nextProps.marker.id &&
      Math.abs(prevProps.position - nextProps.position) < 0.001 &&
      Math.abs(prevProps.size - nextProps.size) < 1 &&
      Math.abs(prevProps.marker.distance - nextProps.marker.distance) < 1 &&
      Math.abs(prevProps.marker.bearing - nextProps.marker.bearing) < 1 &&
      prevProps.deviceSize.width === nextProps.deviceSize.width
    );
  },
);

// Adiciona displayName para melhorar depuração
Marker.displayName = 'Marker';

export default Marker;
