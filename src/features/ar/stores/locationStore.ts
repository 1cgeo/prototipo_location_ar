// Path: features\ar\stores\locationStore.ts
import { create } from 'zustand';

// Interface que define o estado e ações relacionadas à localização
interface LocationState {
  // Estado
  coordinates: {
    latitude: number | null;
    longitude: number | null;
    accuracy: number | null;
  };
  heading: number | null; // Direção em graus (0-360, onde 0 é Norte)
  hasPermission: boolean | null; // Estado da permissão
  error: string | null; // Mensagem de erro, se houver

  // Ações
  setCoordinates: (lat: number, lng: number, accuracy: number) => void;
  setHeading: (heading: number) => void;
  setPermission: (permission: boolean) => void;
  setError: (error: string | null) => void;
}

// Criação do store com Zustand
export const useLocationStore = create<LocationState>(set => ({
  // Estado inicial
  coordinates: {
    latitude: null,
    longitude: null,
    accuracy: null,
  },
  heading: null,
  hasPermission: null,
  error: null,

  // Ações que modificam o estado
  setCoordinates: (latitude, longitude, accuracy) =>
    set({ coordinates: { latitude, longitude, accuracy } }),
  setHeading: heading => set({ heading }),
  setPermission: permission => set({ hasPermission: permission }),
  setError: error => set({ error }),
}));
