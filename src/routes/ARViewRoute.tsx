// Path: routes\ARViewRoute.tsx
import { Suspense, lazy, useEffect } from 'react';
import LoadingState from '@/features/ar/components/LoadingState';
import ErrorBoundary from '@/features/ar/components/ErrorBoundary';
import { setupARJS } from '@/features/ar/utils/arjsUtils';

// Lazy load the AR.js View component for better initial load performance
const ARJSView = lazy(() => import('@/features/ar/components/ARJSView'));

/**
 * AR View route component with error handling and lazy loading
 */
const ARViewRoute = () => {
  // Initialize AR.js custom components
  useEffect(() => {
    setupARJS();
  }, []);

  return (
    <ErrorBoundary>
      <Suspense fallback={<LoadingState message="Loading AR view..." />}>
        <ARJSView />
      </Suspense>
    </ErrorBoundary>
  );
};

export default ARViewRoute;
