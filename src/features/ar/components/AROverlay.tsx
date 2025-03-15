// Path: features\ar\components\AROverlay.tsx
import { useEffect, useCallback, useMemo, useState, useRef } from 'react';
import { Box, useTheme, SxProps, Theme, Badge } from '@mui/material';
import { useMarkersStore } from '../stores/markersStore';
import { getVisibleMarkers } from '../utils/distanceCalculations';
import {
  calculateMarkerPosition,
  calculateMarkerSize,
} from '../utils/arCalculations';
import Marker from './Marker';
import InfoCard from './InfoCard';

interface AROverlayProps {
  latitude: number;
  longitude: number;
  heading: number;
  orientation: 'portrait' | 'landscape';
  dimensions: {
    width: number;
    height: number;
  };
}

// Interface para marcadores com ajustes de posição
interface AdjustedMarker {
  marker: any;
  position: number;
  size: number;
  verticalOffset: number;
  count?: number;
  markersIds?: string[]; // IDs dos marcadores agrupados
}

/**
 * Chave para agrupar marcadores (por categoria e posição aproximada)
 * Versão otimizada que considera a largura da tela para melhor agrupamento
 */
const getGroupKey = (
  position: number,
  category: string,
  screenWidth: number,
  distance: number,
): string => {
  // Tamanho da célula adaptado ao tamanho da tela e à distância
  // Em telas maiores, células menores para agrupamento mais preciso
  // Marcadores mais próximos recebem células menores para maior precisão
  const distanceFactor = Math.min(1, distance / 300);
  const widthFactor = screenWidth > 1024 ? 0.5 : screenWidth > 768 ? 0.7 : 1;
  const cellSize = (0.03 + distanceFactor * 0.05) * widthFactor;

  const positionBucket = Math.floor(position / cellSize) * cellSize;
  return `${category}_${positionBucket.toFixed(3)}_${Math.floor(distance / 100)}`;
};

/**
 * Componente de sobreposição otimizado que exibe marcadores AR sobre o feed da câmera
 * Com melhor gerenciamento de performance e renderizações
 */
const AROverlay: React.FC<AROverlayProps> = ({
  latitude,
  longitude,
  heading,
  orientation,
  dimensions,
}) => {
  const theme = useTheme();
  const { allMarkers, visibleMarkers, selectedMarkerId, setVisibleMarkers } =
    useMarkersStore();

  // Refs para otimizar performance
  const previousVisibleMarkersRef = useRef<string[]>([]);
  const updateTimerRef = useRef<number | null>(null);

  // Estado para marcadores com ajustes posicionais
  const [adjustedMarkers, setAdjustedMarkers] = useState<AdjustedMarker[]>([]);

  // Detecta se estamos em um tablet ou desktop (memoizado)
  const { isTablet, isDesktop, fieldOfView, markerLimit, baseMarkerSize } =
    useMemo(() => {
      const isTablet = dimensions.width >= 768;
      const isDesktop = dimensions.width >= 1024;

      // Campo de visão adaptável baseado no dispositivo e orientação
      const fieldOfView = isDesktop
        ? orientation === 'landscape'
          ? 65
          : 50
        : isTablet
          ? orientation === 'landscape'
            ? 70
            : 55
          : orientation === 'landscape'
            ? 75
            : 60;

      // Limite de marcadores para performance - adaptado ao dispositivo
      const markerLimit = isDesktop ? 15 : isTablet ? 12 : 8;

      // Tamanho base do marcador adaptado ao dispositivo
      const baseMarkerSize = isDesktop ? 80 : isTablet ? 70 : 60;

      return { isTablet, isDesktop, fieldOfView, markerLimit, baseMarkerSize };
    }, [orientation, dimensions.width]);

  // Memoização da função de cálculo de posição para evitar recálculos
  const calculatePosition = useCallback(
    (bearing: number) => {
      return calculateMarkerPosition(bearing, heading, fieldOfView);
    },
    [heading, fieldOfView],
  );

  // Atualiza os marcadores visíveis com throttling para melhor performance
  useEffect(() => {
    // Validação robusta para evitar cálculos desnecessários
    if (
      typeof latitude !== 'number' ||
      typeof longitude !== 'number' ||
      typeof heading !== 'number' ||
      isNaN(latitude) ||
      isNaN(longitude) ||
      isNaN(heading)
    ) {
      return;
    }

    // Limpa timer anterior se existir
    if (updateTimerRef.current) {
      window.clearTimeout(updateTimerRef.current);
    }

    // Throttle de atualizações (100ms)
    updateTimerRef.current = window.setTimeout(() => {
      // Distância máxima adaptada ao dispositivo - maior em telas maiores
      const maxDistance = isDesktop ? 800 : isTablet ? 600 : 500;

      // Obtém marcadores dentro do campo de visão com limite de quantidade
      const markers = getVisibleMarkers(
        allMarkers,
        latitude,
        longitude,
        heading,
        maxDistance,
        fieldOfView,
        markerLimit,
      );

      // Verifica se a lista de marcadores realmente mudou para evitar re-renders
      const currentIds = markers
        .map(m => m.id)
        .sort()
        .join(',');
      const previousIds = previousVisibleMarkersRef.current.join(',');

      if (currentIds !== previousIds) {
        setVisibleMarkers(markers);
        previousVisibleMarkersRef.current = markers.map(m => m.id);
      }
    }, 100);

    return () => {
      if (updateTimerRef.current) {
        window.clearTimeout(updateTimerRef.current);
      }
    };
  }, [
    latitude,
    longitude,
    heading,
    allMarkers,
    fieldOfView,
    setVisibleMarkers,
    isTablet,
    isDesktop,
    markerLimit,
  ]);

  // Função eficiente para verificar sobreposição de marcadores
  // Adaptada para usar porcentagem da largura da tela em vez de valores fixos
  const checkOverlap = useCallback(
    (posA: number, sizeA: number, posB: number, sizeB: number): boolean => {
      // Distância máxima entre centros para considerar sobreposição
      // Usa porcentagem da tela para melhor adaptação a diferentes tamanhos
      const maxDistance = ((sizeA + sizeB) / dimensions.width) * 0.6;
      return Math.abs(posA - posB) < maxDistance;
    },
    [dimensions.width],
  );

  // Processa marcadores para evitar sobreposição (memoizado para reduzir cálculos)
  const processMarkers = useCallback(() => {
    if (!visibleMarkers.length || !heading) return [];

    // Resultado final dos marcadores processados
    const result: AdjustedMarker[] = [];

    // Mapa de grupos de marcadores
    const markerGroups: Record<string, AdjustedMarker> = {};

    // Primeira passagem: agrupar marcadores por categoria e posição similar
    visibleMarkers.forEach(marker => {
      const horizontalPosition = calculatePosition(marker.bearing);
      const baseSize = baseMarkerSize;
      const size = calculateMarkerSize(marker.distance, baseSize);

      // Ignora marcadores fora da área visível
      if (horizontalPosition < 0 || horizontalPosition > 1) {
        return;
      }

      const category = marker.properties.category;
      // Usa a largura da tela e distância para melhor agrupamento
      const groupKey = getGroupKey(
        horizontalPosition,
        category,
        dimensions.width,
        marker.distance,
      );

      // Verifica se já existe um grupo para esta categoria/posição
      if (markerGroups[groupKey]) {
        // Verifica distância entre marcadores para decidir se agrupa
        // Ajuste dinâmico do threshold baseado na distância
        const existingMarker = markerGroups[groupKey].marker;
        const distanceDiffPercentage = Math.abs(
          (existingMarker.distance - marker.distance) /
            Math.max(existingMarker.distance, marker.distance),
        );

        // Threshold dinâmico: mais tolerante para marcadores distantes, mais estrito para próximos
        const distanceThreshold = Math.min(0.25, 0.1 + marker.distance / 1000);

        if (distanceDiffPercentage < distanceThreshold) {
          // Agrupa os marcadores
          markerGroups[groupKey].count =
            (markerGroups[groupKey].count || 1) + 1;
          markerGroups[groupKey].markersIds = [
            ...(markerGroups[groupKey].markersIds || [existingMarker.id]),
            marker.id,
          ];

          // Usa o marcador mais próximo como representante do grupo
          if (marker.distance < existingMarker.distance) {
            markerGroups[groupKey].marker = marker;
            markerGroups[groupKey].position = horizontalPosition;
            markerGroups[groupKey].size = size;
          }
          return;
        }
      }

      // Não encontrou um grupo adequado, cria um novo marker
      const newMarker: AdjustedMarker = {
        marker,
        position: horizontalPosition,
        size,
        verticalOffset: 0,
        count: 1,
        markersIds: [marker.id],
      };

      // Adiciona ao mapa de grupos
      markerGroups[groupKey] = newMarker;
    });

    // Converte o mapa de grupos em uma lista
    const groupedMarkers = Object.values(markerGroups);

    // Segunda passagem: resolve sobreposições de grupos diferentes
    // Com valores relativos adaptados ao tamanho da tela
    groupedMarkers.forEach(markerData => {
      // Define o máximo de tentativas de posicionamento
      const maxAttempts = 6; // Aumentado para mais tentativas

      // Calcula deslocamento vertical baseado na altura da tela (% em vez de px fixos)
      // Para telas menores, usamos deslocamentos relativamente maiores
      const getVerticalOffset = (attempt: number): number => {
        // Fator de offset baseado na altura da tela e distância do marcador
        const distanceFactor = Math.min(1, markerData.marker.distance / 500);
        const baseOffsetPercent =
          dimensions.height < 600
            ? 8 + distanceFactor * 4 // Telas pequenas: 8-12%
            : 6 + distanceFactor * 3; // Telas maiores: 6-9%

        // Padrão em ziguezague com aumento progressivo
        const direction = attempt % 2 === 0 ? -1 : 1;
        const magnitude = Math.floor(attempt / 2) + 1;

        return (
          direction *
          magnitude *
          ((dimensions.height * baseOffsetPercent) / 100)
        );
      };

      // Encontra um espaço vertical disponível
      let verticalOffset = 0;
      let attempts = 0;
      let positionValid = false;

      while (!positionValid && attempts < maxAttempts) {
        positionValid = true;

        // Verifica se há sobreposição nesta posição vertical
        for (const existing of result) {
          if (
            checkOverlap(
              existing.position,
              existing.size,
              markerData.position,
              markerData.size,
            )
          ) {
            positionValid = false;
            // Tenta positions alternadas em % da altura da tela
            verticalOffset = getVerticalOffset(attempts);
            break;
          }
        }

        attempts++;
      }

      // Adiciona à lista de marcadores processados com o offset encontrado
      result.push({
        ...markerData,
        verticalOffset,
      });
    });

    // Ordenação para garantir que os marcadores mais próximos apareçam por cima
    return result.sort((a, b) => a.marker.distance - b.marker.distance);
  }, [
    visibleMarkers,
    heading,
    calculatePosition,
    checkOverlap,
    dimensions.width,
    dimensions.height,
    baseMarkerSize,
  ]);

  // Atualiza marcadores processados quando necessário
  useEffect(() => {
    const processed = processMarkers();
    setAdjustedMarkers(processed);
  }, [processMarkers]);

  // Encontra o marcador selecionado (memoizado)
  const selectedMarker = useMemo(() => {
    return visibleMarkers.find(marker => marker.id === selectedMarkerId);
  }, [visibleMarkers, selectedMarkerId]);

  // Determina posição do InfoCard com base na orientação e tamanho de tela (memoizado)
  const infoCardPosition = useMemo((): SxProps<Theme> => {
    // Base comum para todos os estilos
    const base = {
      position: 'absolute',
      zIndex: 100,
      pointerEvents: 'auto',
    };

    if (orientation === 'landscape') {
      return {
        ...base,
        right: theme.spacing(isDesktop ? 3 : 2),
        top: '50%',
        transform: 'translateY(-50%)',
        width: isDesktop ? '30%' : isTablet ? '35%' : '45%',
        maxWidth: isDesktop ? 450 : 400,
        maxHeight: '80vh',
        overflowY: 'auto',
      };
    } else {
      return {
        ...base,
        bottom: theme.spacing(isDesktop ? 3 : 2),
        left: '50%',
        transform: 'translateX(-50%)',
        width: isDesktop ? '40%' : isTablet ? '70%' : '90%',
        maxWidth: isDesktop ? 600 : 500,
        // Adiciona um valor seguro para evitar problemas com notch no iPhone
        paddingBottom: 'env(safe-area-inset-bottom)',
      };
    }
  }, [orientation, theme, isTablet, isDesktop]);

  return (
    <Box
      sx={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        userSelect: 'none',
      }}
    >
      {/* Renderiza os marcadores processados */}
      {adjustedMarkers.map(
        ({ marker, position, size, verticalOffset, count }) => {
          // Se houver agrupamento (count > 1), mostra um indicador
          if (count && count > 1) {
            return (
              <Box
                key={marker.id}
                sx={{
                  position: 'absolute',
                  left: `${position * 100}%`,
                  top: '50%',
                  transform: `translate(-50%, -50%) translateY(${verticalOffset}px)`,
                  zIndex:
                    marker.distance < 200 ? 12 : verticalOffset < 0 ? 9 : 11, // Prioriza marcadores próximos
                }}
              >
                <Badge
                  badgeContent={count}
                  color="primary"
                  overlap="circular"
                  sx={{
                    '& .MuiBadge-badge': {
                      fontSize: isTablet ? '0.9rem' : '0.75rem',
                      height: isTablet ? 28 : 22,
                      minWidth: isTablet ? 28 : 22,
                    },
                  }}
                >
                  <Marker
                    position={position}
                    size={size}
                    marker={marker}
                    deviceSize={dimensions}
                  />
                </Badge>
              </Box>
            );
          }

          // Marcador individual com possível deslocamento vertical
          return (
            <Box
              key={marker.id}
              sx={{
                position: 'absolute',
                left: `${position * 100}%`,
                top: '50%',
                transform: `translate(-50%, -50%) translateY(${verticalOffset}px)`,
                zIndex:
                  marker.distance < 200 ? 12 : verticalOffset < 0 ? 9 : 11,
                transition: 'transform 0.2s ease-out',
              }}
            >
              <Marker
                position={position}
                size={size}
                marker={marker}
                deviceSize={dimensions}
              />
            </Box>
          );
        },
      )}

      {/* Exibe o cartão de informações para o marcador selecionado */}
      {selectedMarker && (
        <Box sx={infoCardPosition}>
          <InfoCard
            marker={selectedMarker}
            orientation={orientation}
            isTablet={isTablet}
          />
        </Box>
      )}
    </Box>
  );
};

export default AROverlay;
