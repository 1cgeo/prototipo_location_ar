// Path: routes\ARViewRoute.tsx
import { Suspense, lazy } from 'react';
import LoadingState from '@/features/ar/components/LoadingState';
import ErrorBoundary from '@/features/ar/components/ErrorBoundary';

// Lazy load the CameraView component for better initial load performance
const CameraView = lazy(() => import('@/features/ar/components/CameraView'));

/**
 * AR View route component with error handling and lazy loading
 */
const ARViewRoute = () => {
  return (
    <ErrorBoundary>
      <Suspense fallback={<LoadingState message="Loading AR view..." />}>
        <CameraView />
      </Suspense>
    </ErrorBoundary>
  );
};

export default ARViewRoute;
