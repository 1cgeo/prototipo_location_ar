// Path: features\ar\components\InfoCard.tsx
import React, { useMemo, useCallback } from 'react';
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
  Tooltip,
  Fade,
  alpha,
} from '@mui/material';
import { motion } from 'framer-motion';
import CloseIcon from '@mui/icons-material/Close';
import InfoIcon from '@mui/icons-material/Info';
import CategoryIcon from '@mui/icons-material/Category';
import NavigationIcon from '@mui/icons-material/Navigation';
import ExploreIcon from '@mui/icons-material/Explore';
import CompassCalibrationIcon from '@mui/icons-material/CompassCalibration';
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

// Dicionário de tradução de categorias - definido fora do componente para evitar recriação
const CATEGORY_TRANSLATIONS: Record<string, string> = {
  restaurante: 'Restaurante',
  loja: 'Loja',
  atracao: 'Atração Turística',
  servico: 'Serviço',
  transporte: 'Transporte',
};

// Componente de conteúdo extraído para reduzir a complexidade do componente principal
const CardDetails = React.memo(
  ({
    marker,
    formattedData,
    isTablet,
    theme,
  }: {
    marker: MarkerWithDistance;
    formattedData: any;
    isTablet: boolean;
    theme: any;
  }) => (
    <>
      {/* Tags de categoria e distância */}
      <Box
        sx={{
          mb: 2,
          display: 'flex',
          flexWrap: 'wrap',
          gap: 1,
        }}
      >
        <Chip
          icon={<CategoryIcon />}
          label={formattedData.categoryLabel}
          size={isTablet ? 'medium' : 'small'}
          color="secondary"
        />
        <Chip
          icon={<ExploreIcon />}
          label={formattedData.distance}
          size={isTablet ? 'medium' : 'small'}
          color="primary"
        />
      </Box>

      {/* Descrição do local */}
      <Typography
        variant={isTablet ? 'body1' : 'body2'}
        color="text.secondary"
        paragraph
      >
        {marker.properties.description || 'Sem descrição disponível.'}
      </Typography>

      {/* Seção de detalhes técnicos */}
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
          Detalhes Técnicos
        </Typography>

        {/* Grid responsivo para detalhes */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' },
            gap: 1.5,
          }}
        >
          {/* Distância */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ExploreIcon color="primary" fontSize="small" />
            <Box>
              <Typography variant="body2" component="span">
                Distância:
              </Typography>
              <Typography
                variant="body2"
                component="span"
                fontWeight="medium"
                sx={{ ml: 1 }}
              >
                {formattedData.distance}
              </Typography>
            </Box>
          </Box>

          {/* Azimute */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Tooltip title="Direção em relação ao Norte">
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <CompassCalibrationIcon color="primary" fontSize="small" />
              </Box>
            </Tooltip>
            <Box>
              <Typography variant="body2" component="span">
                Direção:
              </Typography>
              <Typography
                variant="body2"
                component="span"
                fontWeight="medium"
                sx={{
                  ml: 1,
                  display: 'flex',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                }}
              >
                <span>{formattedData.azimuth}°</span>
                <NavigationIcon
                  fontSize="small"
                  sx={{
                    ml: 0.5,
                    mr: 0.5,
                    transform: `rotate(${formattedData.azimuth}deg)`,
                    color: theme.palette.primary.main,
                  }}
                />
                <Typography
                  variant="caption"
                  component="span"
                  sx={{
                    opacity: 0.9,
                    bgcolor: alpha(theme.palette.primary.main, 0.1),
                    px: 0.5,
                    borderRadius: 0.5,
                  }}
                >
                  {formattedData.cardinalDirection}
                </Typography>
              </Typography>
            </Box>
          </Box>

          {/* Coordenadas - ocupa a largura completa em grid */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 1,
              gridColumn: { xs: '1', sm: '1 / -1' },
            }}
          >
            <MyLocationIcon color="primary" fontSize="small" sx={{ mt: 0.5 }} />
            <Box>
              <Typography variant="body2">Coordenadas:</Typography>
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
                  overflowX: 'auto',
                  maxWidth: '100%',
                  whiteSpace: 'nowrap',
                }}
              >
                {formattedData.coordinates}
              </Typography>
            </Box>
          </Box>
        </Box>
      </Box>
    </>
  ),
);

CardDetails.displayName = 'CardDetails';

/**
 * Componente otimizado que exibe informações detalhadas sobre um ponto de interesse
 * Com melhor responsividade, transições e memoização
 */
const InfoCard: React.FC<InfoCardProps> = React.memo(
  ({ marker, orientation, isTablet }) => {
    const theme = useTheme();
    const { selectMarker } = useMarkersStore();

    // Extrai valores do marcador
    // Corrigido: Removendo 'description' da desestruturação pois já é usado diretamente no CardDetails
    const { name, category } = marker.properties;
    const [lng, lat] = marker.geometry.coordinates;

    // Memoização de valores calculados para evitar recálculos
    const formattedData = useMemo(() => {
      // Tradução da categoria - otimizada com lookup em vez de switch
      const categoryLabel =
        CATEGORY_TRANSLATIONS[category] ||
        category.charAt(0).toUpperCase() + category.slice(1);

      // Formata a distância uma única vez
      const distance = formatDistance(marker.distance);

      // Formata o azimute uma única vez
      const azimuth = Math.round(marker.bearing);
      const cardinalDirection = azimuthToCardinal(marker.bearing);

      // Formata as coordenadas uma única vez
      const coordinates = formatCoordinates(lat, lng);

      return {
        categoryLabel,
        distance,
        azimuth,
        cardinalDirection,
        coordinates,
      };
    }, [marker.distance, marker.bearing, category, lat, lng]);

    // Função de fechamento otimizada com useCallback
    const handleClose = useCallback(() => {
      selectMarker(null);
    }, [selectMarker]);

    // Variantes para animação com Framer Motion
    const motionVariants = {
      hidden: {
        opacity: 0,
        y: orientation === 'portrait' ? 20 : 0,
        x: orientation === 'landscape' ? 20 : 0,
        scale: 0.95,
      },
      visible: {
        opacity: 1,
        y: 0,
        x: 0,
        scale: 1,
        transition: {
          type: 'spring',
          damping: 20,
          stiffness: 300,
        },
      },
      exit: {
        opacity: 0,
        scale: 0.95,
        transition: { duration: 0.2 },
      },
    };

    // Estilos específicos baseados na orientação - memoizados
    const cardStyle = useMemo(
      () => ({
        backdropFilter: 'blur(10px)',
        backgroundColor: alpha(theme.palette.background.paper, 0.8),
        borderRadius: theme.shape.borderRadius * 1.5,
        overflow: 'hidden',
        ...(orientation === 'landscape'
          ? {
              maxHeight: '80vh',
              overflowY: 'auto',
              paddingRight: 'env(safe-area-inset-right)',
            }
          : {
              maxHeight: '60vh',
              overflowY: 'auto',
              paddingBottom: 'env(safe-area-inset-bottom)',
            }),
      }),
      [orientation, theme],
    );

    return (
      <Box
        component={motion.div}
        initial="hidden"
        animate="visible"
        exit="exit"
        variants={motionVariants}
        layout
      >
        <Card elevation={6} sx={cardStyle}>
          <Fade in={true} timeout={500}>
            <div>
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
                  <IconButton
                    onClick={handleClose}
                    sx={{
                      transition: 'transform 0.2s',
                      '&:hover': {
                        transform: 'scale(1.1)',
                      },
                    }}
                  >
                    <CloseIcon fontSize={isTablet ? 'medium' : 'small'} />
                  </IconButton>
                }
              />
              <CardContent>
                <CardDetails
                  marker={marker}
                  formattedData={formattedData}
                  isTablet={isTablet}
                  theme={theme}
                />
              </CardContent>
              <CardActions>
                <Button
                  startIcon={<InfoIcon />}
                  variant="outlined"
                  onClick={handleClose}
                  fullWidth
                  size={isTablet ? 'large' : 'medium'}
                  sx={{
                    mb: 1,
                    borderRadius: theme.shape.borderRadius * 1.5,
                    transition: 'all 0.2s',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: theme.shadows[2],
                    },
                  }}
                >
                  Fechar
                </Button>
              </CardActions>
            </div>
          </Fade>
        </Card>
      </Box>
    );
  },
);

// Adiciona displayName para melhorar depuração
InfoCard.displayName = 'InfoCard';

export default InfoCard;
