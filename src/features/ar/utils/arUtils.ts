// Path: features\ar\utils\arUtils.ts
import { Marker, MarkerWithDistance } from '../schemas/markerSchema';

// ----- Distance and Direction Calculations -----

/**
 * Calculates distance between two coordinates using the Haversine formula
 * (Internal helper function)
 */
function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  if (isNaN(lat1) || isNaN(lng1) || isNaN(lat2) || isNaN(lng2)) {
    return Infinity;
  }

  // Haversine formula for accurate distances
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Calculates bearing between two points
 * (Internal helper function)
 */
function calculateBearing(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  if (isNaN(lat1) || isNaN(lng1) || isNaN(lat2) || isNaN(lng2)) {
    return 0;
  }

  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const λ1 = (lng1 * Math.PI) / 180;
  const λ2 = (lng2 * Math.PI) / 180;

  const y = Math.sin(λ2 - λ1) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(λ2 - λ1);

  const θ = Math.atan2(y, x);
  return ((θ * 180) / Math.PI + 360) % 360;
}

// ----- AR Positioning Calculations -----

/**
 * Calculates the horizontal position of a marker on screen
 */
export function calculateMarkerPosition(
  bearing: number,
  heading: number,
  fieldOfView: number = 60,
): number {
  // Calculate relative bearing
  let relativeBearing = bearing - heading;

  // Normalize to -180 to 180 degrees
  while (relativeBearing > 180) relativeBearing -= 360;
  while (relativeBearing < -180) relativeBearing += 360;

  // Convert to screen position (0-1)
  // We use a non-linear mapping to improve positioning at edges
  // This ensures markers at the edge of view don't get cut off
  const normalizedBearing = relativeBearing / (fieldOfView / 2);

  // Apply mild non-linear transformation to avoid markers at edges
  // getting too compressed
  const position = 0.5 + 0.45 * Math.sin((normalizedBearing * Math.PI) / 2);

  // Clamp to visible range with small margins (0.02-0.98)
  return Math.max(0.02, Math.min(0.98, position));
}

/**
 * Calculates marker size based on distance
 */
export function calculateMarkerSize(
  distance: number,
  baseSize: number = 60,
): number {
  // Logarithmic scale for more natural size reduction with distance
  // Adjusted to be more gradual
  const factor =
    1 - Math.min(0.8, Math.log10(Math.max(10, distance) / 20) / 2.5);
  const size = baseSize * Math.max(0.3, factor);

  return Math.max(30, Math.min(baseSize, size));
}

/**
 * Determines if a marker is potentially visible
 * (Internal helper function)
 */
function isMarkerInView(
  bearing: number,
  heading: number,
  fieldOfView: number = 60,
): boolean {
  // Calculate relative bearing
  let relativeBearing = bearing - heading;

  // Normalize to -180 to 180 degrees
  while (relativeBearing > 180) relativeBearing -= 360;
  while (relativeBearing < -180) relativeBearing += 360;

  // Add margin to field of view (15% extra on each side)
  const extendedFOV = fieldOfView * 1.3;

  // Check if within extended field of view
  return Math.abs(relativeBearing) < extendedFOV / 2;
}

/**
 * Calculate a vertical position offset that avoids overlapping
 * Based on bearing, distance and size
 */
export function calculateVerticalOffset(
  index: number,
  bearing: number,
  distance: number,
  size: number,
): number {
  // Use multiple factors to calculate vertical position:

  // 1. Base offset varies by distance (closer items lower/higher)
  const distanceFactor = Math.sin(distance / 100) * 30;

  // 2. Bearing-based offset (spread markers with similar bearings)
  const bearingFactor = Math.sin(bearing / 10) * 20;

  // 3. Size-based factor (larger markers need more space)
  const sizeFactor = (size - 40) * 0.5;

  // 4. Index-based offset to ensure consistent positioning
  const indexOffset = ((index % 3) - 1) * 15;

  // Combine factors with different weights
  return distanceFactor + bearingFactor + sizeFactor + indexOffset;
}

// ----- Filtering and Formatting -----

/**
 * Gets markers visible to the user based on position and heading
 */
export function getVisibleMarkers(
  markers: Marker[],
  userLat: number | null | undefined,
  userLng: number | null | undefined,
  userHeading: number | null | undefined,
  maxDistance: number = 500,
  fieldOfView: number = 60,
  maxVisibleMarkers: number = 10,
): MarkerWithDistance[] {
  if (
    !userLat ||
    !userLng ||
    userHeading === null ||
    userHeading === undefined ||
    !markers?.length
  ) {
    return [];
  }

  // Normalize heading
  const heading = ((userHeading % 360) + 360) % 360;

  // Process markers
  const markersWithDistance = markers
    .filter(marker => marker?.geometry?.coordinates?.length === 2)
    .map(marker => {
      try {
        const [lng, lat] = marker.geometry.coordinates;

        // Quick filter by maximum distance
        const distance = calculateDistance(userLat, userLng, lat, lng);
        if (distance > maxDistance) return null;

        // Calculate bearing
        const bearing = calculateBearing(userLat, userLng, lat, lng);

        // Expanded FOV for closer markers - more intuitive formula
        const expandedFov =
          fieldOfView * (1 + 0.3 * Math.max(0, 1 - distance / maxDistance));

        if (!isMarkerInView(bearing, heading, expandedFov)) return null;

        // Calculate priority based on distance and angle from center
        let relativeBearing = bearing - heading;
        while (relativeBearing > 180) relativeBearing -= 360;
        while (relativeBearing < -180) relativeBearing += 360;

        // Prioritize markers:
        // - higher priority for markers closer to center of view
        // - higher priority for closer markers
        const anglePriority =
          1 - Math.min(1, Math.abs(relativeBearing / (fieldOfView / 2)));
        const distancePriority = Math.max(0, 1 - distance / maxDistance);

        // Weight distance more than angle (0.7 vs 0.3)
        const priority = distancePriority * 0.7 + anglePriority * 0.3;

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
    );

  // Sort by priority and limit
  return markersWithDistance
    .sort((a, b) => b.priority - a.priority)
    .slice(0, maxVisibleMarkers)
    .map(({ priority, ...marker }) => marker);
}

// ----- Formatters -----

/**
 * Formats distance with appropriate units
 */
export function formatDistance(distanceInMeters: number): string {
  if (distanceInMeters < 1000) {
    return `${Math.round(distanceInMeters)}m`;
  } else {
    return `${(distanceInMeters / 1000).toFixed(1)}km`;
  }
}

/**
 * Converts azimuth (degrees) to cardinal direction
 */
export function azimuthToCardinal(azimuth: number): string {
  const cardinals = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW', 'N'];
  return cardinals[Math.round(azimuth / 45) % 8];
}
