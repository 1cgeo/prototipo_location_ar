// Path: features\ar\components\CameraView.tsx
import { useRef, useEffect, useState, useCallback } from 'react';
import {
  Box,
  Typography,
  Fade,
  IconButton,
  useTheme,
  Tooltip,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import BugReportIcon from '@mui/icons-material/BugReport';
import { useNavigate } from 'react-router-dom';

import { useCamera } from '../hooks/useCamera';
import { useGeolocation } from '../hooks/useGeolocation';
import { useDeviceOrientation } from '../hooks/useDeviceOrientation';
import { useScreenOrientation } from '../hooks/useScreenOrientation';
import AROverlay from './AROverlay';
import PermissionRequest from './PermissionRequest';
import AzimuthIndicator from './AzimuthIndicator';
import LoadingState from './LoadingState';
import { useMarkersStore } from '../stores/markersStore';

/**
 * Componente principal que gerencia a visualização AR com responsividade
 * e exibe indicador de azimute
 */
const CameraView: React.FC = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const videoRef = useRef<HTMLVideoElement>(null);
  const { orientation, dimensions } = useScreenOrientation();
  const [isInitializing, setIsInitializing] = useState(true);
  const [showDebugInfo, setShowDebugInfo] = useState(false);

  // Usando uma referência para evitar múltiplas mudanças de estado e rerenders
  const previousOrientationRef = useRef<string>(orientation);
  const orientationChangeTimerRef = useRef<number | null>(null);

  // Acessa os hooks personalizados
  const {
    startCamera,
    stopCamera,
    isActive,
    hasPermission: cameraPermission,
    error: cameraError,
  } = useCamera(videoRef);
  const {
    coordinates,
    hasPermission: locationPermission,
    error: locationError,
  } = useGeolocation();
  const {
    heading,
    errorMessage: orientationError,
    isCalibrated,
  } = useDeviceOrientation();
  const { selectedMarkerId } = useMarkersStore();

  // Função otimizada para lidar com mudanças de orientação
  const handleOrientationChange = useCallback(() => {
    // Verifica se a orientação realmente mudou para evitar reinicializações desnecessárias
    if (previousOrientationRef.current === orientation || !isActive) {
      return;
    }

    // Atualiza a referência da orientação anterior
    previousOrientationRef.current = orientation;

    // Limpa o timer anterior se existir
    if (orientationChangeTimerRef.current) {
      window.clearTimeout(orientationChangeTimerRef.current);
    }

    // Configura um novo timer com debounce para evitar múltiplas reinicializações
    orientationChangeTimerRef.current = window.setTimeout(() => {
      stopCamera();

      // Pequeno atraso para garantir que a câmera foi completamente parada
      setTimeout(() => {
        startCamera();
      }, 300);

      orientationChangeTimerRef.current = null;
    }, 500); // Debounce de 500ms
  }, [orientation, isActive, stopCamera, startCamera]);

  // Observa mudanças de orientação
  useEffect(() => {
    handleOrientationChange();

    // Cleanup para evitar vazamentos de memória
    return () => {
      if (orientationChangeTimerRef.current) {
        window.clearTimeout(orientationChangeTimerRef.current);
        orientationChangeTimerRef.current = null;
      }
    };
  }, [orientation, handleOrientationChange]);

  // Inicia a câmera quando as permissões são concedidas
  useEffect(() => {
    if (cameraPermission === true && locationPermission === true) {
      startCamera();

      // Esconde o loading state após um pequeno delay para garantir que tudo carregou
      const timer = setTimeout(() => {
        setIsInitializing(false);
      }, 1500);

      return () => clearTimeout(timer);
    }
  }, [cameraPermission, locationPermission, startCamera]);

  // Calcula o progresso de inicialização para o LoadingState
  const calculateInitProgress = () => {
    let progress = 0;
    if (cameraPermission === true) progress += 40;
    if (locationPermission === true) progress += 40;
    if (heading !== null) progress += 20;
    return progress;
  };

  // Texto de carregamento baseado no estado atual
  const getLoadingMessage = () => {
    if (cameraPermission === null || locationPermission === null) {
      return 'Verificando permissões...';
    }
    if (!cameraPermission || !locationPermission) {
      return 'Aguardando permissões...';
    }
    if (heading === null) {
      return 'Calibrando sensores de orientação...';
    }
    return 'Preparando visualização AR...';
  };

  // Exibe tela de carregamento enquanto inicializa
  if (
    isInitializing &&
    (cameraPermission === null || locationPermission === null)
  ) {
    return (
      <LoadingState
        message={getLoadingMessage()}
        progress={calculateInitProgress()}
      />
    );
  }

  // Exibe tela de solicitação de permissões se necessário
  if (cameraPermission === false || locationPermission === false) {
    return (
      <PermissionRequest
        cameraPermission={cameraPermission}
        locationPermission={locationPermission}
        cameraError={cameraError}
        locationError={locationError}
        orientationError={orientationError}
        onRequestPermissions={() => startCamera()}
      />
    );
  }

  const isLandscape = orientation === 'landscape';

  return (
    <Box
      sx={{
        position: 'relative',
        width: '100%',
        height: '100%',
        // Aplicar padding para notch/bordas arredondadas em dispositivos iOS
        paddingTop: 'env(safe-area-inset-top)',
        paddingRight: 'env(safe-area-inset-right)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft: 'env(safe-area-inset-left)',
      }}
    >
      {/* Feed da câmera */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          position: 'absolute',
          top: 0,
          left: 0,
        }}
      />

      {/* Overlay de carregamento inicial */}
      {isInitializing && (
        <LoadingState
          message={getLoadingMessage()}
          progress={calculateInitProgress()}
        />
      )}

      {/* Overlay AR quando a câmera está ativa e temos localização e direção */}
      {isActive &&
        coordinates.latitude &&
        coordinates.longitude &&
        heading !== null && (
          <AROverlay
            latitude={coordinates.latitude}
            longitude={coordinates.longitude}
            heading={heading}
            orientation={orientation}
            dimensions={dimensions}
          />
        )}

      {/* Indicador de azimute */}
      {heading !== null && !selectedMarkerId && (
        <AzimuthIndicator
          heading={heading}
          isLandscape={isLandscape}
          isCalibrated={isCalibrated}
        />
      )}

      {/* Botão de voltar - posicionamento adaptável */}
      <Fade in={!selectedMarkerId}>
        <IconButton
          sx={{
            position: 'absolute',
            top: theme.spacing(2),
            left: theme.spacing(2),
            backgroundColor: 'rgba(0,0,0,0.5)',
            color: 'white',
            zIndex: 10,
            '&:hover': {
              backgroundColor: 'rgba(0,0,0,0.7)',
            },
            // Tamanho maior em tablets
            ...(dimensions.width >= 768 && {
              padding: theme.spacing(1.5),
            }),
          }}
          onClick={() => navigate(-1)}
        >
          <ArrowBackIcon
            fontSize={dimensions.width >= 768 ? 'large' : 'medium'}
          />
        </IconButton>
      </Fade>

      {/* Botão para mostrar/esconder informações de debug */}
      <Tooltip title="Modo Desenvolvedor">
        <IconButton
          size="small"
          sx={{
            position: 'absolute',
            top: theme.spacing(2),
            right: theme.spacing(2),
            backgroundColor: showDebugInfo
              ? 'rgba(25,118,210,0.7)'
              : 'rgba(0,0,0,0.5)',
            color: 'white',
            zIndex: 10,
            '&:hover': {
              backgroundColor: showDebugInfo
                ? 'rgba(25,118,210,0.9)'
                : 'rgba(0,0,0,0.7)',
            },
          }}
          onClick={() => setShowDebugInfo(!showDebugInfo)}
        >
          <BugReportIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      {/* Informações de debug - visíveis apenas quando ativadas */}
      {showDebugInfo && (
        <Box
          sx={{
            position: 'absolute',
            backgroundColor: 'rgba(0,0,0,0.7)',
            color: 'white',
            padding: theme.spacing(1.5),
            borderRadius: 1,
            maxWidth: orientation === 'portrait' ? '60%' : '40%',
            zIndex: 9,
            // Posição varia com orientação
            ...(orientation === 'portrait'
              ? { bottom: theme.spacing(2), left: theme.spacing(2) }
              : { top: theme.spacing(7), right: theme.spacing(2) }),
          }}
        >
          <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 'bold' }}>
            Informações de Debug
          </Typography>
          <Typography variant="caption" sx={{ display: 'block' }}>
            Lat: {coordinates.latitude?.toFixed(6) || 'N/A'}
          </Typography>
          <Typography variant="caption" sx={{ display: 'block' }}>
            Lng: {coordinates.longitude?.toFixed(6) || 'N/A'}
          </Typography>
          <Typography variant="caption" sx={{ display: 'block' }}>
            Precisão: {coordinates.accuracy?.toFixed(1) || 'N/A'}m
          </Typography>
          <Typography variant="caption" sx={{ display: 'block' }}>
            Heading: {heading?.toFixed(1) || 'N/A'}°
          </Typography>
          <Typography variant="caption" sx={{ display: 'block' }}>
            Calibrado: {isCalibrated ? 'Sim' : 'Não'}
          </Typography>
          <Typography variant="caption" sx={{ display: 'block' }}>
            Orientação: {orientation}
          </Typography>
          <Typography variant="caption" sx={{ display: 'block' }}>
            Dimensões: {dimensions.width}x{dimensions.height}
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default CameraView;
