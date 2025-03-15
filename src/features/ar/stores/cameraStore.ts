// Path: features\ar\stores\cameraStore.ts
import { create } from 'zustand';

interface LogEntry {
  message: string;
  timestamp: string;
  type: 'info' | 'error' | 'warn';
}

interface CameraState {
  isActive: boolean;
  hasPermission: boolean | null;
  error: string | null;
  logs: LogEntry[];
  lastUpdated: number;

  setActive: (active: boolean) => void;
  setPermission: (permission: boolean) => void;
  setError: (error: string | null) => void;
  addLog: (message: string, type?: 'info' | 'error' | 'warn') => void;
  clearLogs: () => void;
}

export const useCameraStore = create<CameraState>(set => ({
  isActive: false,
  hasPermission: null,
  error: null,
  logs: [],
  lastUpdated: Date.now(),

  setActive: active =>
    set({
      isActive: active,
      lastUpdated: Date.now(),
    }),

  setPermission: permission =>
    set({
      hasPermission: permission,
      lastUpdated: Date.now(),
    }),

  setError: error =>
    set({
      error,
      lastUpdated: Date.now(),
    }),

  addLog: (message, type = 'info') =>
    set(state => {
      const timestamp = new Date().toISOString().split('T')[1].slice(0, 8);
      const newLog: LogEntry = { message, timestamp, type };

      // Keep only the last 100 logs to prevent memory issues
      const logs = [newLog, ...state.logs].slice(0, 100);

      return { logs, lastUpdated: Date.now() };
    }),

  clearLogs: () =>
    set({
      logs: [],
      lastUpdated: Date.now(),
    }),
}));
