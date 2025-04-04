// Path: features\ar\utils\arjsUtils.ts
import { Marker, MarkerWithDistance } from '../schemas/markerSchema';

/**
 * Sets up AR.js custom components and utilities
 * Uses a polling approach to ensure A-Frame is loaded before attempting setup
 */
export function setupARJS() {
  // Only attempt setup when in browser environment
  if (typeof window === 'undefined') return;

  // Function to check if A-Frame is available and setup components
  const setupARComponents = () => {
    if (window.AFRAME) {
      console.log(
        'Setting up AR.js components with A-Frame:',
        window.AFRAME.version,
      );

      // Register click handler for GPS entities
      if (!window.AFRAME.components['gps-entity-click-handler']) {
        window.AFRAME.registerComponent('gps-entity-click-handler', {
          init: function () {
            // Use arrow function to preserve 'this' context
            this.el.addEventListener('click', () => {
              const markerId = this.el.getAttribute('data-marker-id');
              if (markerId && window.selectARMarker) {
                window.selectARMarker(markerId);
              }
            });
          },
        });
      }

      // Expose method to global scope for A-Frame entities to access
      window.selectARMarker = (markerId: string) => {
        // This will be defined by the ARJSView component
        if (
          window.arjsEventHandlers &&
          window.arjsEventHandlers.onMarkerSelect
        ) {
          window.arjsEventHandlers.onMarkerSelect(markerId);
        }
      };

      return true;
    }
    return false;
  };

  // Try to set up immediately, but if A-Frame isn't ready,
  // set up a delayed retry with increasing backoff
  if (!setupARComponents()) {
    let attempts = 0;
    const maxAttempts = 10;
    const checkInterval = setInterval(
      () => {
        attempts++;
        if (setupARComponents() || attempts >= maxAttempts) {
          clearInterval(checkInterval);
          if (attempts >= maxAttempts && !window.AFRAME) {
            console.warn(
              'Failed to initialize AR.js after multiple attempts: A-Frame not available',
            );
          }
        }
      },
      200 * Math.min(attempts + 1, 5),
    ); // Exponential backoff up to 1 second
  }
}

/**
 * Calculates distance between two coordinates using Haversine formula and altitude difference
 * Updated to handle 3D distance with altitude
 */
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
  alt1: number = 0,
  alt2: number = 0,
): number {
  if (isNaN(lat1) || isNaN(lng1) || isNaN(lat2) || isNaN(lng2)) {
    return Infinity;
  }

  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  // 2D distance (on the earth's surface)
  const distance2D = R * c;

  // Altitude difference
  const altDiff = alt2 - alt1;

  // 3D distance (using Pythagorean theorem)
  return Math.sqrt(distance2D * distance2D + altDiff * altDiff);
}

/**
 * Calculates bearing between two points
 */
export function calculateBearing(
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

/**
 * Calculates vertical angle to a marker (elevation angle)
 * Positive for markers above the user, negative for below
 */
export function calculateVerticalAngle(
  userAlt: number,
  markerAlt: number,
  distance2D: number,
): number {
  if (distance2D === 0) return 90; // Directly above/below

  const altDiff = markerAlt - userAlt;
  // Calculate elevation angle in degrees
  return Math.atan2(altDiff, distance2D) * (180 / Math.PI);
}

/**
 * Calculates the horizontal position of a marker on screen
 */
export function calculateMarkerPosition(
  bearing: number,
  heading: number,
  fieldOfView: number = 60,
): number {
  // Calcula posição considerando a orientação correta da bússola
  let relativeBearing = bearing - heading;

  // Normalize to -180 to 180 degrees
  while (relativeBearing > 180) relativeBearing -= 360;
  while (relativeBearing < -180) relativeBearing += 360;

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
  if (distanceInMeters < 1000) {
    return `${Math.round(distanceInMeters)}m`;
  } else {
    return `${(distanceInMeters / 1000).toFixed(1)}km`;
  }
}

/**
 * Formats altitude with appropriate sign and unit
 */
export function formatAltitude(altitudeInMeters: number): string {
  const sign = altitudeInMeters >= 0 ? '+' : '';
  return `${sign}${Math.round(altitudeInMeters)}m`;
}

/**
 * Converts azimuth (degrees) to cardinal direction
 * Ajustado para direção correta da bússola
 */
export function azimuthToCardinal(azimuth: number): string {
  // Ajustado para mapear corretamente as direções cardeais
  const cardinals = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW', 'N'];
  return cardinals[Math.round(azimuth / 45) % 8];
}

/**
 * Process markers to add distance and bearing information
 * Updated to handle altitude
 */
export function processMarkers(
  markers: Marker[],
  userLat: number,
  userLng: number,
  userAlt: number = 0,
): MarkerWithDistance[] {
  if (!userLat || !userLng || !markers?.length) {
    return [];
  }

  // Using a type assertion to fix the filtering issue
  return markers
    .filter(marker => marker?.geometry?.coordinates?.length >= 2)
    .map(marker => {
      try {
        // Extract coordinates
        const [lng, lat, altitude = 0] = marker.geometry.coordinates;

        // Calculate 2D distance and bearing
        const distance2D = calculateDistance(userLat, userLng, lat, lng);
        const bearing = calculateBearing(userLat, userLng, lat, lng);

        // Calculate 3D distance including altitude
        const distance3D = calculateDistance(
          userLat,
          userLng,
          lat,
          lng,
          userAlt,
          altitude,
        );

        // Calculate vertical angle (elevation)
        const verticalAngle = calculateVerticalAngle(
          userAlt,
          altitude,
          distance2D,
        );

        // Create a properly typed MarkerWithDistance object
        const markerWithDistance: MarkerWithDistance = {
          ...marker,
          distance: distance3D,
          bearing,
          verticalAngle,
        };

        return markerWithDistance;
      } catch (error) {
        return null;
      }
    })
    .filter((marker): marker is MarkerWithDistance => marker !== null);
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
