// Path: features\ar\utils\distanceCalculations.ts
import { Marker, MarkerWithDistance } from '../schemas/markerSchema';
import { isMarkerInView, calculateMarkerPriority } from './arCalculations';

// Interface do cache com timestamp e LRU tracking
interface CacheEntry {
  value: number;
  timestamp: number;
  lastAccessed: number; // Timestamp da última vez que o item foi acessado
}

// Cache para distâncias e bearings calculados recentemente
const distanceCache = new Map<string, CacheEntry>();
const bearingCache = new Map<string, CacheEntry>();

// Tempo de expiração do cache em ms (5 minutos)
const CACHE_EXPIRATION = 5 * 60 * 1000;
// Tamanho máximo do cache antes de acionar limpeza LRU
const MAX_CACHE_SIZE = 500;
// Porcentagem a ser removida durante a limpeza
const CACHE_CLEANUP_PERCENT = 0.3;

// Implementação de limpeza LRU (Least Recently Used)
const cleanCache = () => {
  const now = Date.now();

  // Função de limpeza para cada cache
  const cleanCacheMap = (cacheMap: Map<string, CacheEntry>) => {
    // Se o cache está muito grande, remove os itens menos utilizados
    if (cacheMap.size > MAX_CACHE_SIZE) {
      // Ordena por último acesso (mais antigo primeiro)
      const entries = Array.from(cacheMap.entries()).sort(
        (a, b) => a[1].lastAccessed - b[1].lastAccessed,
      );

      // Remove os 30% menos utilizados
      const removeCount = Math.floor(cacheMap.size * CACHE_CLEANUP_PERCENT);

      for (let i = 0; i < removeCount; i++) {
        if (entries[i]) {
          cacheMap.delete(entries[i][0]);
        }
      }
    }

    // Também remove entradas expiradas
    for (const [key, entry] of cacheMap.entries()) {
      if (now - entry.timestamp > CACHE_EXPIRATION) {
        cacheMap.delete(key);
      }
    }
  };

  // Limpa ambos os caches
  cleanCacheMap(distanceCache);
  cleanCacheMap(bearingCache);
};

// Gera uma chave de cache para coordenadas
// Usa menos precisão para coordenadas distantes para melhorar hits de cache
const cacheKey = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): string => {
  // Calcula distância aproximada para determinar precisão necessária
  const approxDist = Math.abs(lat1 - lat2) + Math.abs(lng1 - lng2);

  // Ajusta precisão baseado na distância aproximada
  // Coordenadas mais distantes precisam de menos casas decimais
  const precision = approxDist > 0.1 ? 4 : approxDist > 0.01 ? 5 : 6;

  return `${lat1.toFixed(precision)},${lng1.toFixed(precision)}_${lat2.toFixed(precision)},${lng2.toFixed(precision)}`;
};

/**
 * Calcula a distância entre dois pontos usando a fórmula de Haversine
 * Versão otimizada com cache e aproximação para distâncias grandes
 *
 * @param lat1 Latitude do primeiro ponto
 * @param lng1 Longitude do primeiro ponto
 * @param lat2 Latitude do segundo ponto
 * @param lng2 Longitude do segundo ponto
 * @returns Distância em metros
 */
function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  // Validação rápida de parâmetros
  if (isNaN(lat1) || isNaN(lng1) || isNaN(lat2) || isNaN(lng2)) {
    return Infinity;
  }

  // Verifica cache primeiro
  const key = cacheKey(lat1, lng1, lat2, lng2);
  const now = Date.now();

  if (distanceCache.has(key)) {
    const entry = distanceCache.get(key)!;

    // Verifica se a entrada do cache expirou
    if (now - entry.timestamp <= CACHE_EXPIRATION) {
      // Atualiza timestamp de último acesso para LRU
      entry.lastAccessed = now;
      distanceCache.set(key, entry);
      return entry.value;
    }
    // Se expirou, remova do cache
    distanceCache.delete(key);
  }

  // Aproximação rápida para verificar se é uma distância grande
  // 1 grau ≈ 111km no equador
  // Ajustado para considerar a largura real em diferentes latitudes
  const latFactor = 111000; // metros por grau de latitude
  const lngFactor = 111000 * Math.cos((lat1 * Math.PI) / 180); // metros por grau de longitude nesta latitude

  const approxDist = Math.sqrt(
    Math.pow((lat2 - lat1) * latFactor, 2) +
      Math.pow((lng2 - lng1) * lngFactor, 2),
  );

  // Para distâncias muito grandes (> 10km), a aproximação é suficiente
  // e economiza processamento
  if (approxDist > 10000) {
    distanceCache.set(key, {
      value: approxDist,
      timestamp: now,
      lastAccessed: now,
    });
    return approxDist;
  }

  // Cálculo de Haversine para distâncias menores (mais preciso)
  const R = 6371e3; // Raio da Terra em metros
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const distance = R * c;

  // Guarda no cache para uso futuro
  distanceCache.set(key, {
    value: distance,
    timestamp: now,
    lastAccessed: now,
  });

  return distance;
}

/**
 * Calcula o bearing (direção) entre dois pontos
 * Versão otimizada com cache temporal
 *
 * @param lat1 Latitude do primeiro ponto
 * @param lng1 Longitude do primeiro ponto
 * @param lat2 Latitude do segundo ponto
 * @param lng2 Longitude do segundo ponto
 * @returns Direção em graus (0-360, onde 0 é Norte)
 */
function calculateBearing(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  // Validação rápida
  if (isNaN(lat1) || isNaN(lng1) || isNaN(lat2) || isNaN(lng2)) {
    return 0;
  }

  // Verifica cache com expiração
  const key = cacheKey(lat1, lng1, lat2, lng2);
  const now = Date.now();

  if (bearingCache.has(key)) {
    const entry = bearingCache.get(key)!;

    // Verifica validade do cache
    if (now - entry.timestamp <= CACHE_EXPIRATION) {
      // Atualiza timestamp de último acesso para LRU
      entry.lastAccessed = now;
      bearingCache.set(key, entry);
      return entry.value;
    }
    // Cache expirado, remove
    bearingCache.delete(key);
  }

  // Cálculo de bearing
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const λ1 = (lng1 * Math.PI) / 180;
  const λ2 = (lng2 * Math.PI) / 180;

  const y = Math.sin(λ2 - λ1) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(λ2 - λ1);

  const θ = Math.atan2(y, x);
  const bearing = ((θ * 180) / Math.PI + 360) % 360;

  // Guarda no cache com timestamp e acesso
  bearingCache.set(key, {
    value: bearing,
    timestamp: now,
    lastAccessed: now,
  });

  return bearing;
}

/**
 * Filtro rápido para descartar marcadores obviamente fora de alcance
 * Esta função evita cálculos desnecessários de distância/bearing
 */
function isWithinRoughDistance(
  userLat: number,
  userLng: number,
  markerLat: number,
  markerLng: number,
  maxDistance: number,
): boolean {
  // Calcula a "caixa" aproximada em graus
  // 1 grau ≈ 111km - convertendo maxDistance de metros para graus
  const maxDegrees = maxDistance / 111000;

  // Verificação rápida de latitude
  if (Math.abs(userLat - markerLat) > maxDegrees) {
    return false;
  }

  // Ajuste para a longitude (depende da latitude)
  // A longitude tem comprimento variável dependendo da latitude
  const latFactor = Math.cos((userLat * Math.PI) / 180);
  const adjustedMaxDegreesLng = maxDegrees / Math.max(0.1, latFactor);

  // Verificação rápida de longitude
  if (Math.abs(userLng - markerLng) > adjustedMaxDegreesLng) {
    return false;
  }

  return true;
}

/**
 * Filtra os marcadores visíveis com base na posição, orientação e campo de visão
 * Versão otimizada para performance com redução de cálculos desnecessários
 */
export const getVisibleMarkers = (
  markers: Marker[],
  userLat: number | null | undefined,
  userLng: number | null | undefined,
  userHeading: number | null | undefined,
  maxDistance: number = 500, // metros
  fieldOfView: number = 60, // graus
  maxVisibleMarkers: number = 10, // limite de marcadores
): MarkerWithDistance[] => {
  // Validação simplificada
  if (
    !userLat ||
    !userLng ||
    !userHeading ||
    !Array.isArray(markers) ||
    markers.length === 0
  ) {
    return [];
  }

  // Limpa cache periodicamente ao processar marcadores
  cleanCache();

  // Normaliza o heading
  const normalizedHeading = ((userHeading % 360) + 360) % 360;

  // Processa os marcadores com otimizações
  const markersWithData = markers
    // Valida a estrutura dos marcadores primeiro
    .filter(marker => marker?.geometry?.coordinates?.length === 2)
    // Mapeia para adicionar distância e bearing
    .map(marker => {
      try {
        const [lng, lat] = marker.geometry.coordinates;

        // Filtro rápido: usando aproximação para eliminar marcadores claramente fora de alcance
        if (
          !isWithinRoughDistance(userLat, userLng, lat, lng, maxDistance * 1.1)
        ) {
          return null;
        }

        // Cálculo preciso de distância para marcadores em range potencial
        const distance = calculateDistance(userLat, userLng, lat, lng);

        // Filtro por distância máxima
        if (distance > maxDistance) {
          return null;
        }

        const bearing = calculateBearing(userLat, userLng, lat, lng);

        // Verifica se está no campo de visão - usa um campo ligeiramente expandido
        // para marcadores próximos para evitar cortes bruscos nas bordas
        const expandedFov = fieldOfView + Math.min(20, (500 - distance) / 20);

        if (!isMarkerInView(bearing, normalizedHeading, expandedFov, 10)) {
          return null;
        }

        // Cálculo de prioridade para ordenação
        let relativeBearing = bearing - normalizedHeading;
        while (relativeBearing > 180) relativeBearing -= 360;
        while (relativeBearing < -180) relativeBearing += 360;

        const priority = calculateMarkerPriority(
          distance,
          relativeBearing,
          fieldOfView,
        );

        return {
          ...marker,
          distance,
          bearing,
          priority,
        };
      } catch (error) {
        return null;
      }
    })
    .filter(
      (marker): marker is MarkerWithDistance & { priority: number } =>
        marker !== null,
    )
    // Ordenar por prioridade (combinação de distância e centralidade)
    .sort((a, b) => b.priority - a.priority);

  // Limitamos o número de marcadores e removemos os campos extras
  return markersWithData
    .slice(0, maxVisibleMarkers)
    .map(({ priority, ...marker }) => marker);
};
