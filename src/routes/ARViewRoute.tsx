// Path: routes\ARViewRoute.tsx
import { Suspense, lazy, useEffect } from 'react';
import LoadingState from '@/features/ar/components/LoadingState';
import ErrorBoundary from '@/features/ar/components/ErrorBoundary';
import { setupARJS } from '@/features/ar/utils/arjsUtils';

// Add meta tags for mobile compatibility
const addMobileMetaTags = () => {
  if (typeof document !== 'undefined') {
    // Add mobile-web-app-capable meta tag (replaces deprecated apple-mobile-web-app-capable)
    const mobileCapableMeta = document.createElement('meta');
    mobileCapableMeta.name = 'mobile-web-app-capable';
    mobileCapableMeta.content = 'yes';
    document.head.appendChild(mobileCapableMeta);
    
    // Ensure proper viewport settings for AR
    const viewportMeta = document.querySelector('meta[name="viewport"]') as HTMLMetaElement | null;
    if (!viewportMeta) {
      const newViewportMeta = document.createElement('meta');
      newViewportMeta.name = 'viewport';
      newViewportMeta.content = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, minimal-ui';
      document.head.appendChild(newViewportMeta);
    } else {
      viewportMeta.content = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, minimal-ui';
    }
  }
};

// Lazy load the AR.js View component for better initial load performance
const ARJSView = lazy(() => import('@/features/ar/components/ARJSView'));

/**
 * AR View route component with error handling and lazy loading
 */
const ARViewRoute = () => {
  // Add mobile meta tags and initialize AR.js
  useEffect(() => {
    // Add mobile meta tags first
    addMobileMetaTags();
    
    // Then set up AR.js with a small delay to ensure A-Frame is loaded
    const initTimeout = setTimeout(() => {
      setupARJS();
    }, 100);
    
    return () => clearTimeout(initTimeout);
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