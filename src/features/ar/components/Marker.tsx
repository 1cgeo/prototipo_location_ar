// Path: features\ar\components\Marker.tsx
import React from 'react';
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
import { formatDistance } from '../utils/arUtils';

interface MarkerProps {
  size: number;
  marker: MarkerWithDistance;
}

/**
 * Simplified marker component for AR points of interest
 */
const Marker: React.FC<MarkerProps> = ({ size, marker }) => {
  const { selectMarker } = useARStore();

  // Calculate opacity based on distance
  const opacity = Math.max(0.4, Math.min(1, 1 - marker.distance / 500));
  const isPulsingMarker = marker.distance < 100;
  const formattedDistance = formatDistance(marker.distance);

  // Get the appropriate icon based on category
  const getCategoryIcon = () => {
    switch (marker.properties.category) {
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
          }}
        >
          {getCategoryIcon()}
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
};

export default Marker;
