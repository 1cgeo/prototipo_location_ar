// Path: features\ar\stores\markersStore.ts
import { create } from 'zustand';
import {
  Marker,
  MarkerWithDistance,
  MarkersCollection,
  MarkersCollectionSchema,
} from '../schemas/markerSchema';
import { samplePOIs } from '../data/samplePOIs';

// Interface que define o estado e ações relacionadas aos marcadores
interface MarkersState {
  // Estado
  allMarkers: Marker[]; // Todos os marcadores disponíveis
  visibleMarkers: MarkerWithDistance[]; // Marcadores atualmente visíveis no campo de visão
  selectedMarkerId: string | null; // ID do marcador selecionado, se houver
  validationError: string | null; // Erro de validação, se houver

  // Ações
  setVisibleMarkers: (markers: MarkerWithDistance[]) => void;
  selectMarker: (id: string | null) => void;
  loadMarkers: (markersData: MarkersCollection) => void;
}

/**
 * Valida e carrega os dados dos marcadores utilizando os schemas Zod
 * @param data Dados de marcadores a serem validados
 * @returns Array de marcadores validados ou undefined em caso de erro
 */
const validateMarkersData = (
  data: any,
): { markers: Marker[] | undefined; error: string | null } => {
  try {
    const validData = MarkersCollectionSchema.parse(data);
    return { markers: validData.features, error: null };
  } catch (error) {
    console.error('Erro de validação de dados dos marcadores:', error);
    return {
      markers: undefined,
      error:
        error instanceof Error
          ? error.message
          : 'Erro desconhecido ao validar marcadores',
    };
  }
};

// Criação do store com Zustand
export const useMarkersStore = create<MarkersState>((set, _get) => {
  // Valida os dados de exemplo ao inicializar
  const { markers, error } = validateMarkersData(samplePOIs);

  return {
    // Estado inicial com marcadores de exemplo validados
    allMarkers: markers || [],
    visibleMarkers: [],
    selectedMarkerId: null,
    validationError: error,

    // Ações que modificam o estado
    setVisibleMarkers: markers => set({ visibleMarkers: markers }),
    selectMarker: id => set({ selectedMarkerId: id }),

    // Carrega e valida novos dados de marcadores
    loadMarkers: markersData => {
      const { markers, error } = validateMarkersData(markersData);
      if (markers) {
        set({
          allMarkers: markers,
          validationError: null,
        });
      } else {
        set({ validationError: error });
      }
    },
  };
});
