// Path: features\ar\hooks\useDeviceOrientation.ts
import { useEffect, useState, useRef, useCallback } from 'react';
import { useLocationStore } from '../stores/locationStore';

// Duração da janela de calibração em ms
const CALIBRATION_WINDOW = 5000;
// Número mínimo de leituras para considerar calibrado
const MIN_READINGS_CALIBRATED = 5;
// Tamanho máximo do histórico de leituras
const MAX_HISTORY_SIZE = 20; // Aumentado para melhor precisão
// Intervalo para throttling em ms
const THROTTLE_INTERVAL = 16; // Aproximadamente 60fps

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

  // Atualiza a orientação do dispositivo para melhor calibração
  useEffect(() => {
    const updateDeviceOrientation = () => {
      const newOrientation =
        window.innerWidth > window.innerHeight ? 'landscape' : 'portrait';
      deviceOrientationRef.current = newOrientation;
    };

    updateDeviceOrientation();
    window.addEventListener('resize', updateDeviceOrientation);
    window.addEventListener('orientationchange', updateDeviceOrientation);

    return () => {
      window.removeEventListener('resize', updateDeviceOrientation);
      window.removeEventListener('orientationchange', updateDeviceOrientation);
    };
  }, []);

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
      // Mais sensível no início, mais estável depois de calibrado
      const movementThreshold = isCalibrated ? 1.2 : 0.8;

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

      // Throttling básico para evitar processamento excessivo
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

      // Se houver movimento significativo, consideramos que o sensor está ativo
      if (
        (hasMovement || movementDetectedRef.current) &&
        !isCalibrated &&
        readingsCountRef.current >= MIN_READINGS_CALIBRATED
      ) {
        setIsCalibrated(true);
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

      // Diferentes estratégias de filtro baseado no estado de movimento
      if (headingHistoryRef.current.length >= 3) {
        let filteredHeading;

        if (movementDetectedRef.current) {
          // Durante movimento, usamos uma média ponderada pela confiança e recência
          // para resposta mais rápida
          let totalWeight = 0;
          let weightedSum = 0;

          headingHistoryRef.current.forEach((item, index, array) => {
            // Peso baseado na recência e confiança
            const recencyWeight = (index + 1) / array.length;
            const weight = recencyWeight * item.confidence;

            // Ajuste para o problema do ângulo (0/360)
            const diff = ((item.value - newHeading + 180) % 360) - 180;
            const adjustedValue = newHeading + diff;

            weightedSum += adjustedValue * weight;
            totalWeight += weight;
          });

          filteredHeading =
            totalWeight > 0 ? weightedSum / totalWeight : newHeading;
        } else {
          // Sem movimento, usamos uma média mais estável para reduzir ruído
          // Ordenamos as leituras por confiança e descartamos outliers
          const sortedByConfidence = [...headingHistoryRef.current].sort(
            (a, b) => b.confidence - a.confidence,
          );

          // Usa as leituras de maior confiança, ajustando para o problema 0/360
          const highConfidenceValues = sortedByConfidence
            .slice(0, 5)
            .map(item => {
              const diff = ((item.value - newHeading + 180) % 360) - 180;
              return newHeading + diff;
            });

          // Média das melhores leituras
          filteredHeading =
            highConfidenceValues.reduce((a, b) => a + b, 0) /
            highConfidenceValues.length;
        }

        // Normaliza para 0-360
        filteredHeading = ((filteredHeading % 360) + 360) % 360;

        // Atualiza o heading no store com valor filtrado
        setHeading(filteredHeading);
      } else if (headingHistoryRef.current.length > 0) {
        // Poucos dados ainda, usa valor bruto mais recente
        setHeading(newHeading);
      }
    },
    [detectMovement, isCalibrated, setHeading, calculateConfidence],
  );

  // Função para processar orientação absoluta (mais precisa)
  const handleAbsoluteOrientation = useCallback(
    (event: DeviceOrientationEvent) => {
      if (!isMountedRef.current || event.alpha === null) return;
      processHeading(event.alpha);
    },
    [processHeading],
  );

  // Função aprimorada para processar orientação relativa (menos precisa)
  // Com correções para diferentes orientações de dispositivo
  const handleRelativeOrientation = useCallback(
    (event: DeviceOrientationEvent) => {
      if (!isMountedRef.current || event.alpha === null) return;

      let heading = event.alpha;
      const beta = event.beta; // inclinação frente/trás (-180 a 180)
      const gamma = event.gamma; // inclinação lateral (-90 a 90)

      try {
        if (beta !== null && gamma !== null) {
          // Ajustes mais precisos para diferentes orientações do dispositivo
          const currentOrientation = deviceOrientationRef.current;

          // Ajuste específico para orientação do dispositivo
          if (currentOrientation === 'portrait') {
            // Modo retrato
            // Verifica se o dispositivo está de cabeça para baixo
            const isUpsideDown = Math.abs(beta) > 90;

            if (isUpsideDown) {
              heading = (heading + 180) % 360;
            }

            // Correção para inclinação lateral
            if (Math.abs(gamma) > 45) {
              // Dispositivo significativamente inclinado para o lado
              heading = (heading + (gamma > 0 ? 90 : -90)) % 360;
            }
          } else if (currentOrientation === 'landscape') {
            // Modo paisagem - correções específicas
            const isRightSide = gamma > 0;
            const isUpsideDown = Math.abs(beta) > 90;

            // Ajuste base para paisagem
            heading = (heading + (isRightSide ? 90 : -90)) % 360;

            // Correção adicional se virado de cabeça para baixo
            if (isUpsideDown) {
              heading = (heading + 180) % 360;
            }
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

  // Função principal para inicializar os sensores
  const initOrientationSensors = useCallback(async () => {
    try {
      // Reset do estado antes de inicializar
      setIsCalibrated(false);
      readingsCountRef.current = 0;
      headingHistoryRef.current = [];
      lastHeadingRef.current = null;
      consecutiveStableReadingsRef.current = 0;
      movementDetectedRef.current = false;

      // Verificação de suporte aos sensores
      const hasDeviceOrientation = 'DeviceOrientationEvent' in window;
      const hasAbsoluteOrientation = 'ondeviceorientationabsolute' in window;

      if (!hasDeviceOrientation) {
        setErrorMessage('Seu dispositivo não suporta os sensores necessários');
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
            setErrorMessage(
              'Os sensores de orientação precisam ser calibrados. ' +
                'Tente movimentar seu dispositivo em forma de "8" no ar.',
            );
          }
        }
      }, CALIBRATION_WINDOW);

      // Solicita permissão em iOS (>= 13)
      if (
        typeof DeviceOrientationEvent !== 'undefined' &&
        typeof (DeviceOrientationEvent as any).requestPermission === 'function'
      ) {
        try {
          const permission = await (
            DeviceOrientationEvent as any
          ).requestPermission();
          setPermissionState(permission);

          if (permission !== 'granted') {
            setErrorMessage('Permissão para acessar sensores negada');
            return;
          }
        } catch (err) {
          console.error('Erro ao solicitar permissão para sensores:', err);
          setErrorMessage('Erro ao acessar sensores de orientação');
          return;
        }
      }

      // Registra o listener adequado com base no suporte do dispositivo
      if (hasAbsoluteOrientation) {
        window.addEventListener(
          'deviceorientationabsolute',
          handleAbsoluteOrientation,
          { passive: true },
        );
      } else {
        window.addEventListener(
          'deviceorientation',
          handleRelativeOrientation,
          { passive: true },
        );
      }

      // Tenta também DeviceMotion para iOS
      try {
        if (
          'DeviceMotionEvent' in window &&
          typeof (DeviceMotionEvent as any).requestPermission === 'function'
        ) {
          await (DeviceMotionEvent as any).requestPermission();
        }
      } catch (err) {
        // Ignora erros do DeviceMotion, pois não é essencial
        console.warn('DeviceMotion não disponível:', err);
      }
    } catch (error) {
      console.error('Erro ao inicializar sensores de orientação:', error);
      setErrorMessage(
        error instanceof Error
          ? `Erro: ${error.message}`
          : 'Falha ao inicializar sensores de orientação',
      );
    }
  }, [handleAbsoluteOrientation, handleRelativeOrientation, isCalibrated]);

  // Effect principal
  useEffect(() => {
    isMountedRef.current = true;

    initOrientationSensors();

    // Cleanup
    return () => {
      isMountedRef.current = false;

      if (calibrationTimeoutRef.current) {
        window.clearTimeout(calibrationTimeoutRef.current);
      }

      window.removeEventListener(
        'deviceorientationabsolute',
        handleAbsoluteOrientation,
      );
      window.removeEventListener(
        'deviceorientation',
        handleRelativeOrientation,
      );
    };
  }, [
    handleAbsoluteOrientation,
    handleRelativeOrientation,
    initOrientationSensors,
  ]);

  return { heading, permissionState, errorMessage, isCalibrated };
};
