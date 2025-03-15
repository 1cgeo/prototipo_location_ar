// Path: features\ar\hooks\useScreenOrientation.ts
import { useState, useEffect, useCallback } from 'react';

type Orientation = 'portrait' | 'landscape';

interface ScreenDimensions {
  width: number;
  height: number;
}

/**
 * Hook to detect screen orientation and dimensions
 */
export const useScreenOrientation = () => {
  const [orientation, setOrientation] = useState<Orientation>(
    window.innerWidth > window.innerHeight ? 'landscape' : 'portrait',
  );

  const [dimensions, setDimensions] = useState<ScreenDimensions>({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  // Update dimensions and orientation on resize
  const updateDimensions = useCallback(() => {
    const width = window.innerWidth;
    const height = window.innerHeight;

    setDimensions({ width, height });
    setOrientation(width > height ? 'landscape' : 'portrait');
  }, []);

  useEffect(() => {
    // Initial update
    updateDimensions();

    // Listen for window resize
    window.addEventListener('resize', updateDimensions);

    // Listen for orientation change (mobile)
    window.addEventListener('orientationchange', () => {
      // Short delay to ensure dimensions are updated
      setTimeout(updateDimensions, 100);
    });

    return () => {
      window.removeEventListener('resize', updateDimensions);
      window.removeEventListener('orientationchange', updateDimensions);
    };
  }, [updateDimensions]);

  return { orientation, dimensions };
};
