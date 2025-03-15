// Path: features\ar\utils\formatters.ts

/**
 * Formats distance with appropriate units (m or km)
 */
export const formatDistance = (
  distanceInMeters: number,
  precision?: number,
): string => {
  if (distanceInMeters < 1000) {
    // Meters with no decimal places
    return `${Math.round(distanceInMeters)}m`;
  } else {
    // Kilometers with configurable precision (default: 1)
    const km = distanceInMeters / 1000;
    const p = precision !== undefined ? precision : 1;
    return `${km.toFixed(p)}km`;
  }
};

/**
 * Converts azimuth (degrees) to cardinal direction
 */
export const azimuthToCardinal = (azimuth: number): string => {
  // International standard for cardinal points
  const cardinals = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW', 'N'];
  // 8 divisions of 45° each
  return cardinals[Math.round(azimuth / 45) % 8];
};

/**
 * Formats coordinates in a readable format
 */
export const formatCoordinates = (
  lat: number,
  lng: number,
  format: 'dec' | 'dms' = 'dec',
): string => {
  if (format === 'dec') {
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
  } else {
    const latDMS = decimalToDMS(lat, 'lat');
    const lngDMS = decimalToDMS(lng, 'lng');
    return `${latDMS} ${lngDMS}`;
  }
};

/**
 * Converts decimal coordinates to degrees, minutes, seconds format
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
