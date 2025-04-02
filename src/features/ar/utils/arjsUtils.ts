// Path: features\ar\utils\arjsUtils.ts
import { Marker, MarkerWithDistance } from '../schemas/markerSchema';

/**
 * Sets up AR.js custom components and utilities
 */
export function setupARJS() {
  if (typeof window !== 'undefined' && window.AFRAME) {
    // Check if already initialized to prevent duplicate registration
    if (window.AFRAME.components['gps-entity-click-handler']) {
      return;
    }

    // Register click handler for GPS entities
    window.AFRAME.registerComponent('gps-entity-click-handler', {
      init: function () {
        // Use arrow function to preserve 'this' context
        this.el.addEventListener('click', () => {
          const markerId = this.el.getAttribute('data-marker-id');
          if (markerId && window.arjsEventHandlers?.onMarkerSelect) {
            window.arjsEventHandlers.onMarkerSelect(markerId);
          }
        });
      },
    });

    // Expose method to global scope for A-Frame entities to access
    // This is a bridge between the React world and A-Frame world
    window.selectARMarker = (markerId: string) => {
      // This will be defined by the ARJSView component
      if (window.arjsEventHandlers && window.arjsEventHandlers.onMarkerSelect) {
        window.arjsEventHandlers.onMarkerSelect(markerId);
      }
    };

    console.log('AR.js custom components registered successfully');
  } else {
    console.warn('AR.js setup failed: AFRAME not available');
  }
}

/**
 * Calculates distance between two coordinates using Haversine formula
 * with additional checks for edge cases
 */
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  // Input validation
  if (isNaN(lat1) || isNaN(lng1) || isNaN(lat2) || isNaN(lng2)) {
    return Infinity;
  }

  // Check if points are identical
  if (lat1 === lat2 && lng1 === lng2) {
    return 0;
  }

  // Normalize coordinates to handle edge cases
  const normLat1 = Math.max(-90, Math.min(90, lat1));
  const normLat2 = Math.max(-90, Math.min(90, lat2));
  const normLng1 = ((lng1 + 540) % 360) - 180;
  const normLng2 = ((lng2 + 540) % 360) - 180;

  const R = 6371e3; // Earth's radius in meters
  const φ1 = (normLat1 * Math.PI) / 180;
  const φ2 = (normLat2 * Math.PI) / 180;
  const Δφ = ((normLat2 - normLat1) * Math.PI) / 180;
  const Δλ = ((normLng2 - normLng1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Calculates bearing between two points with protection for edge cases
 */
export function calculateBearing(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  // Input validation
  if (isNaN(lat1) || isNaN(lng1) || isNaN(lat2) || isNaN(lng2)) {
    return 0;
  }

  // Check if points are identical
  if (lat1 === lat2 && lng1 === lng2) {
    return 0;
  }

  // Normalize coordinates
  const normLat1 = Math.max(-90, Math.min(90, lat1));
  const normLat2 = Math.max(-90, Math.min(90, lat2));
  const normLng1 = ((lng1 + 540) % 360) - 180;
  const normLng2 = ((lng2 + 540) % 360) - 180;

  const φ1 = (normLat1 * Math.PI) / 180;
  const φ2 = (normLat2 * Math.PI) / 180;
  const λ1 = (normLng1 * Math.PI) / 180;
  const λ2 = (normLng2 * Math.PI) / 180;

  const y = Math.sin(λ2 - λ1) * Math.cos(φ2);
  const x =
    Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(λ2 - λ1);

  const θ = Math.atan2(y, x);
  return ((θ * 180) / Math.PI + 360) % 360;
}

/**
 * Calculates the horizontal position of a marker on screen
 * with improved field of view handling
 */
export function calculateMarkerPosition(
  bearing: number,
  heading: number,
  fieldOfView: number = 60,
): number {
  // Input validation
  if (
    isNaN(bearing) ||
    isNaN(heading) ||
    isNaN(fieldOfView) ||
    fieldOfView <= 0
  ) {
    return 0.5; // Default to center if inputs are invalid
  }

  // Calculate relative bearing
  let relativeBearing = bearing - heading;

  // Normalize to -180 to 180 degrees
  while (relativeBearing > 180) relativeBearing -= 360;
  while (relativeBearing < -180) relativeBearing += 360;

  // If marker is behind, clamp to edge
  if (relativeBearing > 90) return 0.95;
  if (relativeBearing < -90) return 0.05;

  // Convert to screen position (0-1)
  // Add safety margin to avoid markers at the edges
  const position = 0.5 + relativeBearing / fieldOfView;

  // Clamp to 0.05-0.95 range
  return Math.max(0.05, Math.min(0.95, position));
}

/**
 * Formats distance with appropriate units
 */
export function formatDistance(distanceInMeters: number): string {
  if (isNaN(distanceInMeters) || distanceInMeters < 0) {
    return 'Unknown';
  }

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
  if (isNaN(azimuth)) return 'N/A';

  const normalized = ((azimuth % 360) + 360) % 360; // Normalize to 0-360
  const cardinals = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW', 'N'];
  return cardinals[Math.round(normalized / 45) % 8];
}

/**
 * Process markers to add distance and bearing information
 * with improved error handling
 */
export function processMarkers(
  markers: Marker[],
  userLat: number,
  userLng: number,
): MarkerWithDistance[] {
  // Input validation
  if (!userLat || !userLng || !markers?.length) {
    return [];
  }

  try {
    return (
      markers
        .filter(
          marker =>
            marker &&
            marker.geometry &&
            Array.isArray(marker.geometry.coordinates) &&
            marker.geometry.coordinates.length === 2 &&
            !isNaN(marker.geometry.coordinates[0]) &&
            !isNaN(marker.geometry.coordinates[1]),
        )
        .map(marker => {
          try {
            const [lng, lat] = marker.geometry.coordinates;

            // Calculate distance and bearing
            const distance = calculateDistance(userLat, userLng, lat, lng);
            const bearing = calculateBearing(userLat, userLng, lat, lng);

            return {
              ...marker,
              distance,
              bearing,
            };
          } catch (error) {
            console.error('Error processing marker:', error, marker);
            return null;
          }
        })
        .filter((marker): marker is MarkerWithDistance => marker !== null)
        // Sort by distance for better UI presentation
        .sort((a, b) => a.distance - b.distance)
    );
  } catch (error) {
    console.error('Critical error in processMarkers:', error);
    return [];
  }
}

// Add TypeScript declarations for global AR.js integration
declare global {
  interface Window {
    selectARMarker: (markerId: string) => void;
    arjsEventHandlers?: {
      onMarkerSelect?: (markerId: string) => void;
    };
    AFRAME: any;
  }
}
