// Path: features\ar\components\CameraView.tsx
import { useRef, useState, useCallback, useEffect } from 'react';
import {
  Box,
  Typography,
  Button,
  Alert,
  CircularProgress,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import CameraEnhanceIcon from '@mui/icons-material/CameraEnhance';

import { useCamera } from '../hooks/useCamera';
import { useGeolocation } from '../hooks/useGeolocation';
import { useDeviceOrientation } from '../hooks/useDeviceOrientation';
import { useScreenOrientation } from '../hooks/useScreenOrientation';
import AROverlay from './AROverlay';
import PermissionRequest from './PermissionRequest';
import AzimuthIndicator from './AzimuthIndicator';
import LoadingState from './LoadingState';
import { useMarkersStore } from '../stores/markersStore';
import ErrorBoundary from './ErrorBoundary';

/**
 * Versão otimizada do CameraView que resolve problemas de inicialização e renderização
 */
const CameraView: React.FC = () => {
  // Criamos a referência de vídeo mais cedo no ciclo de vida do componente
  const videoRef = useRef<HTMLVideoElement>(null);
  const { orientation, dimensions } = useScreenOrientation();
  const [isInitializing, setIsInitializing] = useState(true);
  const [debugMode, setDebugMode] = useState(false);
  const initTimeoutRef = useRef<number | null>(null);
  const hasAttemptedInitRef = useRef(false);
  const forceRenderRef = useRef(0); // Ref para forçar re-renderização em intervalos

  // Estado local para rastrear tentativas de inicialização
  const [_, setInitAttempts] = useState(0);

  // Acessa os hooks personalizados
  const {
    startCamera,
    requestCameraPermission,
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

  const { selectedMarkerId, setVisibleMarkers } = useMarkersStore();

  // Reseta os marcadores visíveis para evitar problemas de renderização com dados antigos
  useEffect(() => {
    // Limpa os marcadores visíveis ao iniciar
    setVisibleMarkers([]);
  }, [setVisibleMarkers]);

  // Força re-renderização periódica no modo debug para atualizar valores
  useEffect(() => {
    if (debugMode) {
      const timer = setInterval(() => {
        forceRenderRef.current += 1; // Alterar a ref para forçar re-renderização
        // Forçamos um re-render
        setInitAttempts(prev => prev); // Isso força um re-render sem mudar o valor
      }, 500); // Atualiza a cada 500ms

      return () => clearInterval(timer);
    }
  }, [debugMode]);

  // Função para forçar solicitação de permissão da câmera
  const forceRequestCamera = useCallback(() => {
    console.log('Forçando solicitação de permissão da câmera');
    hasAttemptedInitRef.current = false; // Reset da flag para permitir nova tentativa
    requestCameraPermission();
  }, [requestCameraPermission]);

  // Função para forçar solicitação de permissão de localização
  const forceRequestLocation = useCallback(() => {
    console.log('Forçando solicitação de permissão de localização');
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        () => console.log('Permissão de localização concedida'),
        err => console.error('Erro de permissão de localização:', err),
      );
    }
  }, []);

  // Função para recarregar a aplicação
  const handleReload = useCallback(() => {
    window.location.reload();
  }, []);

  // Função para ignorar sensores e continuar
  const handleContinueAnyway = useCallback(() => {
    setIsInitializing(false);
  }, []);

  // Função para alternar modo de depuração
  const toggleDebugMode = useCallback(() => {
    setDebugMode(prev => !prev);
  }, []);

  // Effect para inicializar automaticamente quando as permissões estiverem prontas
  useEffect(() => {
    // Para debug
    console.log('Estado das permissões:', {
      camera: cameraPermission,
      location: locationPermission,
      heading,
      isInitializing,
    });

    // Se a câmera e localização estão OK, podemos continuar
    if (cameraPermission !== false && locationPermission !== false) {
      // Se não tentamos inicializar ainda
      if (!hasAttemptedInitRef.current) {
        // Marca que já tentamos inicializar
        hasAttemptedInitRef.current = true;

        console.log('Inicializando câmera');

        // Inicializa a câmera
        startCamera();

        // Se o timeout ainda não foi definido, definimos um
        // para permitir que o app prossiga mesmo se o heading não estiver disponível
        if (initTimeoutRef.current === null) {
          console.log('Definindo timeout de inicialização');
          // Espera um pouco para dar tempo para o heading ser carregado
          // mas não espera infinitamente
          initTimeoutRef.current = window.setTimeout(() => {
            console.log(
              'Timeout de inicialização atingido, continuando de qualquer forma',
            );
            setIsInitializing(false);
          }, 3000); // Espera 3 segundos no máximo
        }
      }

      // Se heading já estiver disponível e estamos inicializando, podemos continuar imediatamente
      if (heading !== null && isInitializing) {
        if (initTimeoutRef.current) {
          clearTimeout(initTimeoutRef.current);
          initTimeoutRef.current = null;
        }
        console.log('Heading disponível, continuando');
        setIsInitializing(false);
      }
    }

    // Limpeza ao desmontar
    return () => {
      if (initTimeoutRef.current) {
        clearTimeout(initTimeoutRef.current);
        initTimeoutRef.current = null;
      }
    };
  }, [
    cameraPermission,
    locationPermission,
    heading,
    startCamera,
    isInitializing,
  ]);

  // Calcula o progresso de inicialização para o LoadingState
  const calculateInitProgress = useCallback(() => {
    let progress = 0;
    if (cameraPermission === true) progress += 40;
    if (locationPermission === true) progress += 40;
    if (heading !== null) progress += 20;
    return progress;
  }, [cameraPermission, locationPermission, heading]);

  // Detecta a permissão real no sistema
  const detectRealPermission = useCallback(async () => {
    try {
      if (!navigator.mediaDevices) {
        console.error('MediaDevices API não disponível');
        return false;
      }

      // Tenta obter acesso à câmera com configurações mínimas
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false,
      });

      // Se chegou aqui, temos permissão
      console.log('Permissão da câmera detectada pelo sistema');

      // Limpa o stream de teste
      stream.getTracks().forEach(track => track.stop());

      return true;
    } catch (err) {
      console.error('Erro ao detectar permissão real:', err);
      return false;
    }
  }, []);

  // Define UI para quando as permissões não foram concedidas
  if (cameraPermission === false || locationPermission === false) {
    return (
      <ErrorBoundary>
        <PermissionRequest
          cameraPermission={cameraPermission}
          locationPermission={locationPermission}
          cameraError={cameraError}
          locationError={locationError}
          orientationError={orientationError || null}
          onRequestPermissions={async () => {
            // Primeiro verifica se já temos permissão real
            const realPermission = await detectRealPermission();

            if (realPermission) {
              console.log('Permissão real detectada. Continuando...');
              hasAttemptedInitRef.current = false;
              // Força um novo estado para atualizar a UI
              setInitAttempts(prev => prev + 1);
              startCamera();
            } else {
              console.log('Sem permissão real. Solicitando permissões...');
              // Reseta flag para permitir tentar novamente
              hasAttemptedInitRef.current = false;
              requestCameraPermission();
            }
          }}
        />
      </ErrorBoundary>
    );
  }

  // Se estamos em modo de depuração, mostramos mais informações
  if (debugMode) {
    return (
      <ErrorBoundary>
        <Box
          sx={{
            padding: 2,
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            bgcolor: 'background.paper',
            color: 'text.primary',
            overflow: 'auto', // Permite rolagem
            overflowX: 'hidden', // Evita rolagem horizontal
            '&::-webkit-scrollbar': {
              display: 'block', // Exibe a barra de rolagem
              width: '8px',
            },
            '&::-webkit-scrollbar-thumb': {
              backgroundColor: 'rgba(0,0,0,0.2)',
              borderRadius: '4px',
            },
          }}
        >
          <Typography variant="h5" gutterBottom>
            Modo de Depuração{' '}
            {forceRenderRef.current > 0 ? `(${forceRenderRef.current})` : ''}
          </Typography>

          <Alert severity="info" sx={{ mb: 2 }}>
            Use este modo para identificar problemas de inicialização e
            permissões.
          </Alert>

          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle1">Estado de Permissões:</Typography>
            <Typography>
              Câmera (Report):{' '}
              {cameraPermission === null
                ? 'Não solicitada'
                : cameraPermission
                  ? 'Permitida'
                  : 'Negada'}
            </Typography>
            <Typography>
              Câmera (Real):{' '}
              <Button
                size="small"
                onClick={async () => {
                  const real = await detectRealPermission();
                  alert(
                    `Permissão real da câmera: ${real ? 'PERMITIDA' : 'NEGADA'}`,
                  );
                }}
              >
                Verificar
              </Button>
            </Typography>
            <Typography>
              Localização:{' '}
              {locationPermission === null
                ? 'Não solicitada'
                : locationPermission
                  ? 'Permitida'
                  : 'Negada'}
            </Typography>
            <Typography>
              Orientação: {heading === null ? 'Não disponível' : 'Disponível'}
            </Typography>
          </Box>

          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle1">Erros:</Typography>
            <Typography color="error">
              {cameraError || 'Nenhum erro da câmera'}
            </Typography>
            <Typography color="error">
              {locationError || 'Nenhum erro de localização'}
            </Typography>
            <Typography color="error">
              {orientationError || 'Nenhum erro de orientação'}
            </Typography>
          </Box>

          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle1">Coordenadas:</Typography>
            <Typography>
              Latitude: {coordinates.latitude?.toFixed(6) || 'N/A'}
            </Typography>
            <Typography>
              Longitude: {coordinates.longitude?.toFixed(6) || 'N/A'}
            </Typography>
            <Typography>
              Precisão: {coordinates.accuracy?.toFixed(1) || 'N/A'}m
            </Typography>
          </Box>

          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle1">Orientação:</Typography>
            <Typography>Heading: {heading?.toFixed(1) || 'N/A'}°</Typography>
            <Typography>Calibrado: {isCalibrated ? 'Sim' : 'Não'}</Typography>
          </Box>

          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle1">Câmera:</Typography>
            <Typography>Estado: {isActive ? 'Ativa' : 'Inativa'}</Typography>
            <Typography>
              Video Ref: {videoRef.current ? 'Disponível' : 'Não disponível'}
            </Typography>

            {/* Elemento de vídeo sempre criado no modo debug */}
            <Box
              sx={{
                width: '100%',
                height: 200,
                my: 1,
                border: '1px solid #ccc',
                borderRadius: 8,
                overflow: 'hidden',
                position: 'relative',
                bgcolor: '#111',
              }}
            >
              <video
                ref={videoRef}
                autoPlay
                playsInline
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />

              {!isActive && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'rgba(0,0,0,0.7)',
                  }}
                >
                  <Typography color="error">Câmera inativa</Typography>
                </Box>
              )}
            </Box>
          </Box>

          <Box
            sx={{
              mt: 2,
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
              pb: 4,
            }}
          >
            <Button
              variant="contained"
              color="primary"
              onClick={forceRequestCamera}
              startIcon={<CameraAltIcon />}
            >
              Solicitar Permissão da Câmera
            </Button>

            <Button
              variant="contained"
              color="primary"
              onClick={forceRequestLocation}
              startIcon={<LocationOnIcon />}
            >
              Solicitar Permissão de Localização
            </Button>

            <Button
              variant="contained"
              color="success"
              onClick={() => {
                startCamera();
              }}
              startIcon={<CameraEnhanceIcon />}
            >
              Iniciar Câmera
            </Button>

            <Button
              variant="contained"
              color="secondary"
              onClick={handleReload}
              startIcon={<RefreshIcon />}
            >
              Recarregar Aplicativo
            </Button>

            <Button variant="outlined" onClick={handleContinueAnyway}>
              Continuar Sem Esperar Inicialização
            </Button>

            <Button variant="outlined" onClick={() => setDebugMode(false)}>
              Voltar ao Modo Normal
            </Button>
          </Box>
        </Box>
      </ErrorBoundary>
    );
  }

  // Exibe tela de carregamento normal
  if (isInitializing) {
    return (
      <ErrorBoundary>
        <Box
          sx={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'background.default',
            padding: 3,
            position: 'relative',
          }}
        >
          <LoadingState
            message={`Inicializando... ${calculateInitProgress()}%`}
            progress={calculateInitProgress()}
          />

          <Box
            sx={{ position: 'absolute', bottom: 16, display: 'flex', gap: 1 }}
          >
            <Button
              variant="contained"
              color="primary"
              size="small"
              onClick={toggleDebugMode}
            >
              Modo Depuração
            </Button>

            <Button
              variant="outlined"
              size="small"
              onClick={forceRequestCamera}
            >
              Permissão Câmera
            </Button>

            <Button
              variant="outlined"
              size="small"
              onClick={handleContinueAnyway}
            >
              Continuar Assim
            </Button>
          </Box>
        </Box>
      </ErrorBoundary>
    );
  }

  // Se a câmera não está ativa mas passamos do estado de inicialização,
  // tentamos iniciar novamente e mostramos um estado de carregamento
  if (!isActive && !isInitializing) {
    // Tenta iniciar a câmera
    startCamera();

    return (
      <ErrorBoundary>
        <Box
          sx={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'background.default',
          }}
        >
          <CircularProgress color="primary" />
          <Typography variant="body1" sx={{ mt: 2, mb: 4 }}>
            Iniciando câmera...
          </Typography>
          <Button
            variant="contained"
            color="primary"
            size="small"
            onClick={toggleDebugMode}
          >
            Modo Depuração
          </Button>
        </Box>
      </ErrorBoundary>
    );
  }

  // Garantimos que o elemento de vídeo esteja sempre no DOM, mesmo quando não visível
  return (
    <ErrorBoundary>
      <Box
        sx={{
          position: 'relative',
          width: '100%',
          height: '100%',
          paddingTop: 'env(safe-area-inset-top)',
          paddingRight: 'env(safe-area-inset-right)',
          paddingBottom: 'env(safe-area-inset-bottom)',
          paddingLeft: 'env(safe-area-inset-left)',
        }}
      >
        {/* Feed da câmera - sempre renderizado para garantir que a ref esteja disponível */}
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

        {/* Overlay AR quando a câmera está ativa e temos localização */}
        {isActive && coordinates.latitude && coordinates.longitude && (
          <AROverlay
            latitude={coordinates.latitude}
            longitude={coordinates.longitude}
            heading={heading ?? 0}
            orientation={orientation}
            dimensions={dimensions}
          />
        )}

        {/* Indicador de azimute */}
        {!selectedMarkerId && (
          <AzimuthIndicator
            heading={heading ?? 0}
            isLandscape={orientation === 'landscape'}
            isCalibrated={Boolean(isCalibrated)}
          />
        )}

        {/* Botão para modo de depuração no canto */}
        <Button
          variant="contained"
          size="small"
          onClick={toggleDebugMode}
          sx={{
            position: 'absolute',
            bottom: 16,
            right: 16,
            zIndex: 1000,
            opacity: 0.7,
          }}
        >
          Debug
        </Button>
      </Box>
    </ErrorBoundary>
  );
};

// Componente wrapper com ErrorBoundary
const CameraViewWithErrorHandling: React.FC = () => {
  return (
    <ErrorBoundary>
      <CameraView />
    </ErrorBoundary>
  );
};

export default CameraViewWithErrorHandling;
