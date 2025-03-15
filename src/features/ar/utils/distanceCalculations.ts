// Path: features\ar\utils\distanceCalculations.ts
import { Marker, MarkerWithDistance } from '../schemas/markerSchema';
import { isMarkerInView, calculateMarkerPriority } from './arCalculations';

/**
 * Calculates the distance between two points using the Haversine formula
 */
function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  // Quick validation
  if (isNaN(lat1) || isNaN(lng1) || isNaN(lat2) || isNaN(lng2)) {
    return Infinity;
  }

  // Fast approximation for large distances (>10km)
  const latFactor = 111000; // meters per degree of latitude
  const lngFactor = 111000 * Math.cos((lat1 * Math.PI) / 180); // meters per degree of longitude

  const approxDist = Math.sqrt(
    Math.pow((lat2 - lat1) * latFactor, 2) +
      Math.pow((lng2 - lng1) * lngFactor, 2),
  );

  if (approxDist > 10000) {
    return approxDist;
  }

  // Haversine formula for more accurate distances
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
 * Calculates the bearing between two points
 */
function calculateBearing(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  // Quick validation
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

/**
 * Filter function to quickly eliminate markers that are too far away
 */
function isWithinRoughDistance(
  userLat: number,
  userLng: number,
  markerLat: number,
  markerLng: number,
  maxDistance: number,
): boolean {
  // Convert maxDistance from meters to rough degrees
  const maxDegrees = maxDistance / 111000;

  // Latitude check
  if (Math.abs(userLat - markerLat) > maxDegrees) {
    return false;
  }

  // Longitude check (adjusted for latitude)
  const latFactor = Math.cos((userLat * Math.PI) / 180);
  const adjustedMaxDegreesLng = maxDegrees / Math.max(0.1, latFactor);

  if (Math.abs(userLng - markerLng) > adjustedMaxDegreesLng) {
    return false;
  }

  return true;
}

/**
 * Gets markers that are visible to the user based on position and heading
 */
export const getVisibleMarkers = (
  markers: Marker[],
  userLat: number | null | undefined,
  userLng: number | null | undefined,
  userHeading: number | null | undefined,
  maxDistance: number = 500,
  fieldOfView: number = 60,
  maxVisibleMarkers: number = 10,
): MarkerWithDistance[] => {
  // Validate inputs
  if (
    !userLat ||
    !userLng ||
    !userHeading ||
    !Array.isArray(markers) ||
    markers.length === 0
  ) {
    return [];
  }

  // Normalize heading
  const normalizedHeading = ((userHeading % 360) + 360) % 360;

  // Process markers
  const markersWithData = markers
    // Validate structure
    .filter(marker => marker?.geometry?.coordinates?.length === 2)
    // Add distance and bearing data
    .map(marker => {
      try {
        const [lng, lat] = marker.geometry.coordinates;

        // Quick elimination of distant markers
        if (
          !isWithinRoughDistance(userLat, userLng, lat, lng, maxDistance * 1.1)
        ) {
          return null;
        }

        // Calculate precise distance
        const distance = calculateDistance(userLat, userLng, lat, lng);

        // Filter by maximum distance
        if (distance > maxDistance) {
          return null;
        }

        // Calculate bearing
        const bearing = calculateBearing(userLat, userLng, lat, lng);

        // Check if in field of view
        // Add a margin based on distance (closer = bigger margin)
        const expandedFov = fieldOfView + Math.min(20, (500 - distance) / 20);

        if (!isMarkerInView(bearing, normalizedHeading, expandedFov, 10)) {
          return null;
        }

        // Calculate relative bearing for priority
        let relativeBearing = bearing - normalizedHeading;
        while (relativeBearing > 180) relativeBearing -= 360;
        while (relativeBearing < -180) relativeBearing += 360;

        // Calculate priority (closer and more central = higher priority)
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
    .filter(marker => marker !== null) as (MarkerWithDistance & {
    priority: number;
  })[];

  // Sort by priority and limit number of markers
  return markersWithData
    .sort((a, b) => b.priority - a.priority)
    .slice(0, maxVisibleMarkers)
    .map(({ priority, ...marker }) => marker);
};
