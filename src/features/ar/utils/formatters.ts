// Path: features\ar\utils\formatters.ts
/**
 * Formata a distância com a unidade apropriada (m ou km)
 *
 * @param distanceInMeters Distância em metros
 * @param precision Precisão decimal (padrão: 0 para metros, 1 para quilômetros)
 * @returns String formatada com unidade
 */
export const formatDistance = (
  distanceInMeters: number,
  precision?: number,
): string => {
  if (distanceInMeters < 1000) {
    // Metros sem casa decimal
    return `${Math.round(distanceInMeters)}m`;
  } else {
    // Quilômetros com 1 casa decimal por padrão
    const km = distanceInMeters / 1000;
    const p = precision !== undefined ? precision : 1;
    return `${km.toFixed(p)}km`;
  }
};

/**
 * Converte azimute (graus) para ponto cardeal
 * Usando abreviações internacionais (N, NE, E, SE, S, SW, W, NW)
 *
 * @param azimuth Ângulo em graus (0-360)
 * @returns Abreviação do ponto cardeal (N, NE, E, etc)
 */
export const azimuthToCardinal = (azimuth: number): string => {
  // Usa padrão internacional para pontos cardeais
  const cardinals = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW', 'N'];
  // 8 divisões, com 45° cada
  return cardinals[Math.round(azimuth / 45) % 8];
};

/**
 * Formata coordenadas geográficas em formato legível
 *
 * @param lat Latitude
 * @param lng Longitude
 * @param format Formato (dec = decimal, dms = graus, minutos, segundos)
 * @returns String formatada
 */
export const formatCoordinates = (
  lat: number,
  lng: number,
  format: 'dec' | 'dms' = 'dec',
): string => {
  if (format === 'dec') {
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  } else {
    // Implementação de conversão para DMS (graus, minutos, segundos)
    const latDMS = decimalToDMS(lat, 'lat');
    const lngDMS = decimalToDMS(lng, 'lng');
    return `${latDMS} ${lngDMS}`;
  }
};

/**
 * Converte coordenada decimal para formato DMS (graus, minutos, segundos)
 *
 * @param decimal Coordenada em formato decimal
 * @param type 'lat' para latitude, 'lng' para longitude
 * @returns String formatada em DMS
 */
const decimalToDMS = (decimal: number, type: 'lat' | 'lng'): string => {
  const absolute = Math.abs(decimal);
  const degrees = Math.floor(absolute);
  const minutesNotTruncated = (absolute - degrees) * 60;
  const minutes = Math.floor(minutesNotTruncated);
  const seconds = Math.floor((minutesNotTruncated - minutes) * 60);

  const direction =
    type === 'lat' ? (decimal >= 0 ? 'N' : 'S') : decimal >= 0 ? 'E' : 'W';

  return `${degrees}° ${minutes}' ${seconds}" ${direction}`;
};
