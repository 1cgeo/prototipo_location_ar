// Path: features\ar\components\CameraView.tsx
import { useRef, useState, useCallback } from 'react';
import { Box, Typography, Button, Alert } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import LocationOnIcon from '@mui/icons-material/LocationOn';

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
 * Versão simplificada do CameraView para depuração de problemas de inicialização
 */
const CameraView: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { orientation, dimensions } = useScreenOrientation();
  const [isInitializing, setIsInitializing] = useState(true);
  const [debugMode, setDebugMode] = useState(false);

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

  const { selectedMarkerId } = useMarkersStore();

  // Função para forçar solicitação de permissão da câmera
  const forceRequestCamera = useCallback(() => {
    console.log('Forçando solicitação de permissão da câmera');
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

  // Calcula o progresso de inicialização para o LoadingState
  const calculateInitProgress = () => {
    let progress = 0;
    if (cameraPermission === true) progress += 40;
    if (locationPermission === true) progress += 40;
    if (heading !== null) progress += 20;
    return progress;
  };

  // Se estamos em modo de depuração, mostramos mais informações
  if (debugMode) {
    return (
      <Box
        sx={{
          padding: 2,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          bgcolor: 'background.paper',
          color: 'text.primary',
        }}
      >
        <Typography variant="h5" gutterBottom>
          Modo de Depuração
        </Typography>

        <Alert severity="info" sx={{ mb: 2 }}>
          Use este modo para identificar problemas de inicialização e
          permissões.
        </Alert>

        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle1">Estado de Permissões:</Typography>
          <Typography>
            Câmera:{' '}
            {cameraPermission === null
              ? 'Não solicitada'
              : cameraPermission
                ? 'Permitida'
                : 'Negada'}
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
          <video
            ref={videoRef}
            autoPlay
            playsInline
            style={{
              width: '100%',
              height: 200,
              objectFit: 'cover',
              marginTop: 8,
              border: '1px solid #ccc',
              borderRadius: 8,
              backgroundColor: '#000',
            }}
          />
        </Box>

        <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 1 }}>
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
    );
  }

  // Exibe tela de carregamento normal
  if (isInitializing) {
    return (
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

        <Box sx={{ position: 'absolute', bottom: 16, display: 'flex', gap: 1 }}>
          <Button
            variant="contained"
            color="primary"
            size="small"
            onClick={toggleDebugMode}
          >
            Modo Depuração
          </Button>

          <Button variant="outlined" size="small" onClick={forceRequestCamera}>
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
    );
  }

  // Exibe tela de permissões se necessário
  if (cameraPermission === false || locationPermission === false) {
    return (
      <PermissionRequest
        cameraPermission={cameraPermission}
        locationPermission={locationPermission}
        cameraError={cameraError}
        locationError={locationError}
        orientationError={orientationError}
        onRequestPermissions={startCamera}
      />
    );
  }

  const isLandscape = orientation === 'landscape';

  // Renderização normal do app
  return (
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

      {/* Overlay AR quando a câmera está ativa e temos localização */}
      {isActive && coordinates.latitude && coordinates.longitude && (
        <AROverlay
          latitude={coordinates.latitude}
          longitude={coordinates.longitude}
          heading={heading || 0}
          orientation={orientation}
          dimensions={dimensions}
        />
      )}

      {/* Indicador de azimute */}
      {(heading !== null || true) && !selectedMarkerId && (
        <AzimuthIndicator
          heading={heading || 0}
          isLandscape={isLandscape}
          isCalibrated={isCalibrated}
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
  );
};

export default CameraView;
