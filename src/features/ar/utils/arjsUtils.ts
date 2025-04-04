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
      console.log('Setting up AR.js components with A-Frame:', window.AFRAME.version);
      
      // Register click handler for GPS entities
      if (!window.AFRAME.components['gps-entity-click-handler']) {
        window.AFRAME.registerComponent('gps-entity-click-handler', {
          init: function() {
            // Use arrow function to preserve 'this' context
            this.el.addEventListener('click', () => {
              const markerId = this.el.getAttribute('data-marker-id');
              if (markerId && window.selectARMarker) {
                window.selectARMarker(markerId);
              }
            });
          }
        });
      }

      // Expose method to global scope for A-Frame entities to access
      window.selectARMarker = (markerId: string) => {
        // This will be defined by the ARJSView component
        if (window.arjsEventHandlers && window.arjsEventHandlers.onMarkerSelect) {
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
    const checkInterval = setInterval(() => {
      attempts++;
      if (setupARComponents() || attempts >= maxAttempts) {
        clearInterval(checkInterval);
        if (attempts >= maxAttempts && !window.AFRAME) {
          console.warn('Failed to initialize AR.js after multiple attempts: A-Frame not available');
        }
      }
    }, 200 * Math.min(attempts + 1, 5)); // Exponential backoff up to 1 second
  }
}

/**
 * Calculates distance between two coordinates using Haversine formula
 */
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
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
  
  return R * c;
}

/**
 * Calculates bearing between two points
 */
export function calculateBearing(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
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
 * Calculates the horizontal position of a marker on screen
 */
export function calculateMarkerPosition(
  bearing: number,
  heading: number,
  fieldOfView: number = 60
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
 */
export function processMarkers(
  markers: Marker[],
  userLat: number,
  userLng: number
): MarkerWithDistance[] {
  if (!userLat || !userLng || !markers?.length) {
    return [];
  }
  
  return markers
    .filter(marker => marker?.geometry?.coordinates?.length === 2)
    .map(marker => {
      try {
        const [lng, lat] = marker.geometry.coordinates;
        
        // Calculate distance and bearing
        const distance = calculateDistance(userLat, userLng, lat, lng);
        const bearing = calculateBearing(userLat, userLng, lat, lng);
        
        return {
          ...marker,
          distance,
          bearing
        };
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