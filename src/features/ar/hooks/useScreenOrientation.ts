// Path: features\ar\hooks\useScreenOrientation.ts
import { useState, useEffect } from 'react';

type Orientation = 'portrait' | 'landscape';

/**
 * Hook personalizado para detectar e responder a mudanças na orientação da tela
 * @returns Objeto com a orientação atual e dimensões da tela
 */
export const useScreenOrientation = () => {
  const [orientation, setOrientation] = useState<Orientation>(
    window.innerWidth > window.innerHeight ? 'landscape' : 'portrait',
  );
  const [dimensions, setDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;

      setDimensions({ width, height });
      setOrientation(width > height ? 'landscape' : 'portrait');
    };

    // Detecta mudanças de tamanho/orientação da janela
    window.addEventListener('resize', handleResize);

    // Evento específico para orientação em mobile
    window.addEventListener('orientationchange', () => {
      // Pequeno atraso para garantir que dimensões foram atualizadas
      setTimeout(handleResize, 100);
    });

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  return { orientation, dimensions };
};
