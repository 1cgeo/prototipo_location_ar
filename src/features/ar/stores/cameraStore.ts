// Path: features\ar\stores\cameraStore.ts
import { create } from 'zustand';

interface CameraState {
  isActive: boolean;
  hasPermission: boolean | null;
  error: string | null;

  setActive: (active: boolean) => void;
  setPermission: (permission: boolean) => void;
  setError: (error: string | null) => void;
}

export const useCameraStore = create<CameraState>(set => ({
  isActive: false,
  hasPermission: null,
  error: null,

  setActive: active => set({ isActive: active }),
  setPermission: permission => set({ hasPermission: permission }),
  setError: error => set({ error }),
}));
