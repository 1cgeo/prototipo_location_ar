// Path: routes\ARViewRoute.tsx
import CameraView from '@/features/ar/components/CameraView';
import ErrorBoundary from '@/features/ar/components/ErrorBoundary';

/**
 * Rota para a visualização de Realidade Aumentada com tratamento de erros
 */
const ARViewRoute = () => {
  return (
    <ErrorBoundary>
      <CameraView />
    </ErrorBoundary>
  );
};

export default ARViewRoute;