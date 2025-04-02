// Path: features\ar\components\InfoCard.tsx
import React from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  Typography,
  IconButton,
  Box,
  Chip,
  useTheme,
  alpha,
  Button,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CategoryIcon from '@mui/icons-material/Category';
import ExploreIcon from '@mui/icons-material/Explore';
import NavigationIcon from '@mui/icons-material/Navigation';
import { MarkerWithDistance } from '../schemas/markerSchema';
import { useARStore } from '../stores/arStore';
import { formatDistance, azimuthToCardinal } from '../utils/arjsUtils';

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
 * Displays information about a selected marker
 */
const InfoCard: React.FC<InfoCardProps> = ({ marker, isTablet }) => {
  const theme = useTheme();
  const { selectMarker } = useARStore();

  // Extract marker data
  const { name, category, description } = marker.properties;
  const distance = formatDistance(marker.distance);
  const azimuth = Math.round(marker.bearing);
  const cardinalDirection = azimuthToCardinal(marker.bearing);
  const categoryLabel = CATEGORY_TRANSLATIONS[category] || category;

  return (
    <Card
      elevation={6}
      sx={{
        backdropFilter: 'blur(10px)',
        backgroundColor: alpha(theme.palette.background.paper, 0.8),
        borderRadius: theme.shape.borderRadius * 1.5,
        overflow: 'hidden',
        transition: 'all 0.2s ease',
        maxHeight: '60vh',
        overflowY: 'auto',
      }}
    >
      <CardHeader
        title={
          <Typography
            variant={isTablet ? 'h5' : 'h6'}
            component="div"
            sx={{
              fontWeight: 500,
              overflow: 'hidden',
              lineHeight: 1.2,
            }}
          >
            {name}
          </Typography>
        }
        action={
          <IconButton onClick={() => selectMarker(null)}>
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
        <Typography variant="body2" color="text.secondary" paragraph>
          {description || 'No description available.'}
        </Typography>

        {/* Direction */}
        <Box
          sx={{
            mt: 2,
            p: 1.5,
            bgcolor: alpha(theme.palette.background.paper, 0.3),
            borderRadius: 1,
            border: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <NavigationIcon
              color="primary"
              sx={{ transform: `rotate(${azimuth}deg)` }}
            />
            <Typography variant="body2">
              Direction:{' '}
              <strong>
                {azimuth}° {cardinalDirection}
              </strong>
            </Typography>
          </Box>
        </Box>

        {/* Close button */}
        <Button
          variant="outlined"
          onClick={() => selectMarker(null)}
          fullWidth
          sx={{ mt: 2 }}
        >
          Close
        </Button>
      </CardContent>
    </Card>
  );
};

export default InfoCard;
