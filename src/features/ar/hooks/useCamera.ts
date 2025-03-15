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
  const permissionCheckedRef = useRef(false);
  const initAttemptsRef = useRef(0);
  const videoElementCheckIntervalRef = useRef<number | null>(null);

  // Usando useRef para variáveis de timer
  const debounceTimerRef = useRef<number | null>(null);
  const restartTimerRef = useRef<number | null>(null);
  const retryTimerRef = useRef<number | null>(null);
  const permissionCheckTimerRef = useRef<number | null>(null);

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
   * Função que tenta anexar um stream existente ao elemento de vídeo
   * Função importante que garante que o stream seja anexado assim que o elemento estiver disponível
   */
  const attachExistingStream = useCallback(() => {
    // Se não temos stream ou o elemento de vídeo não está disponível, não faz nada
    if (!streamRef.current || !videoRef.current) return false;

    try {
      // Verifica se o stream já está anexado
      const currentStream = videoRef.current.srcObject as MediaStream | null;

      // Se o stream já está anexado e é o mesmo, não faz nada
      if (currentStream === streamRef.current) return true;

      // Anexa o stream ao elemento de vídeo
      videoRef.current.srcObject = streamRef.current;

      // Configura eventos
      videoRef.current.onloadedmetadata = () => {
        if (videoRef.current) {
          videoRef.current.play().catch(e => {
            console.warn('Erro ao iniciar reprodução automática:', e);
          });
        }
      };

      console.log('Stream existente anexado ao elemento de vídeo');
      return true;
    } catch (err) {
      console.error('Erro ao anexar stream existente:', err);
      return false;
    }
  }, [videoRef]);

  /**
   * Verifica se já temos permissão para acessar a câmera sem precisar solicitar novamente
   */
  const checkExistingPermission = useCallback(async () => {
    if (permissionCheckedRef.current) return;

    try {
      console.log('Verificando permissões existentes da câmera...');

      // Verifica se navigator.permissions API está disponível
      if (navigator.permissions && navigator.permissions.query) {
        try {
          const result = await navigator.permissions.query({
            name: 'camera' as PermissionName,
          });

          if (result.state === 'granted') {
            console.log('Permissão de câmera já concedida pelo navegador');
            setPermission(true);
            setError(null);
            permissionCheckedRef.current = true;
            return true;
          } else if (result.state === 'denied') {
            console.log('Permissão de câmera negada pelo navegador');
            setPermission(false);
            setError('Permissão de câmera negada pelo navegador');
            permissionCheckedRef.current = true;
            return false;
          }

          console.log('Estado da permissão:', result.state);
        } catch (err) {
          console.warn('Não foi possível verificar permissões via API:', err);
        }
      }

      // Método alternativo: tenta obter um stream rapidamente e depois descartá-lo
      const constraints = {
        video: {
          facingMode: 'environment',
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      if (stream) {
        console.log('Permissão verificada com sucesso via getUserMedia');

        // Limpa o stream de teste - não precisamos dele agora
        stream.getTracks().forEach(track => track.stop());

        setPermission(true);
        setError(null);
        permissionCheckedRef.current = true;
        return true;
      }
    } catch (err) {
      // Se ocorrer um erro NotAllowedError, a permissão foi explicitamente negada
      if (err instanceof Error && err.name === 'NotAllowedError') {
        console.log('Permissão de câmera explicitamente negada');
        setPermission(false);
        setError(
          'Acesso à câmera negado. Verifique as permissões do navegador.',
        );
        permissionCheckedRef.current = true;
        return false;
      }

      console.log('Verificação de permissão existente falhou:', err);
      return null;
    }

    // Se chegamos aqui, a verificação foi inconclusiva
    return null;
  }, [setError, setPermission]);

  // Declaramos startCamera aqui, mas atribuímos depois para resolver a referência circular
  let startCamera: () => Promise<void>;

  /**
   * Função que solicita permissão da câmera diretamente, sem depender de outras condições
   */
  const requestCameraPermission = useCallback(async () => {
    // Primeiro, verifica se já temos permissão
    const hasExistingPermission = await checkExistingPermission();

    // Se já temos permissão confirmada, não precisamos solicitar novamente
    if (hasExistingPermission === true) {
      console.log('Permissão já está concedida, iniciando câmera');
      // Aqui usamos a variável startCamera que será atribuída depois
      if (startCamera) {
        startCamera();
      } else {
        console.warn('startCamera ainda não disponível');
      }
      return;
    }

    // Se permissão está explicitamente negada, não tentamos novamente
    if (hasExistingPermission === false) {
      console.log('Permissão já está negada, não solicitando novamente');
      return;
    }

    // Reseta contador de tentativas de inicialização
    initAttemptsRef.current = 0;

    console.log('Solicitando permissão da câmera explicitamente');

    try {
      // Solicita acesso à câmera com parâmetros mínimos
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });

      // Se chegamos aqui, temos permissão
      console.log('Permissão da câmera concedida');

      // Em vez de descartar este stream, vamos guardá-lo para uso
      streamRef.current = stream;

      // Marca como permitido
      setPermission(true);
      setError(null);
      permissionCheckedRef.current = true;

      // Tenta anexar o stream ao elemento de vídeo
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setActive(true);
      } else {
        // Inicia verificações periódicas para anexar o stream assim que o elemento estiver disponível
        if (videoElementCheckIntervalRef.current === null) {
          videoElementCheckIntervalRef.current = window.setInterval(() => {
            if (videoRef.current) {
              attachExistingStream();
              setActive(true);
              clearInterval(videoElementCheckIntervalRef.current!);
              videoElementCheckIntervalRef.current = null;
            }
          }, 100);
        }
      }

      // Tenta iniciar a câmera normalmente também
      if (startCamera) {
        startCamera();
      } else {
        console.warn('startCamera ainda não disponível');
      }
    } catch (err) {
      console.error('Erro ao solicitar permissão da câmera:', err);

      // Verifica o tipo específico de erro
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError') {
          setPermission(false);
          setError('Acesso à câmera negado pelo usuário');
        } else if (err.name === 'NotFoundError') {
          setPermission(false);
          setError('Nenhuma câmera encontrada no dispositivo');
        } else {
          setPermission(false);
          setError(err.message || 'Erro ao acessar câmera');
        }
      } else {
        setPermission(false);
        setError('Erro desconhecido ao acessar câmera');
      }

      permissionCheckedRef.current = true;
    }
  }, [
    attachExistingStream,
    checkExistingPermission,
    setActive,
    setError,
    setPermission,
    videoRef,
  ]);

  /**
   * Inicia a câmera e configura o stream de vídeo
   * Implementação otimizada para maior estabilidade
   */
  startCamera = useCallback(async () => {
    // Limpa qualquer temporizador de retry pendente
    if (retryTimerRef.current) {
      window.clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }

    // Se já temos um stream, tentamos anexá-lo primeiro
    if (streamRef.current) {
      const attached = attachExistingStream();
      if (attached) {
        setActive(true);
        console.log('Câmera iniciada com stream existente');
        return;
      }
    }

    try {
      // Evita múltiplas inicializações simultâneas
      if (isAdjusting) return;
      setIsAdjusting(true);

      // Verifica se API está disponível
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('API de câmera não suportada neste navegador');
      }

      // Se o elemento de vídeo não estiver disponível, configuramos verificações periódicas
      if (!videoRef.current) {
        console.log(
          'Elemento de vídeo não disponível, configurando verificações periódicas',
        );

        if (videoElementCheckIntervalRef.current === null) {
          videoElementCheckIntervalRef.current = window.setInterval(() => {
            if (videoRef.current) {
              console.log(
                'Elemento de vídeo disponível, tentando iniciar câmera',
              );
              clearInterval(videoElementCheckIntervalRef.current!);
              videoElementCheckIntervalRef.current = null;
              setIsAdjusting(false);
              startCamera();
            }
          }, 100);
        }
        return;
      }

      // Obter dimensões atuais para determinar proporção ideal
      const isLandscape = window.innerWidth > window.innerHeight;
      const currentOrientation = isLandscape ? 'landscape' : 'portrait';

      // Atualiza a orientação atual
      setLastOrientation(currentOrientation);

      // Limpa stream anterior de forma segura
      cleanupStream();

      // Determina constraints ideais com base no dispositivo e orientação
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: 'environment', // Usa a câmera traseira
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
          aspectRatio: isLandscape ? 16 / 9 : 9 / 16,
          frameRate: { ideal: 30, max: 60 },
        } as MediaTrackConstraints,
        audio: false,
      };

      console.log('Iniciando câmera com orientação:', currentOrientation);
      console.log('Tentativa de inicialização:', initAttemptsRef.current + 1);

      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      // Salvamos a referência do stream primeiro
      streamRef.current = stream;

      // Verificamos novamente se o elemento de vídeo está disponível
      if (videoRef.current) {
        // Configura callbacks antes de atribuir o stream
        videoRef.current.onloadedmetadata = () => {
          console.log('Metadados de vídeo carregados');
          if (videoRef.current) {
            videoRef.current.play().catch(e => {
              console.warn('Erro ao iniciar reprodução automática:', e);
            });
          }
        };

        videoRef.current.onloadeddata = () => {
          console.log('Dados de vídeo carregados');
        };

        videoRef.current.onerror = e => {
          console.error('Erro no elemento de vídeo:', e);
        };

        // Atribui o stream ao elemento de vídeo
        videoRef.current.srcObject = stream;

        // Atualiza estados
        setPermission(true);
        setActive(true);
        setError(null);
        initAttemptsRef.current = 0; // Reset tentativas após sucesso

        console.log('Câmera inicializada com sucesso');
      } else {
        // Se o elemento de vídeo ainda não está disponível, configuramos verificações periódicas
        console.log(
          'Elemento de vídeo ainda não disponível após obter stream, configurando verificações',
        );

        if (videoElementCheckIntervalRef.current === null) {
          videoElementCheckIntervalRef.current = window.setInterval(() => {
            if (videoRef.current) {
              console.log('Elemento de vídeo disponível, anexando stream');
              videoRef.current.srcObject = streamRef.current;
              setActive(true);
              clearInterval(videoElementCheckIntervalRef.current!);
              videoElementCheckIntervalRef.current = null;
            }
          }, 100);
        }
      }

      // Mesmo que tudo corra bem, definimos isTransitioning como false
      // após um curto delay para garantir que a transição seja suave
      setTimeout(() => {
        setIsTransitioning(false);
      }, 150);
    } catch (err) {
      console.error('Erro ao acessar câmera:', err);

      const errorMessage =
        err instanceof Error
          ? err.message
          : 'Erro desconhecido ao acessar câmera';

      setError(errorMessage);

      // Não alteramos o estado de permissão aqui, apenas se o erro for específico
      if (err instanceof Error && err.name === 'NotAllowedError') {
        setPermission(false);
      }

      // Incrementa contador de tentativas
      initAttemptsRef.current++;

      // Se ainda não excedemos o número máximo de tentativas, tentamos novamente
      if (initAttemptsRef.current < CAMERA_INIT_RETRY_MAX) {
        console.log(`Tentando novamente em ${CAMERA_INIT_RETRY_DELAY}ms...`);
        retryTimerRef.current = window.setTimeout(() => {
          console.log(`Iniciando tentativa ${initAttemptsRef.current + 1}`);
          setIsAdjusting(false);
          startCamera();
        }, CAMERA_INIT_RETRY_DELAY);
      } else {
        console.error(
          `Excedido número máximo de tentativas (${CAMERA_INIT_RETRY_MAX})`,
        );
      }

      setIsTransitioning(false);
    } finally {
      setTimeout(() => {
        setIsAdjusting(false);
      }, 100);
    }
  }, [
    attachExistingStream,
    cleanupStream,
    isAdjusting,
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

    if (permissionCheckTimerRef.current) {
      window.clearTimeout(permissionCheckTimerRef.current);
      permissionCheckTimerRef.current = null;
    }

    if (videoElementCheckIntervalRef.current) {
      window.clearInterval(videoElementCheckIntervalRef.current);
      videoElementCheckIntervalRef.current = null;
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

      if (permissionCheckTimerRef.current) {
        window.clearTimeout(permissionCheckTimerRef.current);
      }

      if (videoElementCheckIntervalRef.current) {
        window.clearInterval(videoElementCheckIntervalRef.current);
      }

      stopCamera();
    };
  }, [handleOrientationChange, stopCamera]);

  // Verifica permissões existentes ao montar o componente
  useEffect(() => {
    // Pequeno atraso para garantir que a UI esteja pronta
    permissionCheckTimerRef.current = window.setTimeout(() => {
      checkExistingPermission().then(hasPermission => {
        // Se já temos permissão, inicia a câmera diretamente
        if (hasPermission === true) {
          startCamera();
        }
        // Se a verificação foi inconclusiva, tenta solicitar permissão explicitamente
        else if (hasPermission === null) {
          requestCameraPermission();
        }
      });
    }, 500);

    return () => {
      if (permissionCheckTimerRef.current) {
        window.clearTimeout(permissionCheckTimerRef.current);
        permissionCheckTimerRef.current = null;
      }
    };
  }, [checkExistingPermission, requestCameraPermission]);

  // Tenta anexar o stream existente quando o elemento de vídeo é renderizado
  useEffect(() => {
    // Se temos stream mas não temos elemento de vídeo, configuramos verificações periódicas
    if (
      streamRef.current &&
      !videoRef.current &&
      !videoElementCheckIntervalRef.current
    ) {
      videoElementCheckIntervalRef.current = window.setInterval(() => {
        if (videoRef.current) {
          attachExistingStream();
          setActive(true);
          clearInterval(videoElementCheckIntervalRef.current!);
          videoElementCheckIntervalRef.current = null;
        }
      }, 100);
    }

    return () => {
      if (videoElementCheckIntervalRef.current) {
        clearInterval(videoElementCheckIntervalRef.current);
        videoElementCheckIntervalRef.current = null;
      }
    };
  }, [attachExistingStream, setActive, videoRef]);

  return {
    startCamera,
    stopCamera,
    requestCameraPermission,
    isActive,
    hasPermission,
    error,
    isAdjusting,
    isTransitioning,
  };
};
