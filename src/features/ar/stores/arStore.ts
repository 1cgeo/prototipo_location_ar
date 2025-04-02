// Path: features\ar\stores\arStore.ts
import { create } from 'zustand';
import { MarkerWithDistance, Marker } from '../schemas/markerSchema';
import { samplePOIs, generateSamplePOIs } from '../data/samplePOIs';

interface ARState {
  // Camera state
  isCameraActive: boolean;
  cameraPermission: boolean | null;
  cameraError: string | null;

  // Location state
  coordinates: {
    latitude: number | null;
    longitude: number | null;
    accuracy: number | null;
  };
  heading: number | null;
  locationPermission: boolean | null;
  locationError: string | null;
  isOrientationCalibrated: boolean;
  useFallbackHeading: boolean;

  // Markers state
  allMarkers: Marker[];
  visibleMarkers: MarkerWithDistance[];
  selectedMarkerId: string | null;
  markersGenerated: boolean;
  lastGeneratedLocation: {
    latitude: number | null;
    longitude: number | null;
  };

  // Camera actions
  setCameraActive: (active: boolean) => void;
  setCameraPermission: (permission: boolean) => void;
  setCameraError: (error: string | null) => void;

  // Location actions
  setCoordinates: (lat: number, lng: number, accuracy: number) => void;
  setHeading: (heading: number) => void;
  setLocationPermission: (permission: boolean) => void;
  setLocationError: (error: string | null) => void;
  setOrientationCalibrated: (calibrated: boolean) => void;
  setUseFallbackHeading: (useFallback: boolean) => void;

  // Markers actions
  setVisibleMarkers: (markers: MarkerWithDistance[]) => void;
  selectMarker: (id: string | null) => void;
  generateMarkersAtLocation: (lat: number, lng: number) => void;
  refreshMarkers: () => void;
}

// Function to calculate distance between two coordinates
const calculateDistance = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number => {
  if (!lat1 || !lng1 || !lat2 || !lng2) return Infinity;

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
};

export const useARStore = create<ARState>((set, get) => ({
  // Initial camera state
  isCameraActive: false,
  cameraPermission: null,
  cameraError: null,

  // Initial location state
  coordinates: {
    latitude: null,
    longitude: null,
    accuracy: null,
  },
  heading: null,
  locationPermission: null,
  locationError: null,
  isOrientationCalibrated: false,
  useFallbackHeading: false,

  // Initial markers state
  allMarkers: samplePOIs.features,
  visibleMarkers: [],
  selectedMarkerId: null,
  markersGenerated: false,
  lastGeneratedLocation: {
    latitude: null,
    longitude: null,
  },

  // Camera actions
  setCameraActive: active => set({ isCameraActive: active }),
  setCameraPermission: permission => set({ cameraPermission: permission }),
  setCameraError: error => set({ cameraError: error }),

  // Location actions
  setCoordinates: (latitude, longitude, accuracy) => {
    set({ coordinates: { latitude, longitude, accuracy } });

    // Generate markers for first-time users or refresh if significant movement detected
    const state = get();

    // If we have no markers yet, always generate them
    if (latitude && longitude && !state.markersGenerated) {
      get().generateMarkersAtLocation(latitude, longitude);
      return;
    }

    // Check if user has moved significantly (>100m) from last generated position
    const { lastGeneratedLocation } = state;
    if (
      latitude &&
      longitude &&
      lastGeneratedLocation.latitude &&
      lastGeneratedLocation.longitude
    ) {
      const distance = calculateDistance(
        latitude,
        longitude,
        lastGeneratedLocation.latitude,
        lastGeneratedLocation.longitude,
      );

      // Automatically refresh markers if moved more than 100 meters
      if (distance > 100) {
        get().generateMarkersAtLocation(latitude, longitude);
      }
    }
  },
  setHeading: heading => set({ heading }),
  setLocationPermission: permission => set({ locationPermission: permission }),
  setLocationError: error => set({ locationError: error }),
  setOrientationCalibrated: calibrated =>
    set({ isOrientationCalibrated: calibrated }),
  setUseFallbackHeading: useFallback =>
    set({ useFallbackHeading: useFallback }),

  // Markers actions
  setVisibleMarkers: markers => set({ visibleMarkers: markers }),
  selectMarker: id => set({ selectedMarkerId: id }),

  // Generate new markers at specified location
  generateMarkersAtLocation: (lat, lng) => {
    console.log(`Gerando POIs em torno da localização: ${lat}, ${lng}`);
    const newPOIs = generateSamplePOIs(lat, lng);
    set({
      allMarkers: newPOIs.features,
      markersGenerated: true,
      lastGeneratedLocation: {
        latitude: lat,
        longitude: lng,
      },
    });
  },

  // Manual refresh of markers at current location
  refreshMarkers: () => {
    const { coordinates } = get();
    if (coordinates.latitude && coordinates.longitude) {
      get().generateMarkersAtLocation(
        coordinates.latitude,
        coordinates.longitude,
      );
    }
  },
}));
