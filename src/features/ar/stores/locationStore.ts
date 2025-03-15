// Path: features\ar\stores\locationStore.ts
import { create } from 'zustand';

interface LocationState {
  coordinates: {
    latitude: number | null;
    longitude: number | null;
    accuracy: number | null;
  };
  heading: number | null;
  hasPermission: boolean | null;
  error: string | null;

  setCoordinates: (lat: number, lng: number, accuracy: number) => void;
  setHeading: (heading: number) => void;
  setPermission: (permission: boolean) => void;
  setError: (error: string | null) => void;
}

export const useLocationStore = create<LocationState>(set => ({
  coordinates: {
    latitude: null,
    longitude: null,
    accuracy: null,
  },
  heading: null,
  hasPermission: null,
  error: null,

  setCoordinates: (latitude, longitude, accuracy) =>
    set({ coordinates: { latitude, longitude, accuracy } }),
  setHeading: heading => set({ heading }),
  setPermission: permission => set({ hasPermission: permission }),
  setError: error => set({ error }),
}));
