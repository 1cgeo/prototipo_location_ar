// Path: features\ar\components\InfoCard.tsx
import React from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  Typography,
  IconButton,
  CardActions,
  Button,
  Box,
  Chip,
  useTheme,
  alpha,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CategoryIcon from '@mui/icons-material/Category';
import NavigationIcon from '@mui/icons-material/Navigation';
import ExploreIcon from '@mui/icons-material/Explore';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import { MarkerWithDistance } from '../schemas/markerSchema';
import { useMarkersStore } from '../stores/markersStore';
import {
  formatDistance,
  formatCoordinates,
  azimuthToCardinal,
} from '../utils/formatters';

interface InfoCardProps {
  marker: MarkerWithDistance;
  orientation: 'portrait' | 'landscape';
  isTablet: boolean;
}

// Category translations
const CATEGORY_TRANSLATIONS: Record<string, string> = {
  restaurante: 'Restaurant',
  loja: 'Store',
  atracao: 'Tourist Attraction',
  servico: 'Service',
  transporte: 'Transportation',
};

/**
 * Displays detailed information about a selected marker
 */
const InfoCard: React.FC<InfoCardProps> = ({
  marker,
  orientation,
  isTablet,
}) => {
  const theme = useTheme();
  const { selectMarker } = useMarkersStore();

  // Extract marker data
  const { name, category } = marker.properties;
  const [lng, lat] = marker.geometry.coordinates;

  // Format data for display
  const categoryLabel = CATEGORY_TRANSLATIONS[category] || category;
  const distance = formatDistance(marker.distance);
  const azimuth = Math.round(marker.bearing);
  const cardinalDirection = azimuthToCardinal(marker.bearing);
  const coordinates = formatCoordinates(lat, lng);

  // Handle close button click
  const handleClose = () => {
    selectMarker(null);
  };

  return (
    <Card
      elevation={6}
      sx={{
        backdropFilter: 'blur(10px)',
        backgroundColor: alpha(theme.palette.background.paper, 0.8),
        borderRadius: theme.shape.borderRadius * 1.5,
        overflow: 'hidden',
        transition: 'all 0.2s ease',
        ...(orientation === 'landscape'
          ? {
              maxHeight: '80vh',
              overflowY: 'auto',
            }
          : {
              maxHeight: '60vh',
              overflowY: 'auto',
            }),
      }}
    >
      <CardHeader
        title={
          <Typography
            variant={isTablet ? 'h5' : 'h6'}
            component="div"
            sx={{
              fontWeight: 500,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              lineHeight: 1.2,
            }}
          >
            {name}
          </Typography>
        }
        action={
          <IconButton onClick={handleClose}>
            <CloseIcon />
          </IconButton>
        }
      />

      <CardContent>
        {/* Category and distance tags */}
        <Box sx={{ mb: 2, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
          <Chip
            icon={<CategoryIcon />}
            label={categoryLabel}
            size={isTablet ? 'medium' : 'small'}
            color="secondary"
          />
          <Chip
            icon={<ExploreIcon />}
            label={distance}
            size={isTablet ? 'medium' : 'small'}
            color="primary"
          />
        </Box>

        {/* Description */}
        <Typography
          variant={isTablet ? 'body1' : 'body2'}
          color="text.secondary"
          paragraph
        >
          {marker.properties.description || 'No description available.'}
        </Typography>

        {/* Technical details */}
        <Box
          sx={{
            mt: 2,
            p: 1.5,
            bgcolor: alpha(theme.palette.background.paper, 0.3),
            borderRadius: 1,
            border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          }}
        >
          <Typography variant="subtitle2" fontWeight="medium" gutterBottom>
            Technical Details
          </Typography>

          {/* Distance */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <ExploreIcon color="primary" fontSize="small" />
            <Typography variant="body2">
              Distance: <strong>{distance}</strong>
            </Typography>
          </Box>

          {/* Direction */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <NavigationIcon
              color="primary"
              fontSize="small"
              sx={{ transform: `rotate(${azimuth}deg)` }}
            />
            <Typography variant="body2">
              Direction:{' '}
              <strong>
                {azimuth}° {cardinalDirection}
              </strong>
            </Typography>
          </Box>

          {/* Coordinates */}
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
            <MyLocationIcon color="primary" fontSize="small" sx={{ mt: 0.5 }} />
            <Box>
              <Typography variant="body2">Coordinates:</Typography>
              <Typography
                variant="body2"
                sx={{
                  mt: 0.5,
                  fontFamily: 'monospace',
                  fontSize: '0.75rem',
                  bgcolor: alpha(theme.palette.background.paper, 0.3),
                  py: 0.5,
                  px: 1,
                  borderRadius: 0.5,
                  display: 'inline-block',
                }}
              >
                {coordinates}
              </Typography>
            </Box>
          </Box>
        </Box>
      </CardContent>

      <CardActions>
        <Button
          variant="outlined"
          onClick={handleClose}
          fullWidth
          size={isTablet ? 'large' : 'medium'}
        >
          Close
        </Button>
      </CardActions>
    </Card>
  );
};

export default InfoCard;
