// Path: features\ar\components\InfoCard.tsx
import React from 'react';
import {
  Card,
  Typography,
  IconButton,
  Box,
  Chip,
  useTheme,
  alpha,
  Button,
  Avatar,
  AppBar,
  Toolbar,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ExploreIcon from '@mui/icons-material/Explore';
import NavigationIcon from '@mui/icons-material/Navigation';
import HeightIcon from '@mui/icons-material/Height';
import RestaurantIcon from '@mui/icons-material/Restaurant';
import StoreIcon from '@mui/icons-material/Store';
import MuseumIcon from '@mui/icons-material/Museum';
import LocalPharmacyIcon from '@mui/icons-material/LocalPharmacy';
import LocalCafeIcon from '@mui/icons-material/LocalCafe';
import TheaterComedyIcon from '@mui/icons-material/TheaterComedy';
import DirectionsSubwayIcon from '@mui/icons-material/DirectionsSubway';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { MarkerWithDistance } from '../schemas/markerSchema';
import { useARStore } from '../stores/arStore';
import {
  formatDistance,
  azimuthToCardinal,
  formatAltitude,
} from '../utils/arjsUtils';

interface InfoCardProps {
  marker: MarkerWithDistance;
  orientation: 'portrait' | 'landscape';
  isTablet: boolean;
}

// Traduções de categorias
const CATEGORY_TRANSLATIONS: Record<string, string> = {
  restaurante: 'Restaurante',
  cafeteria: 'Cafeteria',
  loja: 'Loja',
  atracao: 'Atração Turística',
  teatro: 'Teatro/Entretenimento',
  servico: 'Serviço',
  transporte: 'Transporte',
};

// Mapeamento de cores para categorias (mesmo usado no ARMarkerOverlay)
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
 * Exibe informações sobre um marcador selecionado em tela cheia
 */
const InfoCard: React.FC<InfoCardProps> = ({
  marker,
  orientation: _orientation,
  isTablet,
}) => {
  const theme = useTheme();
  const { selectMarker, coordinates } = useARStore();

  // Extrai dados do marcador
  const { name, category, description } = marker.properties;
  // Access altitude directly without destructuring unused lng/lat
  const altitude = marker.geometry.coordinates[2] || 0;
  const distance = formatDistance(marker.distance);
  const azimuth = Math.round(marker.bearing);
  const cardinalDirection = azimuthToCardinal(marker.bearing);
  const categoryLabel = CATEGORY_TRANSLATIONS[category] || category;
  const categoryColor = CATEGORY_COLORS[category] || CATEGORY_COLORS.default;

  // Calcula a diferença de altitude entre o usuário e o marcador
  const userAltitude = coordinates.altitude || 0;
  const altitudeDifference = altitude - userAltitude;
  const formattedAltitude = formatAltitude(altitudeDifference);

  // Determina o ícone de altitude com base na diferença
  const getAltitudeIcon = () => {
    if (altitudeDifference > 5) return <KeyboardArrowUpIcon />;
    if (altitudeDifference < -5) return <KeyboardArrowDownIcon />;
    return <HeightIcon />;
  };

  // Obtem ícone para categoria
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

  // Manipula fechamento com melhor área de clique
  const handleClose = (event: React.MouseEvent) => {
    event.stopPropagation();
    selectMarker(null);
  };

  // Formata o texto vertical angle
  const getVerticalDirectionText = () => {
    if (!marker.verticalAngle) return '';

    const angle = Math.round(marker.verticalAngle);
    if (angle > 30) return `${angle}° (acima)`;
    if (angle < -30) return `${angle}° (abaixo)`;
    if (angle > 10) return `${angle}° (ligeiramente acima)`;
    if (angle < -10) return `${angle}° (ligeiramente abaixo)`;
    return `${angle}° (mesmo nível)`;
  };

  return (
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 2000,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: alpha(theme.palette.background.paper, 0.95),
        backdropFilter: 'blur(10px)',
      }}
    >
      {/* Barra superior com botão de voltar */}
      <AppBar
        position="sticky"
        color="transparent"
        elevation={0}
        sx={{
          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          borderTop: `4px solid ${categoryColor}`,
          backdropFilter: 'blur(10px)',
          backgroundColor: alpha(theme.palette.background.paper, 0.8),
        }}
      >
        <Toolbar sx={{ minHeight: isTablet ? 64 : 56 }}>
          <IconButton
            edge="start"
            color="inherit"
            onClick={handleClose}
            aria-label="close"
            sx={{ mr: 2 }}
          >
            <ArrowBackIcon />
          </IconButton>

          <Avatar
            sx={{
              bgcolor: categoryColor,
              color: '#fff',
              boxShadow: `0 3px 5px ${alpha(categoryColor, 0.4)}`,
              mr: 2,
            }}
          >
            {getCategoryIcon(category)}
          </Avatar>

          <Box sx={{ flexGrow: 1 }}>
            <Typography
              variant={isTablet ? 'h5' : 'h6'}
              component="h1"
              noWrap
              sx={{
                fontWeight: 600,
                color: theme.palette.text.primary,
              }}
            >
              {name}
            </Typography>
            <Typography variant="body2" color="text.secondary" noWrap>
              {categoryLabel}
            </Typography>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Conteúdo principal com scroll */}
      <Box
        sx={{
          flex: 1,
          overflowY: 'auto',
          px: { xs: 2, sm: 3 },
          py: 2,
          '&::-webkit-scrollbar': {
            width: '8px',
          },
          '&::-webkit-scrollbar-track': {
            background: 'rgba(0,0,0,0.05)',
            borderRadius: '4px',
          },
          '&::-webkit-scrollbar-thumb': {
            background: alpha(categoryColor, 0.3),
            borderRadius: '4px',
            '&:hover': {
              background: alpha(categoryColor, 0.5),
            },
          },
        }}
      >
        {/* Distance, direction and altitude */}
        <Box
          sx={{
            mb: 3,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 1,
            justifyContent: 'center',
          }}
        >
          <Chip
            icon={<ExploreIcon />}
            label={distance}
            size={isTablet ? 'medium' : 'small'}
            color="primary"
            sx={{ borderRadius: 4 }}
          />

          <Chip
            icon={
              <NavigationIcon sx={{ transform: `rotate(${azimuth}deg)` }} />
            }
            label={`${azimuth}° ${cardinalDirection}`}
            size={isTablet ? 'medium' : 'small'}
            variant="outlined"
            sx={{ borderRadius: 4 }}
          />

          <Chip
            icon={getAltitudeIcon()}
            label={formattedAltitude}
            size={isTablet ? 'medium' : 'small'}
            color={
              altitudeDifference > 10
                ? 'success'
                : altitudeDifference < -10
                  ? 'error'
                  : 'default'
            }
            sx={{ borderRadius: 4 }}
          />
        </Box>

        {/* Mapa da direção do ponto */}
        <Box
          sx={{
            p: 3,
            borderRadius: 2,
            border: `1px solid ${alpha(theme.palette.divider, 0.2)}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            gap: 1,
            mb: 3,
            backgroundColor: alpha(theme.palette.background.default, 0.4),
          }}
        >
          <Box
            sx={{
              position: 'relative',
              width: 100,
              height: 100,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '50%',
              border: `2px solid ${alpha(categoryColor, 0.3)}`,
              mb: 1,
            }}
          >
            <Box
              sx={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: `translate(-50%, -50%) rotate(${azimuth}deg)`,
                transition: 'transform 0.3s ease-out',
              }}
            >
              <NavigationIcon
                sx={{
                  fontSize: 40,
                  color: categoryColor,
                  filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.3))',
                }}
              />
            </Box>

            {/* Pontos cardeais */}
            {['N', 'E', 'S', 'W'].map((point, index) => {
              const angle = index * 90;
              return (
                <Typography
                  key={point}
                  variant="caption"
                  sx={{
                    position: 'absolute',
                    top: angle === 0 ? 5 : 'auto',
                    bottom: angle === 180 ? 5 : 'auto',
                    left:
                      angle === 270
                        ? 5
                        : angle === 0 || angle === 180
                          ? '50%'
                          : 'auto',
                    right: angle === 90 ? 5 : 'auto',
                    transform:
                      angle === 0 || angle === 180
                        ? 'translateX(-50%)'
                        : angle === 90 || angle === 270
                          ? 'translateY(-50%)'
                          : 'none',
                    fontWeight: 'bold',
                    fontSize: '0.8rem',
                  }}
                >
                  {point}
                </Typography>
              );
            })}
          </Box>

          <Typography variant="body1" fontWeight="medium" align="center">
            Direção:{' '}
            <strong>
              {azimuth}° {cardinalDirection}
            </strong>
          </Typography>
        </Box>

        {/* Descrição - Seção destacada */}
        <Card
          elevation={0}
          sx={{
            mb: 3,
            borderRadius: 2,
            border: `1px solid ${alpha(categoryColor, 0.2)}`,
            backgroundColor: alpha(theme.palette.background.default, 0.3),
          }}
        >
          <Box sx={{ p: 2 }}>
            <Typography
              variant="h6"
              component="h2"
              gutterBottom
              sx={{
                borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                pb: 1,
                color: categoryColor,
              }}
            >
              Descrição
            </Typography>
            <Typography
              variant="body1"
              sx={{
                color: alpha(theme.palette.text.primary, 0.9),
                lineHeight: 1.6,
                letterSpacing: '0.015em',
              }}
            >
              {description || 'Sem descrição disponível.'}
            </Typography>
          </Box>
        </Card>

        {/* 3D Position Information */}
        <Card
          elevation={0}
          sx={{
            mb: 3,
            borderRadius: 2,
            border: `1px solid ${alpha(categoryColor, 0.2)}`,
            backgroundColor: alpha(theme.palette.background.default, 0.3),
          }}
        >
          <Box sx={{ p: 2 }}>
            <Typography
              variant="h6"
              component="h2"
              gutterBottom
              sx={{
                borderBottom: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
                pb: 1,
                color: categoryColor,
              }}
            >
              Posição 3D
            </Typography>

            <Box
              sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}
            >
              <Typography variant="body1">Distância:</Typography>
              <Typography variant="body1" fontWeight="medium">
                {distance}
              </Typography>
            </Box>

            <Box
              sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}
            >
              <Typography variant="body1">Direção horizontal:</Typography>
              <Typography variant="body1" fontWeight="medium">
                {azimuth}° {cardinalDirection}
              </Typography>
            </Box>

            <Box
              sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}
            >
              <Typography variant="body1">Altitude relativa:</Typography>
              <Typography variant="body1" fontWeight="medium">
                {formattedAltitude}
              </Typography>
            </Box>

            {marker.verticalAngle !== undefined && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="body1">Ângulo vertical:</Typography>
                <Typography variant="body1" fontWeight="medium">
                  {getVerticalDirectionText()}
                </Typography>
              </Box>
            )}
          </Box>
        </Card>
      </Box>

      {/* Botão de fechar fixo na parte inferior */}
      <Box
        sx={{
          p: 2,
          borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
          backgroundColor: alpha(theme.palette.background.paper, 0.8),
          backdropFilter: 'blur(10px)',
        }}
      >
        <Button
          variant="contained"
          onClick={handleClose}
          fullWidth
          size="large"
          startIcon={<CloseIcon />}
          sx={{
            py: 1.5,
            fontSize: '1rem',
            backgroundColor: categoryColor,
            '&:hover': {
              backgroundColor: alpha(categoryColor, 0.9),
            },
            borderRadius: 2,
          }}
        >
          Fechar
        </Button>
      </Box>
    </Box>
  );
};

export default InfoCard;
