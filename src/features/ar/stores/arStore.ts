// Path: features\ar\stores\arStore.ts
import { create } from 'zustand';
import { MarkerWithDistance, Marker } from '../schemas/markerSchema';
import { samplePOIs, generateSamplePOIs } from '../data/samplePOIs';
import { processMarkers } from '../utils/arjsUtils';

interface ARState {
  // Location state
  coordinates: {
    latitude: number | null;
    longitude: number | null;
    accuracy: number | null;
  };
  heading: number | null;
  locationPermission: boolean | null;
  locationError: string | null;

  // Markers state
  allMarkers: Marker[];
  visibleMarkers: MarkerWithDistance[];
  selectedMarkerId: string | null;
  markersGenerated: boolean;
  lastUpdateTime: number;

  // Location actions
  setCoordinates: (lat: number, lng: number, accuracy: number) => void;
  setHeading: (heading: number) => void;
  setLocationPermission: (permission: boolean) => void;
  setLocationError: (error: string | null) => void;

  // Markers actions
  selectMarker: (id: string | null) => void;
  generateMarkersAtLocation: (lat: number, lng: number) => void;
  updateVisibleMarkers: () => void;
  resetMarkers: () => void;
}

export const useARStore = create<ARState>((set, get) => ({
  // Initial location state
  coordinates: {
    latitude: null,
    longitude: null,
    accuracy: null,
  },
  heading: null,
  locationPermission: null,
  locationError: null,

  // Initial markers state
  allMarkers: samplePOIs.features,
  visibleMarkers: [],
  selectedMarkerId: null,
  markersGenerated: false,
  lastUpdateTime: 0,

  // Location actions
  setCoordinates: (latitude, longitude, accuracy) => {
    // If coordinates are invalid, don't update
    if (isNaN(latitude) || isNaN(longitude) || isNaN(accuracy)) {
      console.warn('Invalid coordinates received:', {
        latitude,
        longitude,
        accuracy,
      });
      return;
    }

    // Update coordinates
    set({ coordinates: { latitude, longitude, accuracy } });

    // Check for significant location change (more than 10 meters)
    const state = get();
    const prevLat = state.coordinates.latitude;
    const prevLng = state.coordinates.longitude;
    let shouldUpdateMarkers = false;

    if (prevLat !== null && prevLng !== null) {
      // Calculate rough distance from previous position
      const latDiff = Math.abs(latitude - prevLat);
      const lngDiff = Math.abs(longitude - prevLng);
      const approxDistanceMoved =
        Math.sqrt(latDiff * latDiff + lngDiff * lngDiff) * 111000; // rough meters

      // Update markers if moved more than 10 meters
      shouldUpdateMarkers = approxDistanceMoved > 10;
    }

    // If we receive location for the first time and markers are not generated yet,
    // generate markers around the user's current position
    if (latitude && longitude) {
      if (!state.markersGenerated) {
        get().generateMarkersAtLocation(latitude, longitude);
      } else if (shouldUpdateMarkers) {
        // Update marker distances and bearings when user moves significantly
        const now = Date.now();
        // Throttle updates to at most once per second
        if (now - state.lastUpdateTime > 1000) {
          get().updateVisibleMarkers();
          set({ lastUpdateTime: now });
        }
      }
    }
  },

  setHeading: heading => {
    // Validate heading
    if (isNaN(heading)) {
      console.warn('Invalid heading received:', heading);
      return;
    }

    // Normalize heading to 0-360 range
    const normalizedHeading = ((heading % 360) + 360) % 360;
    set({ heading: normalizedHeading });
  },

  setLocationPermission: permission => set({ locationPermission: permission }),
  setLocationError: error => set({ locationError: error }),

  // Markers actions
  selectMarker: id => set({ selectedMarkerId: id }),

  // Generate new markers at the user's location
  generateMarkersAtLocation: (lat, lng) => {
    try {
      console.log(`Generating POIs around location: ${lat}, ${lng}`);

      // Input validation
      if (isNaN(lat) || isNaN(lng)) {
        console.error('Invalid coordinates for POI generation:', { lat, lng });
        return;
      }

      const newPOIs = generateSamplePOIs(lat, lng);

      set({
        allMarkers: newPOIs.features,
        markersGenerated: true,
        lastUpdateTime: Date.now(),
      });

      // Process markers with distance and bearing for UI
      const state = get();
      if (state.coordinates.latitude && state.coordinates.longitude) {
        const processedMarkers = processMarkers(
          newPOIs.features,
          state.coordinates.latitude,
          state.coordinates.longitude,
        );

        set({ visibleMarkers: processedMarkers });
      }
    } catch (error) {
      console.error('Error generating POIs:', error);
      // Fallback to empty markers
      set({
        allMarkers: [],
        visibleMarkers: [],
        markersGenerated: true,
      });
    }
  },

  // Update visible markers when location changes
  updateVisibleMarkers: () => {
    const state = get();
    if (
      state.coordinates.latitude &&
      state.coordinates.longitude &&
      state.allMarkers.length > 0
    ) {
      try {
        const processedMarkers = processMarkers(
          state.allMarkers,
          state.coordinates.latitude,
          state.coordinates.longitude,
        );

        set({
          visibleMarkers: processedMarkers,
          lastUpdateTime: Date.now(),
        });
      } catch (error) {
        console.error('Error updating visible markers:', error);
        // Don't update if there's an error
      }
    }
  },

  // Reset markers state
  resetMarkers: () => {
    set({
      allMarkers: [],
      visibleMarkers: [],
      selectedMarkerId: null,
      markersGenerated: false,
    });
  },
}));
