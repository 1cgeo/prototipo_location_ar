// Path: vite-env.d.ts

/**
 * Declarações de variáveis de ambiente para o Vite
 */
interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_ENABLE_DEBUG: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/**
 * Extensões para API DeviceOrientationEvent para iOS
 */
interface DeviceOrientationEventsupport {
  requestPermission?: () => Promise<PermissionState>;
}

interface DeviceOrientationEventStatic extends DeviceOrientationEventsupport {
  new (): DeviceOrientationEvent;
}

declare var DeviceOrientationEvent: DeviceOrientationEventStatic;
