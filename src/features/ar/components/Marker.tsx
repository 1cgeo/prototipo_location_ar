// Path: features\ar\components\Marker.tsx
import React, { useMemo } from 'react';
import { Box, Typography, SvgIconProps, Tooltip, alpha } from '@mui/material';
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
  position: number;
  size: number;
  marker: MarkerWithDistance;
  deviceSize: {
    width: number;
    height: number;
  };
}

/**
 * Simplified marker component for AR points of interest
 */
const Marker: React.FC<MarkerProps> = React.memo(
  ({
    // We're keeping the position prop in the parameter list even though we don't use it directly
    // because the parent component passes it and expects it in the interface
    size,
    marker,
    deviceSize,
  }) => {
    const { selectMarker } = useMarkersStore();
    const isTablet = deviceSize.width >= 768;

    // Calculate display values
    const {
      opacity,
      formattedDistance,
      iconProps,
      isPulsingMarker,
      fontSizeForDevice,
    } = useMemo(() => {
      const opacity = calculateMarkerOpacity(marker.distance);
      const formattedDistance = formatDistance(marker.distance);
      const isPulsingMarker = marker.distance < 100;
      const fontSizeForDevice = isTablet ? '0.8rem' : '0.75rem';

      const iconProps: SvgIconProps = {
        fontSize: isTablet ? 'large' : 'medium',
        color: 'inherit',
      };

      return {
        opacity,
        formattedDistance,
        iconProps,
        isPulsingMarker,
        fontSizeForDevice,
      };
    }, [marker.distance, isTablet]);

    // Get the appropriate icon based on category
    const categoryIcon = useMemo(() => {
      switch (marker.properties.category) {
        case 'restaurante':
          return <RestaurantIcon {...iconProps} />;
        case 'loja':
          return <StoreIcon {...iconProps} />;
        case 'atracao':
          return <MuseumIcon {...iconProps} />;
        case 'servico':
          return <LocalPharmacyIcon {...iconProps} />;
        case 'transporte':
          return <DirectionsSubwayIcon {...iconProps} />;
        default:
          return <LocationOnIcon {...iconProps} />;
      }
    }, [marker.properties.category, iconProps]);

    // Handle marker click
    const handleMarkerClick = () => {
      selectMarker(marker.id);
    };

    return (
      <Tooltip
        title={`${marker.properties.name} - ${formattedDistance}`}
        placement="top"
        arrow
      >
        <Box
          sx={{
            pointerEvents: 'auto',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            transition: 'transform 0.2s ease-out',
            '&:hover': {
              transform: 'scale(1.1)',
            },
          }}
          onClick={handleMarkerClick}
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
              position: 'relative',
            }}
          >
            {categoryIcon}

            {/* Direction indicator */}
            <Box
              sx={{
                position: 'absolute',
                top: -5,
                right: -5,
                backgroundColor: 'background.paper',
                borderRadius: '50%',
                width: 20,
                height: 20,
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
              maxWidth: '100%',
              width: 'max-content',
            }}
          >
            {/* Location name */}
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
    );
  },
);

Marker.displayName = 'Marker';

export default Marker;
