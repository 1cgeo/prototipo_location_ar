// Path: features\ar\hooks\useScreenOrientation.ts
import { useState, useEffect, useCallback } from 'react';

export type Orientation = 'portrait' | 'landscape';

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

  const updateDimensions = useCallback(() => {
    const width = window.innerWidth;
    const height = window.innerHeight;

    setDimensions({ width, height });
    setOrientation(width > height ? 'landscape' : 'portrait');
  }, []);

  useEffect(() => {
    // Initial update
    updateDimensions();

    // Event listeners
    window.addEventListener('resize', updateDimensions);
    window.addEventListener('orientationchange', () => {
      setTimeout(updateDimensions, 100);
    });

    return () => {
      window.removeEventListener('resize', updateDimensions);
      window.removeEventListener('orientationchange', updateDimensions);
    };
  }, [updateDimensions]);

  return { orientation, dimensions };
};
