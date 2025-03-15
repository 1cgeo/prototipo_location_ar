// Path: features\ar\stores\markersStore.ts
import { create } from 'zustand';
import {
  Marker,
  MarkerWithDistance,
  MarkersCollection,
  MarkersCollectionSchema,
} from '../schemas/markerSchema';
import { samplePOIs } from '../data/samplePOIs';

interface MarkersState {
  allMarkers: Marker[];
  visibleMarkers: MarkerWithDistance[];
  selectedMarkerId: string | null;
  error: string | null;

  setVisibleMarkers: (markers: MarkerWithDistance[]) => void;
  selectMarker: (id: string | null) => void;
  loadMarkers: (markersData: MarkersCollection) => void;
}

export const useMarkersStore = create<MarkersState>(set => {
  // Validate initial sample data
  let initialMarkers: Marker[] = [];
  let initialError: string | null = null;

  try {
    const validData = MarkersCollectionSchema.parse(samplePOIs);
    initialMarkers = validData.features;
  } catch (error) {
    initialError =
      error instanceof Error ? error.message : 'Invalid marker data';
    console.error('Error validating sample data:', error);
  }

  return {
    allMarkers: initialMarkers,
    visibleMarkers: [],
    selectedMarkerId: null,
    error: initialError,

    setVisibleMarkers: markers => set({ visibleMarkers: markers }),
    selectMarker: id => set({ selectedMarkerId: id }),

    loadMarkers: markersData => {
      try {
        const validData = MarkersCollectionSchema.parse(markersData);
        set({
          allMarkers: validData.features,
          error: null,
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Invalid marker data';
        set({ error: errorMessage });
        console.error('Error validating marker data:', error);
      }
    },
  };
});
