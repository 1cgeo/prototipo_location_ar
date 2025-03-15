// Path: features\ar\hooks\useCamera.ts
import { useEffect, useRef, useState, useCallback } from 'react';
import { useCameraStore } from '../stores/cameraStore';

// Constantes de configuração
const ORIENTATION_DEBOUNCE = 500; // ms para debounce de orientação
const CAMERA_RESTART_DELAY = 300; // ms de espera antes de reiniciar
const CAMERA_INIT_RETRY_MAX = 3; // Número máximo de tentativas de inicialização
const CAMERA_INIT_RETRY_DELAY = 1000; // ms entre tentativas de inicialização

/**
 * Hook personalizado otimizado para gerenciar o acesso à câmera do dispositivo
 * com reinicialização estável e melhor tratamento de erros
 *
 * @param videoRef Referência para o elemento de vídeo HTML
 * @returns Objeto com funções e estado da câmera
 */
export const useCamera = (
  videoRef: React.RefObject<HTMLVideoElement | null>,
) => {
  const { isActive, hasPermission, error, setActive, setPermission, setError } =
    useCameraStore();
  const streamRef = useRef<MediaStream | null>(null);
  const [lastOrientation, setLastOrientation] = useState<string | null>(null);
  const [isAdjusting, setIsAdjusting] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const permissionRequestedRef = useRef(false);
  const initAttemptsRef = useRef(0);

  // Usando useRef para variáveis de timer
  const debounceTimerRef = useRef<number | null>(null);
  const restartTimerRef = useRef<number | null>(null);
  const retryTimerRef = useRef<number | null>(null);

  /**
   * Limpa um stream de vídeo de forma segura
   */
  const cleanupStream = useCallback((stream?: MediaStream | null) => {
    const streamToClean = stream || streamRef.current;
    if (streamToClean) {
      streamToClean.getTracks().forEach(track => {
        try {
          track.stop();
        } catch (err) {
          console.warn('Erro ao parar track de vídeo:', err);
        }
      });
    }
  }, []);

  /**
   * Verifica se a orientação realmente mudou significativamente
   * para evitar reinicializações desnecessárias
   */
  const hasOrientationChanged = useCallback((): boolean => {
    const isLandscape = window.innerWidth > window.innerHeight;
    const currentOrientation = isLandscape ? 'landscape' : 'portrait';

    // Se não temos orientação anterior, consideramos que mudou
    if (!lastOrientation) {
      setLastOrientation(currentOrientation);
      return true;
    }

    // Verifica se realmente mudou
    const changed = lastOrientation !== currentOrientation;

    if (changed) {
      setLastOrientation(currentOrientation);
    }

    return changed;
  }, [lastOrientation]);

  /**
   * Função que solicita permissão da câmera diretamente, sem depender de outras condições
   */
  const requestCameraPermission = useCallback(async () => {
    // Reseta contador de tentativas de inicialização
    initAttemptsRef.current = 0;
    
    // Evita múltiplas solicitações
    if (permissionRequestedRef.current) {
      permissionRequestedRef.current = false; // Resets to allow new requests
    }
    
    console.log('Solicitando permissão da câmera explicitamente');

    try {
      // Solicita acesso à câmera com parâmetros mínimos
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });

      // Limpa o stream obtido (apenas para validar permissão)
      cleanupStream(stream);

      // Marca como permitido
      setPermission(true);
      setError(null);
      console.log('Permissão da câmera concedida');

      // Agora que temos permissão, podemos iniciar a câmera com os parâmetros completos
      startCamera();
    } catch (err) {
      console.error('Erro ao solicitar permissão da câmera:', err);
      setPermission(false);
      setError(err instanceof Error ? err.message : 'Erro ao acessar câmera');
    }
  }, [cleanupStream, setError, setPermission]);

  /**
   * Inicia a câmera e configura o stream de vídeo
   * Implementação otimizada para maior estabilidade
   */
  const startCamera = useCallback(async () => {
    // Limpa qualquer temporizador de retry pendente
    if (retryTimerRef.current) {
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    
    try {
      // Evita múltiplas inicializações simultâneas
      if (isAdjusting) return;
      setIsAdjusting(true);

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('API de câmera não suportada neste navegador');
      }

      // Obter dimensões atuais para determinar proporção ideal
      const isLandscape = window.innerWidth > window.innerHeight;
      const currentOrientation = isLandscape ? 'landscape' : 'portrait';

      // Se temos um stream ativo e a orientação não mudou, podemos manter o stream
      if (
        streamRef.current &&
        lastOrientation === currentOrientation &&
        videoRef.current
      ) {
        videoRef.current.srcObject = streamRef.current;
        setActive(true);
        setIsAdjusting(false);
        setIsTransitioning(false);
        return;
      }

      // Atualiza a orientação atual
      setLastOrientation(currentOrientation);

      // Limpa stream anterior de forma segura
      cleanupStream();

      // Determina constraints ideais com base no dispositivo e orientação
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: 'environment', // Usa a câmera traseira

          // Configuração otimizada para performance e compatibilidade
          // com diferentes dispositivos
          width: {
            min: 640,
            ideal: isLandscape ? 1280 : 720,
            max: 1920,
          },
          height: {
            min: 480,
            ideal: isLandscape ? 720 : 1280,
            max: 1080,
          },

          // Configurações adicionais para qualidade e performance
          aspectRatio: isLandscape ? 16 / 9 : 9 / 16,
          frameRate: { ideal: 30, max: 60 },
        } as MediaTrackConstraints,
        audio: false,
      };

      console.log('Iniciando câmera com orientação:', currentOrientation);
      console.log('Tentativa de inicialização:', initAttemptsRef.current + 1);
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;

        // Detecta quando o vídeo está carregado e configurado
        videoRef.current.onloadedmetadata = () => {
          if (videoRef.current) {
            // Tenta iniciar reprodução assim que possível
            videoRef.current.play().catch(e => {
              console.warn('Erro ao iniciar reprodução automática:', e);
            });
          }
        };

        streamRef.current = stream;
        setPermission(true);
        setActive(true);
        setError(null);
        initAttemptsRef.current = 0; // Reset tentativas após sucesso

        console.log('Câmera inicializada com sucesso');
      } else {
        throw new Error('Elemento de vídeo não disponível');
      }

      // Mesmo que tudo corra bem, definimos isTransitioning como false
      // após um curto delay para garantir que a transição seja suave
      setTimeout(() => {
        setIsTransitioning(false);
      }, 150);
    } catch (err) {
      console.error('Erro ao acessar câmera:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Erro desconhecido ao acessar câmera',
      );
      
      // Incrementa contador de tentativas
      initAttemptsRef.current++;
      
      // Se ainda não excedemos o número máximo de tentativas, tentamos novamente
      if (initAttemptsRef.current < CAMERA_INIT_RETRY_MAX) {
        console.log(`Tentando novamente em ${CAMERA_INIT_RETRY_DELAY}ms...`);
        retryTimerRef.current = window.setTimeout(() => {
          console.log(`Iniciando tentativa ${initAttemptsRef.current + 1}`);
          startCamera();
        }, CAMERA_INIT_RETRY_DELAY);
      } else {
        console.error(`Excedido número máximo de tentativas (${CAMERA_INIT_RETRY_MAX})`);
        setPermission(false);
      }
      
      setIsTransitioning(false);
    } finally {
      setIsAdjusting(false);
    }
  }, [
    cleanupStream,
    isAdjusting,
    lastOrientation,
    setActive,
    setError,
    setPermission,
    videoRef,
  ]);

  /**
   * Para o streaming da câmera e limpa recursos
   */
  const stopCamera = useCallback(() => {
    // Limpa timers pendentes
    if (debounceTimerRef.current) {
      window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    if (restartTimerRef.current) {
      window.clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    
    if (retryTimerRef.current) {
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }

    cleanupStream();

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    streamRef.current = null;
    setActive(false);
  }, [cleanupStream, setActive, videoRef]);

  /**
   * Adapta a câmera à mudança de orientação com estratégia de debounce otimizada
   * e transição visual para o usuário
   */
  const handleOrientationChange = useCallback(() => {
    // Limpa timer anterior de debounce, se existir
    if (debounceTimerRef.current) {
      window.clearTimeout(debounceTimerRef.current);
    }

    // Usa uma função dedicada para verificar mudança real de orientação
    if (!hasOrientationChanged() || isAdjusting) {
      return;
    }

    // Inicia transição visual antes de reiniciar a câmera
    setIsTransitioning(true);

    // Implementa debounce para evitar múltiplas reinicializações
    // durante rotação do dispositivo
    debounceTimerRef.current = window.setTimeout(() => {
      // Vamos parar a câmera apenas se realmente houve mudança
      stopCamera();

      // Pequeno delay antes de reiniciar para estabilidade
      restartTimerRef.current = window.setTimeout(() => {
        startCamera();
      }, CAMERA_RESTART_DELAY);
    }, ORIENTATION_DEBOUNCE);
  }, [hasOrientationChanged, isAdjusting, startCamera, stopCamera]);

  // Observa mudanças de orientação
  useEffect(() => {
    window.addEventListener('resize', handleOrientationChange);
    window.addEventListener('orientationchange', handleOrientationChange);

    return () => {
      window.removeEventListener('resize', handleOrientationChange);
      window.removeEventListener('orientationchange', handleOrientationChange);

      // Limpa timers pendentes
      if (debounceTimerRef.current) {
        window.clearTimeout(debounceTimerRef.current);
      }

      if (restartTimerRef.current) {
        window.clearTimeout(restartTimerRef.current);
      }
      
      if (retryTimerRef.current) {
        window.clearTimeout(retryTimerRef.current);
      }

      stopCamera();
    };
  }, [handleOrientationChange, stopCamera]);

  // Solicita permissão automaticamente ao montar o componente
  useEffect(() => {
    // Pequeno atraso para garantir que a UI esteja pronta
    const timer = setTimeout(() => {
      if (!isActive && !permissionRequestedRef.current) {
        permissionRequestedRef.current = true;
        requestCameraPermission();
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [isActive, requestCameraPermission]);

  return {
    startCamera,
    stopCamera,
    requestCameraPermission, // Expõe a função para uso externo
    isActive,
    hasPermission,
    error,
    isAdjusting,
    isTransitioning, // Expõe estado de transição para UI
  };
};