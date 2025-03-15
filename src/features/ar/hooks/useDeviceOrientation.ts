// Path: features\ar\hooks\useDeviceOrientation.ts
import { useEffect, useState, useRef, useCallback } from 'react';
import { useLocationStore } from '../stores/locationStore';

// Duração da janela de calibração em ms
const CALIBRATION_WINDOW = 5000;
// Número mínimo de leituras para considerar calibrado
const MIN_READINGS_CALIBRATED = 5;
// Tamanho máximo do histórico de leituras
const MAX_HISTORY_SIZE = 20; // Aumentado para melhor precisão
// Intervalo para throttling em ms - REDUZIDO para maior responsividade
const THROTTLE_INTERVAL = 8; // Aproximadamente 120fps

// Interface para Safari DeviceOrientationEvent com webkitCompassHeading
interface SafariDeviceOrientationEvent extends DeviceOrientationEvent {
  webkitCompassHeading?: number;
}

/**
 * Hook otimizado para acessar a orientação do dispositivo
 * Com melhor compatibilidade entre dispositivos e tratamento de erros
 */
export const useDeviceOrientation = () => {
  const { heading, setHeading } = useLocationStore();
  const [permissionState, setPermissionState] =
    useState<PermissionState | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCalibrated, setIsCalibrated] = useState(false);

  // Refs para o estado de calibração e estabilidade
  const isMountedRef = useRef(true);
  const readingsCountRef = useRef(0);
  const lastHeadingRef = useRef<number | null>(null);
  const movementDetectedRef = useRef(false);
  const headingHistoryRef = useRef<
    Array<{ value: number; timestamp: number; confidence: number }>
  >([]);
  const calibrationTimeoutRef = useRef<number | null>(null);
  const lastProcessTimeRef = useRef(0);
  const consecutiveStableReadingsRef = useRef(0);
  const deviceOrientationRef = useRef<'portrait' | 'landscape' | null>(null);
  const permissionRequestedRef = useRef(false);
  const eventListenerAddedRef = useRef(false); // NOVO: controla se os listeners foram adicionados

  // DEBUG: Adiciona contador de eventos recebidos
  const eventsReceivedRef = useRef({
    absolute: 0,
    relative: 0,
    motion: 0,
  });

  // DEBUG: função para logar eventos periodicamente
  const logEventsStatus = useCallback(() => {
    console.log(`[DeviceOrientation] Eventos recebidos:`, {
      absolute: eventsReceivedRef.current.absolute,
      relative: eventsReceivedRef.current.relative,
      motion: eventsReceivedRef.current.motion,
      headingHistorySize: headingHistoryRef.current.length,
      lastHeading: lastHeadingRef.current,
      currentHeading: heading,
      isCalibrated,
    });
  }, [heading, isCalibrated]);

  // Atualiza a orientação do dispositivo para melhor calibração
  useEffect(() => {
    const updateDeviceOrientation = () => {
      const newOrientation =
        window.innerWidth > window.innerHeight ? 'landscape' : 'portrait';
      deviceOrientationRef.current = newOrientation;
      console.log(
        `[DeviceOrientation] Orientação atualizada: ${newOrientation}`,
      );
    };

    updateDeviceOrientation();
    window.addEventListener('resize', updateDeviceOrientation);
    window.addEventListener('orientationchange', updateDeviceOrientation);

    // DEBUG: Configura logging periódico
    const logInterval = setInterval(logEventsStatus, 3000);

    return () => {
      window.removeEventListener('resize', updateDeviceOrientation);
      window.removeEventListener('orientationchange', updateDeviceOrientation);
      clearInterval(logInterval);
    };
  }, [logEventsStatus]);

  // Função otimizada para detectar se o dispositivo está em movimento
  // baseado nas mudanças de orientação - agora com detecção de movimento mais sensível
  const detectMovement = useCallback(
    (newHeading: number): boolean => {
      if (lastHeadingRef.current === null) {
        lastHeadingRef.current = newHeading;
        return false;
      }

      // Calcula a menor diferença angular (considerando o círculo 0-360)
      const alphaDiff = Math.abs(
        ((lastHeadingRef.current - newHeading + 180) % 360) - 180,
      );

      // Atualiza o valor de referência
      lastHeadingRef.current = newHeading;

      // Limiar adaptativo baseado no estado de calibração
      // MODIFICADO: Mais sensível para detectar movimento
      const movementThreshold = isCalibrated ? 0.8 : 0.5;

      // Retorna true se houver movimento significativo
      const hasMovement = alphaDiff > movementThreshold;

      // Se detectar movimento, atualiza o ref para uso em outras funções
      if (hasMovement) {
        movementDetectedRef.current = true;
        // Reseta o contador de leituras estáveis
        consecutiveStableReadingsRef.current = 0;
      } else {
        // Incrementa contador de leituras estáveis
        consecutiveStableReadingsRef.current++;

        // Após 10 leituras estáveis consecutivas, consideramos que o movimento cessou
        if (consecutiveStableReadingsRef.current > 10) {
          movementDetectedRef.current = false;
        }
      }

      return hasMovement;
    },
    [isCalibrated],
  );

  // Função para calcular o nível de confiança baseado na estabilidade das leituras
  const calculateConfidence = useCallback((newHeading: number): number => {
    if (headingHistoryRef.current.length < 3) return 0.5; // Confiança média por padrão

    // Calcula o desvio padrão das últimas leituras
    const recentHeadings = headingHistoryRef.current
      .slice(-5)
      .map(h => h.value);

    // Ajusta os ângulos para evitar problemas na transição 0/360
    const adjustedHeadings = recentHeadings.map(h => {
      const diff = ((h - newHeading + 180) % 360) - 180;
      return newHeading + diff;
    });

    // Calcula média e desvio padrão
    const mean =
      adjustedHeadings.reduce((a, b) => a + b, 0) / adjustedHeadings.length;
    const variance =
      adjustedHeadings.reduce((a, b) => a + Math.pow(b - mean, 2), 0) /
      adjustedHeadings.length;
    const stdDev = Math.sqrt(variance);

    // Confiança inversa ao desvio padrão (mais estável = mais confiança)
    // Normalizada entre 0.1 e 1.0
    return Math.max(0.1, Math.min(1.0, 1 - stdDev / 30));
  }, []);

  // Função para processar leituras de orientação com filtro de estabilidade
  // Implementada com filtro adaptativo e detecção de movimento
  const processHeading = useCallback(
    (newHeading: number) => {
      const now = Date.now();

      // MODIFICADO: Throttling mais leve para maior responsividade
      if (now - lastProcessTimeRef.current < THROTTLE_INTERVAL) {
        return;
      }
      lastProcessTimeRef.current = now;

      // Incrementa contador de leituras
      readingsCountRef.current++;

      // Verifica movimento para registro de calibração
      const hasMovement = detectMovement(newHeading);

      // Calcula nível de confiança desta leitura
      const confidence = calculateConfidence(newHeading);

      // MODIFICADO: Consideramos calibrado mais facilmente
      if (
        (hasMovement || movementDetectedRef.current) &&
        !isCalibrated &&
        readingsCountRef.current >= MIN_READINGS_CALIBRATED
      ) {
        setIsCalibrated(true);
        console.log('[DeviceOrientation] Sensores calibrados!');
        if (calibrationTimeoutRef.current) {
          window.clearTimeout(calibrationTimeoutRef.current);
          calibrationTimeoutRef.current = null;
        }
      }

      // Adiciona na lista de leituras recentes com timestamp e confiança
      headingHistoryRef.current.push({
        value: newHeading,
        timestamp: now,
        confidence,
      });

      // Mantém o histórico limitado
      if (headingHistoryRef.current.length > MAX_HISTORY_SIZE) {
        headingHistoryRef.current.shift();
      }

      // MODIFICADO: Usa uma abordagem mais simples para calcular o heading filtrado
      // com menos filtragem para dispositivos em movimento
      let filteredHeading = newHeading;

      if (headingHistoryRef.current.length >= 3) {
        if (movementDetectedRef.current) {
          // Durante movimento, damos mais peso às leituras recentes
          // usando apenas as últimas 3 leituras com pesos 0.5, 0.3, 0.2
          const weights = [0.5, 0.3, 0.2];
          const recentValues = headingHistoryRef.current.slice(-3).map(item => {
            // Ajuste para o problema do ângulo (0/360)
            const diff = ((item.value - newHeading + 180) % 360) - 180;
            return newHeading + diff;
          });

          filteredHeading = recentValues.reduce((sum, value, index) => {
            return sum + value * weights[index];
          }, 0);
        } else {
          // Sem movimento, usamos média mais estável
          const allValues = headingHistoryRef.current.map(item => {
            const diff = ((item.value - newHeading + 180) % 360) - 180;
            return newHeading + diff;
          });

          filteredHeading =
            allValues.reduce((a, b) => a + b, 0) / allValues.length;
        }

        // Normaliza para 0-360
        filteredHeading = ((filteredHeading % 360) + 360) % 360;
      }

      // DEBUG: Log para verificar o heading antes de atualizar o store
      if (filteredHeading !== heading && readingsCountRef.current % 10 === 0) {
        console.log(
          `[DeviceOrientation] Atualizando heading: ${filteredHeading.toFixed(1)}° (raw: ${newHeading.toFixed(1)}°)`,
        );
      }

      // CRÍTICO: Garante que o heading seja atualizado mesmo sem calibração completa
      // após um certo número de leituras
      if (
        readingsCountRef.current > MIN_READINGS_CALIBRATED * 2 ||
        isCalibrated
      ) {
        // Atualiza o heading no store com valor filtrado
        setHeading(filteredHeading);
      }
    },
    [detectMovement, isCalibrated, setHeading, calculateConfidence, heading],
  );

  // Função para processar orientação absoluta (mais precisa)
  const handleAbsoluteOrientation = useCallback(
    (event: DeviceOrientationEvent) => {
      if (!isMountedRef.current) return;

      // DEBUG: Incrementa contador de eventos
      eventsReceivedRef.current.absolute++;

      // MODIFICADO: Aceita qualquer valor, não apenas event.alpha
      // Alguns navegadores/dispositivos podem fornecer o valor em diferentes propriedades
      let alphaValue = null;

      if (event.alpha !== null && event.alpha !== undefined) {
        alphaValue = event.alpha;
      } else if (
        (event as SafariDeviceOrientationEvent).webkitCompassHeading !==
        undefined
      ) {
        // Safari em iOS fornece webkitCompassHeading
        alphaValue =
          360 -
          ((event as SafariDeviceOrientationEvent).webkitCompassHeading || 0);
      }

      if (alphaValue !== null) {
        processHeading(alphaValue);
      }
    },
    [processHeading],
  );

  // Função aprimorada para processar orientação relativa (menos precisa)
  // Com correções para diferentes orientações de dispositivo
  const handleRelativeOrientation = useCallback(
    (event: DeviceOrientationEvent) => {
      if (!isMountedRef.current) return;

      // DEBUG: Incrementa contador de eventos
      eventsReceivedRef.current.relative++;

      // MODIFICADO: Verificações mais robustas para diferentes implementações
      let alphaValue = null;

      if (event.alpha !== null && event.alpha !== undefined) {
        alphaValue = event.alpha;
      } else if (
        (event as SafariDeviceOrientationEvent).webkitCompassHeading !==
        undefined
      ) {
        // Safari em iOS fornece webkitCompassHeading
        alphaValue =
          360 -
          ((event as SafariDeviceOrientationEvent).webkitCompassHeading || 0);
      }

      if (alphaValue === null) {
        return;
      }

      let heading = alphaValue;
      const beta = event.beta; // inclinação frente/trás (-180 a 180)
      const gamma = event.gamma; // inclinação lateral (-90 a 90)

      try {
        if (beta !== null && gamma !== null) {
          // Ajustes mais precisos para diferentes orientações do dispositivo
          const currentOrientation = deviceOrientationRef.current;

          // MODIFICADO: Ajustes simplificados e robustos para orientação
          if (currentOrientation === 'portrait') {
            // Modo retrato
            // Verifica se o dispositivo está de cabeça para baixo
            const isUpsideDown = beta < 0;

            if (isUpsideDown) {
              heading = (heading + 180) % 360;
            }
          } else if (currentOrientation === 'landscape') {
            // Modo paisagem
            const isRightSide = gamma > 0;

            // Ajuste para paisagem
            heading = (heading + (isRightSide ? 90 : -90)) % 360;
          }
        }
      } catch (err) {
        console.warn('Erro ao ajustar orientação:', err);
      }

      // Normaliza para 0-360
      heading = ((heading % 360) + 360) % 360;

      // Processa o heading ajustado
      processHeading(heading);
    },
    [processHeading],
  );

  // Adicionar suporte para DeviceMotion como fallback
  const handleDeviceMotion = useCallback((event: DeviceMotionEvent) => {
    if (!isMountedRef.current) return;

    // DEBUG: Incrementa contador de eventos
    eventsReceivedRef.current.motion++;

    // Usamos como um indicador de movimento, não necessariamente para obter o heading
    if (event.accelerationIncludingGravity) {
      // Apenas marca que houve movimento para ajudar na calibração
      movementDetectedRef.current = true;
    }
  }, []);

  // Função para lidar com dispositivos que não têm sensores de orientação
  const handleNoSensors = useCallback(() => {
    console.log(
      'Dispositivo sem sensores de orientação ou permissão negada - usando modo de fallback',
    );

    // Fallback: usar um valor de heading fixo ou simulado
    // Isso permite que o app continue funcionando mesmo sem sensores
    const simulatedHeading = 0; // Norte como direção padrão
    setHeading(simulatedHeading);
    setIsCalibrated(true); // Consideramos "calibrado" para continuar o fluxo do app

    // Limpa qualquer mensagem de erro para permitir que o app continue
    setErrorMessage(null);
  }, [setHeading]);

  // Função para testar explicitamente se temos acesso aos sensores
  const testSensorAccess = useCallback(async () => {
    return new Promise<boolean>(resolve => {
      let hasReceivedEvent = false;
      let testTimer: number | null = null;

      const testHandler = () => {
        hasReceivedEvent = true;
        if (testTimer) {
          window.clearTimeout(testTimer);
        }
        window.removeEventListener('deviceorientation', testHandler);
        window.removeEventListener('deviceorientationabsolute', testHandler);
        resolve(true);
      };

      window.addEventListener('deviceorientation', testHandler, { once: true });
      window.addEventListener('deviceorientationabsolute', testHandler, {
        once: true,
      });

      // Timeout de 500ms para verificar se recebemos algum evento
      testTimer = window.setTimeout(() => {
        window.removeEventListener('deviceorientation', testHandler);
        window.removeEventListener('deviceorientationabsolute', testHandler);
        resolve(hasReceivedEvent);
      }, 500);
    });
  }, []);

  // NOVA função para adicionar os eventos de orientação
  const addOrientationListeners = useCallback(() => {
    if (eventListenerAddedRef.current) {
      console.log('[DeviceOrientation] Listeners já adicionados, ignorando.');
      return;
    }

    console.log('[DeviceOrientation] Adicionando event listeners...');

    // Tenta primeiro o evento absoluto (mais preciso)
    window.addEventListener(
      'deviceorientationabsolute',
      handleAbsoluteOrientation,
      { passive: true },
    );

    // Adiciona também o evento relativo como fallback
    window.addEventListener('deviceorientation', handleRelativeOrientation, {
      passive: true,
    });

    // Adiciona motion para ajudar na detecção de movimento
    window.addEventListener('devicemotion', handleDeviceMotion, {
      passive: true,
    });

    eventListenerAddedRef.current = true;
    console.log('[DeviceOrientation] Todos os listeners adicionados.');
  }, [
    handleAbsoluteOrientation,
    handleRelativeOrientation,
    handleDeviceMotion,
  ]);

  // Função principal para inicializar os sensores
  const initOrientationSensors = useCallback(async () => {
    // Evita múltiplas solicitações de permissão
    if (permissionRequestedRef.current) return;
    permissionRequestedRef.current = true;

    try {
      // Reset do estado antes de inicializar
      setIsCalibrated(false);
      readingsCountRef.current = 0;
      headingHistoryRef.current = [];
      lastHeadingRef.current = null;
      consecutiveStableReadingsRef.current = 0;
      movementDetectedRef.current = false;

      console.log(
        '[DeviceOrientation] Inicializando sensores de orientação...',
      );

      // Verificação de suporte aos sensores
      const hasDeviceOrientation = 'DeviceOrientationEvent' in window;

      if (!hasDeviceOrientation) {
        console.warn(
          '[DeviceOrientation] Dispositivo não suporta orientação - usando fallback',
        );
        handleNoSensors();
        return;
      }

      // Configura timeout para verificar calibração
      // Usa um tempo maior para dar chance ao usuário de mover o dispositivo
      calibrationTimeoutRef.current = window.setTimeout(() => {
        if (
          !isCalibrated &&
          readingsCountRef.current > MIN_READINGS_CALIBRATED &&
          headingHistoryRef.current.length > 0
        ) {
          const now = Date.now();
          const oldestReading = headingHistoryRef.current[0].timestamp;

          // Se já se passou tempo suficiente e ainda não está calibrado
          if (now - oldestReading >= CALIBRATION_WINDOW) {
            console.log(
              '[DeviceOrientation] Tempo de calibração excedido, continuando assim mesmo.',
            );
            setIsCalibrated(true); // MODIFICADO: Força calibração de qualquer modo
          }
        }
      }, CALIBRATION_WINDOW);

      let permissionGranted = true;

      // MODIFICADO: Tratamento específico para iOS
      if (
        typeof DeviceOrientationEvent !== 'undefined' &&
        typeof (DeviceOrientationEvent as any).requestPermission === 'function'
      ) {
        try {
          console.log(
            '[DeviceOrientation] Solicitando permissão para orientação do dispositivo (iOS)',
          );

          // Em iOS, devemos solicitar permissão explicitamente
          const permission = await (
            DeviceOrientationEvent as any
          ).requestPermission();

          setPermissionState(permission);

          if (permission !== 'granted') {
            console.warn(
              '[DeviceOrientation] Permissão para sensores negada:',
              permission,
            );
            permissionGranted = false;
            handleNoSensors();
            return;
          }

          console.log('[DeviceOrientation] Permissão concedida no iOS');
        } catch (err) {
          console.error(
            '[DeviceOrientation] Erro ao solicitar permissão para sensores:',
            err,
          );

          // MODIFICADO: Tenta adicionar os listeners mesmo com erro de permissão
          // Em alguns casos, o erro pode ser apenas porque já temos permissão
          console.log(
            '[DeviceOrientation] Tentando adicionar listeners mesmo assim...',
          );
          addOrientationListeners();

          // Testa se estamos recebendo eventos mesmo com o erro
          const hasAccess = await testSensorAccess();

          if (!hasAccess) {
            permissionGranted = false;
            handleNoSensors();
            return;
          }
        }
      }

      if (permissionGranted) {
        // MODIFICADO: Usamos a função dedicada para adicionar listeners
        addOrientationListeners();

        // Tenta também DeviceMotion para iOS
        try {
          if (
            'DeviceMotionEvent' in window &&
            typeof (DeviceMotionEvent as any).requestPermission === 'function'
          ) {
            await (DeviceMotionEvent as any).requestPermission();
            // DeviceMotion já é adicionado em addOrientationListeners
          }
        } catch (err) {
          // Ignora erros do DeviceMotion, pois não é essencial
          console.warn('[DeviceOrientation] DeviceMotion não disponível:', err);
        }
      }

      // NOVO: Verifica se os eventos estão chegando
      setTimeout(async () => {
        const eventCounts = eventsReceivedRef.current;

        if (eventCounts.absolute === 0 && eventCounts.relative === 0) {
          console.warn(
            '[DeviceOrientation] Nenhum evento recebido após inicialização!',
          );

          // Tenta novamente com uma abordagem alternativa
          window.removeEventListener(
            'deviceorientationabsolute',
            handleAbsoluteOrientation,
          );
          window.removeEventListener(
            'deviceorientation',
            handleRelativeOrientation,
          );

          console.log(
            "[DeviceOrientation] Tentando adicionar com eventos 'on' diretamente...",
          );

          // Tenta adicionar com 'on' eventos, que podem funcionar em alguns navegadores
          if ('ondeviceorientationabsolute' in window) {
            console.log(
              '[DeviceOrientation] Usando ondeviceorientationabsolute',
            );
            (window as any).ondeviceorientationabsolute =
              handleAbsoluteOrientation;
          }

          if ('ondeviceorientation' in window) {
            console.log('[DeviceOrientation] Usando ondeviceorientation');
            (window as any).ondeviceorientation = handleRelativeOrientation;
          }

          // Se ainda não temos eventos após mais 1 segundo, usamos o fallback
          setTimeout(() => {
            if (
              eventsReceivedRef.current.absolute === 0 &&
              eventsReceivedRef.current.relative === 0
            ) {
              console.error(
                '[DeviceOrientation] Sensores não estão respondendo!',
              );
              handleNoSensors();
            }
          }, 1000);
        }
      }, 1000);
    } catch (error) {
      console.error(
        '[DeviceOrientation] Erro ao inicializar sensores de orientação:',
        error,
      );
      handleNoSensors();
    }
  }, [
    handleAbsoluteOrientation,
    handleRelativeOrientation,
    handleDeviceMotion,
    isCalibrated,
    handleNoSensors,
    addOrientationListeners,
    testSensorAccess,
  ]);

  // Effect principal
  useEffect(() => {
    isMountedRef.current = true;

    // Atrasa levemente a inicialização para garantir que a
    // UI esteja pronta e permissões anteriores processadas
    setTimeout(() => {
      initOrientationSensors();
    }, 500);

    // Cleanup
    return () => {
      isMountedRef.current = false;

      if (calibrationTimeoutRef.current) {
        window.clearTimeout(calibrationTimeoutRef.current);
      }

      // MODIFICADO: Limpeza mais robusta
      window.removeEventListener(
        'deviceorientationabsolute',
        handleAbsoluteOrientation,
      );
      window.removeEventListener(
        'deviceorientation',
        handleRelativeOrientation,
      );
      window.removeEventListener('devicemotion', handleDeviceMotion);

      // Limpa também os eventos 'on'
      if ('ondeviceorientationabsolute' in window) {
        (window as any).ondeviceorientationabsolute = null;
      }
      if ('ondeviceorientation' in window) {
        (window as any).ondeviceorientation = null;
      }

      console.log(
        '[DeviceOrientation] Hook limpo e event listeners removidos.',
      );
    };
  }, [
    handleAbsoluteOrientation,
    handleRelativeOrientation,
    handleDeviceMotion,
    initOrientationSensors,
  ]);

  return { heading, permissionState, errorMessage, isCalibrated };
};
