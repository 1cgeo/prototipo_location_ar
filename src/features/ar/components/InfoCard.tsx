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
  Tooltip,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CategoryIcon from '@mui/icons-material/Category';
import ExploreIcon from '@mui/icons-material/Explore';
import NavigationIcon from '@mui/icons-material/Navigation';
import RefreshIcon from '@mui/icons-material/Refresh';
import { MarkerWithDistance } from '../schemas/markerSchema';
import { useARStore } from '../stores/arStore';
import { formatDistance, azimuthToCardinal } from '../utils/arUtils';

interface InfoCardProps {
  marker: MarkerWithDistance;
  orientation: 'portrait' | 'landscape';
  isTablet: boolean;
  onRefreshLocation?: () => void;
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
 * Displays information about a selected marker with improved UI/UX
 */
const InfoCard: React.FC<InfoCardProps> = ({
  marker,
  isTablet,
  orientation,
  onRefreshLocation,
}) => {
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
        backgroundColor: alpha(theme.palette.background.paper, 0.85),
        borderRadius: theme.shape.borderRadius * 1.5,
        overflow: 'hidden',
        transition: 'all 0.2s ease',
        maxHeight: orientation === 'portrait' ? '60vh' : '80vh',
        overflowY: 'auto',
        border: '1px solid rgba(255,255,255,0.1)',
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
          <Box sx={{ display: 'flex' }}>
            {onRefreshLocation && (
              <Tooltip title="Refresh nearby places">
                <IconButton
                  onClick={onRefreshLocation}
                  size="small"
                  sx={{ mr: 1 }}
                  color="primary"
                >
                  <RefreshIcon />
                </IconButton>
              </Tooltip>
            )}
            <IconButton onClick={() => selectMarker(null)}>
              <CloseIcon />
            </IconButton>
          </Box>
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
            sx={{ fontWeight: 500 }}
          />
          <Chip
            icon={<ExploreIcon />}
            label={distance}
            size={isTablet ? 'medium' : 'small'}
            color="primary"
            sx={{ fontWeight: 500 }}
          />
        </Box>

        {/* Description */}
        <Typography
          variant="body2"
          color="text.secondary"
          paragraph
          sx={{
            backgroundColor: alpha(theme.palette.background.default, 0.3),
            p: 1.5,
            borderRadius: 1,
            mb: 2,
          }}
        >
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
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <NavigationIcon
              color="primary"
              sx={{
                transform: `rotate(${azimuth}deg)`,
                fontSize: 28,
              }}
            />
            <Typography variant="body2" sx={{ fontWeight: 500 }}>
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

export default React.memo(InfoCard);
