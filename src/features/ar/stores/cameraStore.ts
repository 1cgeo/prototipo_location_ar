// Path: features\ar\stores\cameraStore.ts
import { create } from 'zustand';

// Interface que define o estado e ações relacionadas à câmera
interface CameraState {
  // Estado
  isActive: boolean; // Se a câmera está ativa ou não
  hasPermission: boolean | null; // Estado da permissão (null = não solicitada)
  error: string | null; // Mensagem de erro, se houver

  // Ações
  setActive: (active: boolean) => void;
  setPermission: (permission: boolean) => void;
  setError: (error: string | null) => void;
}

// Criação do store com Zustand
export const useCameraStore = create<CameraState>(set => ({
  // Estado inicial
  isActive: false,
  hasPermission: null,
  error: null,

  // Ações que modificam o estado
  setActive: active => set({ isActive: active }),
  setPermission: permission => set({ hasPermission: permission }),
  setError: error => set({ error }),
}));
