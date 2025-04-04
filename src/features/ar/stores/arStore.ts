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
  compassCalibrated: boolean;
  locationPermission: boolean | null;
  locationError: string | null;

  // Markers state
  allMarkers: Marker[];
  visibleMarkers: MarkerWithDistance[];
  selectedMarkerId: string | null;
  markersGenerated: boolean;

  // Location actions
  setCoordinates: (lat: number, lng: number, accuracy: number) => void;
  setHeading: (heading: number) => void;
  setCompassCalibrated: (calibrated: boolean) => void;
  setLocationPermission: (permission: boolean) => void;
  setLocationError: (error: string | null) => void;

  // Markers actions
  selectMarker: (id: string | null) => void;
  generateMarkersAtLocation: (lat: number, lng: number) => void;
  updateVisibleMarkers: () => void;
}

export const useARStore = create<ARState>((set, get) => ({
  // Initial location state
  coordinates: {
    latitude: null,
    longitude: null,
    accuracy: null,
  },
  heading: null,
  compassCalibrated: false,
  locationPermission: null,
  locationError: null,

  // Initial markers state
  allMarkers: samplePOIs.features,
  visibleMarkers: [],
  selectedMarkerId: null,
  markersGenerated: false,

  // Location actions
  setCoordinates: (latitude, longitude, accuracy) => {
    set({ coordinates: { latitude, longitude, accuracy } });

    // If we receive location for the first time and markers are not generated yet,
    // generate markers around the user's current position
    const state = get();
    if (latitude && longitude) {
      if (!state.markersGenerated) {
        get().generateMarkersAtLocation(latitude, longitude);
      } else {
        // Update the visible markers with new distance calculations
        get().updateVisibleMarkers();
      }
    }
  },

  setHeading: heading => set({ heading }),
  setCompassCalibrated: calibrated => set({ compassCalibrated: calibrated }),
  setLocationPermission: permission => set({ locationPermission: permission }),
  setLocationError: error => set({ locationError: error }),

  // Markers actions
  selectMarker: id => set({ selectedMarkerId: id }),

  // Generate new markers at the user's location
  generateMarkersAtLocation: (lat, lng) => {
    console.log(`Generating POIs around location: ${lat}, ${lng}`);
    const newPOIs = generateSamplePOIs(lat, lng);

    set({
      allMarkers: newPOIs.features,
      markersGenerated: true,
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
  },

  // Update visible markers when location changes
  updateVisibleMarkers: () => {
    const state = get();
    if (
      state.coordinates.latitude &&
      state.coordinates.longitude &&
      state.allMarkers.length > 0
    ) {
      const processedMarkers = processMarkers(
        state.allMarkers,
        state.coordinates.latitude,
        state.coordinates.longitude,
      );

      set({ visibleMarkers: processedMarkers });
    }
  },
}));
