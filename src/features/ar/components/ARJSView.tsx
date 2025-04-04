// Path: features\ar\components\ARJSView.tsx
import React, { useEffect, useRef, useState } from 'react';
import { Box, Snackbar, Alert, Typography, Modal } from '@mui/material';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import 'aframe';
import 'ar.js/aframe/build/aframe-ar';
import { Entity, Scene } from 'aframe-react';

import { useARStore } from '../stores/arStore';
import PermissionRequest from './PermissionRequest';
import LoadingState from './LoadingState';
import ErrorBoundary from './ErrorBoundary';
import ARJSOverlay from './ARJSOverlay';
import ARMarkerOverlay from './ARMarkerOverlay';
import AzimuthIndicator from './AzimuthIndicator';
import { useScreenOrientation } from '../hooks/useScreenOrientation';

/**
 * AR.js View component for location-based AR
 * Enhanced version with altitude support
 */
const ARJSView: React.FC = () => {
  // Using RefObject<any> as a workaround for the Scene component ref
  const sceneRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showCameraError, setShowCameraError] = useState(false);
  const [cameraErrorDetails, setCameraErrorDetails] = useState<string>('');
  const [showMarkerMessage, setShowMarkerMessage] = useState(false);
  const [permissionsGranted, setPermissionsGranted] = useState(false);
  const [permissionsChecked, setPermissionsChecked] = useState(false);
  const [compassLocked, setCompassLocked] = useState(false);
  const { orientation, dimensions } = useScreenOrientation();

  // Get data from store
  const {
    coordinates,
    heading,
    selectedMarkerId,
    markersGenerated,
    allMarkers,
    visibleMarkers,
    setCoordinates,
    setHeading,
    selectMarker,
    generateMarkersAtLocation,
    updateVisibleMarkers,
  } = useARStore();

  // Referências para o filtro de suavização da bússola
  const headingHistoryRef = useRef<number[]>([]);
  const lastValidHeadingRef = useRef<number | null>(null);
  const deviceOrientationRef = useRef<{ beta: number | null }>({
    beta: null,
  });
  const lastHeadingTimestampRef = useRef<number>(0);

  // Proactively check permissions on component mount
  useEffect(() => {
    async function checkExistingPermissions() {
      try {
        // Check for camera permission
        let cameraPermitted = false;
        let locationPermitted = false;

        // First try to get camera access directly - this will either use existing permissions
        // or prompt the user if permissions haven't been granted yet
        try {
          const cameraStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' },
          });
          // If we get here, camera permission is granted
          cameraPermitted = true;

          // Release the camera stream immediately since we're just checking permissions
          cameraStream.getTracks().forEach(track => track.stop());
        } catch (err) {
          console.log('Camera permission not granted:', err);
          cameraPermitted = false;
        }

        // Check location permission by trying to get the position
        try {
          // Use getCurrentPosition instead of watchPosition for initial check
          const position = await new Promise<GeolocationPosition>(
            (resolve, reject) => {
              navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 5000,
                maximumAge: 0,
              });
            },
          );

          locationPermitted = true;

          // If we got a position, we can also set the coordinates
          const altitude =
            position.coords.altitude !== null ? position.coords.altitude : 0;
          setCoordinates(
            position.coords.latitude,
            position.coords.longitude,
            position.coords.accuracy,
            altitude,
          );

          // Generate markers if this is the first time we're getting location
          if (
            !markersGenerated &&
            position.coords.latitude &&
            position.coords.longitude
          ) {
            generateMarkersAtLocation(
              position.coords.latitude,
              position.coords.longitude,
              altitude,
            );
          }
        } catch (err) {
          console.log('Location permission not granted:', err);
          locationPermitted = false;
        }

        // Set permissions state based on checks
        setPermissionsGranted(cameraPermitted && locationPermitted);
        setPermissionsChecked(true);

        // If both permissions are granted, we can start initializing the AR experience
        if (cameraPermitted && locationPermitted) {
          setIsLoading(true);
          // Allow a short delay to ensure UI updates before initializing AR
          setTimeout(() => {
            initializeAR();
          }, 500);
        } else {
          setIsLoading(false);
        }
      } catch (err) {
        console.error('Error checking permissions:', err);
        setPermissionsChecked(true);
        setIsLoading(false);
      }
    }

    checkExistingPermissions();
  }, []);

  // Initialize AR experience
  const initializeAR = () => {
    setIsLoading(true);
    // Setup global communication bridge with AR.js
    window.arjsEventHandlers = {
      onMarkerSelect: (markerId: string) => {
        selectMarker(markerId);
      },
    };

    // Set a timeout to ensure AR.js has time to initialize
    setTimeout(() => {
      setIsLoading(false);
      updateVisibleMarkers();
    }, 2000);
  };

  // Setup continuous location tracking once permissions are granted
  useEffect(() => {
    if (!permissionsGranted || !navigator.geolocation) {
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      position => {
        // Get altitude if available, otherwise use 0
        const altitude =
          position.coords.altitude !== null ? position.coords.altitude : 0;

        setCoordinates(
          position.coords.latitude,
          position.coords.longitude,
          position.coords.accuracy,
          altitude,
        );

        // Generate markers if not already generated
        if (
          !markersGenerated &&
          position.coords.latitude &&
          position.coords.longitude
        ) {
          generateMarkersAtLocation(
            position.coords.latitude,
            position.coords.longitude,
            altitude,
          );
        } else {
          // Update distances in real-time as the user moves
          updateVisibleMarkers();
        }
      },
      error => {
        let message = 'Location error';

        if (error.code === 1) {
          // PERMISSION_DENIED
          message = 'Location permission denied';
          setPermissionsGranted(false);
        } else if (error.code === 2) {
          // POSITION_UNAVAILABLE
          message = 'Location unavailable';
        } else if (error.code === 3) {
          // TIMEOUT
          message = 'Location request timed out';
        }

        setErrorMessage(message);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10000,
      },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [
    permissionsGranted,
    markersGenerated,
    setCoordinates,
    generateMarkersAtLocation,
    updateVisibleMarkers,
  ]);

  // Função para aplicar filtro de suavização à bússola
  const applyHeadingFilter = (newHeading: number): number => {
    // Inicializar o histórico se for o primeiro valor
    if (headingHistoryRef.current.length === 0) {
      // Preenche o histórico com o valor inicial para evitar transições bruscas
      headingHistoryRef.current = Array(8).fill(newHeading);
      lastValidHeadingRef.current = newHeading;
      return newHeading;
    }

    const now = Date.now();
    const timeDelta = now - lastHeadingTimestampRef.current;
    lastHeadingTimestampRef.current = now;

    // Verifica mudanças bruscas (possivelmente ruído)
    const lastHeading =
      lastValidHeadingRef.current || headingHistoryRef.current[0];
    let headingDiff = Math.abs(newHeading - lastHeading);
    // Ajuste para lidar com a transição 359° -> 0°
    if (headingDiff > 180) {
      headingDiff = 360 - headingDiff;
    }

    // Se a mudança for muito brusca e rápida, pode ser um erro ou ruído
    // Ignora mudanças muito rápidas a menos que estejamos em posição horizontal
    const isDeviceNearlyHorizontal =
      deviceOrientationRef.current.beta !== null &&
      Math.abs(deviceOrientationRef.current.beta) < 25;

    // Filtragem mais forte para movimentos bruscos quando não estamos na horizontal
    // (segurando o dispositivo como uma "janela" para o mundo)
    const isValidReading =
      isDeviceNearlyHorizontal || headingDiff < 45 || timeDelta > 300;

    if (!isValidReading) {
      // Retorna o último valor válido em caso de leitura duvidosa
      return lastValidHeadingRef.current || newHeading;
    }

    // Adiciona o novo valor ao histórico (limitado a 8 valores)
    headingHistoryRef.current.push(newHeading);
    if (headingHistoryRef.current.length > 8) {
      headingHistoryRef.current.shift();
    }

    // Aplica filtro de média ponderada (valores mais recentes têm mais peso)
    const weights = [0.05, 0.05, 0.1, 0.1, 0.1, 0.15, 0.2, 0.25];
    let weightSum = 0;

    // Calcula média ponderada considerando a circularidade do ângulo
    // (para lidar com a transição 359° -> 0°)
    let sinSum = 0;
    let cosSum = 0;

    for (let i = 0; i < headingHistoryRef.current.length; i++) {
      const weight =
        weights[weights.length - headingHistoryRef.current.length + i];
      weightSum += weight;

      // Converte para radianos e soma componentes vetoriais
      const radians = (headingHistoryRef.current[i] * Math.PI) / 180;
      sinSum += Math.sin(radians) * weight;
      cosSum += Math.cos(radians) * weight;
    }

    // Converte de volta para graus
    let filteredHeading = (Math.atan2(sinSum, cosSum) * 180) / Math.PI;
    if (filteredHeading < 0) {
      filteredHeading += 360;
    }

    // Atualiza o último heading válido
    lastValidHeadingRef.current = filteredHeading;

    return filteredHeading;
  };

  // Função para lidar com a compensação de inclinação
  const getCompensatedHeading = (
    alpha: number,
    beta: number | null,
  ): number => {
    // Se não temos dados de inclinação, usamos apenas alpha
    if (beta === null) {
      return 360 - alpha;
    }

    // Salva o estado atual da orientação do dispositivo
    deviceOrientationRef.current = { beta };

    // Aplicamos um fator de compensação baseado na inclinação (beta)
    // Quando o dispositivo está mais inclinado, reduzimos a influência do magnetômetro
    let heading = 360 - alpha;

    // Compensação suave para quando o dispositivo está sendo inclinado
    // Reduz o impacto das leituras quando o celular não está na horizontal
    const betaAbs = Math.abs(beta);

    // Quando beta está próximo de 90° (celular na vertical),
    // a leitura do magnetômetro (alpha) torna-se menos confiável
    if (betaAbs > 45) {
      // Se tivermos um valor anterior válido e a inclinação for muito alta,
      // preferimos o valor anterior para evitar inversões da bússola
      if (lastValidHeadingRef.current !== null && betaAbs > 85) {
        // A inclinação é tão alta que preferimos usar o último valor conhecido
        // Atualiza o estado de bússola travada
        setCompassLocked(true);
        return lastValidHeadingRef.current;
      }
    } else {
      // Inclinação normal, bússola desbloqueada
      setCompassLocked(false);
    }

    return heading;
  };

  // Handle device orientation for heading - VERSÃO MELHORADA COM FILTRO
  useEffect(() => {
    if (!permissionsGranted) return;

    const handleOrientation = (event: DeviceOrientationEvent) => {
      if (event.alpha !== null) {
        // Obter o heading compensado considerando a inclinação do dispositivo
        const rawHeading = getCompensatedHeading(event.alpha, event.beta);

        // Aplicar filtro de suavização
        const filteredHeading = applyHeadingFilter(rawHeading);

        // Atualizar o estado apenas se o valor for válido e diferente do atual
        if (!isNaN(filteredHeading) && filteredHeading !== heading) {
          setHeading(filteredHeading);
        }
      }
    };

    window.addEventListener('deviceorientation', handleOrientation, true);

    return () => {
      window.removeEventListener('deviceorientation', handleOrientation, true);
    };
  }, [permissionsGranted, setHeading, heading]);

  // Monitor and handle camera errors from A-Frame
  useEffect(() => {
    if (!permissionsGranted) return;

    // Helper to capture camera errors from A-Frame/AR.js
    const handleCameraError = (error: ErrorEvent) => {
      // Check if it's a camera-related error from AR.js
      if (
        error.message &&
        (error.message.includes('camera') ||
          error.message.includes('video') ||
          error.message.includes('getUserMedia') ||
          error.message.includes('NotReadableError'))
      ) {
        console.error('Camera error detected:', error);
        setCameraErrorDetails(error.message || 'Camera access error');
        setShowCameraError(true);
        setIsLoading(false);
      }
    };

    // Listen for AR.js specific errors
    window.addEventListener('error', handleCameraError);

    // Also set up a specific handler for A-Frame's camera errors
    if (typeof window !== 'undefined' && window.AFRAME) {
      const onArError = (ev: any) => {
        if (ev.detail && ev.detail.error) {
          handleCameraError(
            new ErrorEvent('error', {
              message: `AR.js: ${ev.detail.error}`,
            }),
          );
        }
      };
      document.addEventListener('ar-camera-error', onArError);
      return () => {
        window.removeEventListener('error', handleCameraError);
        document.removeEventListener('ar-camera-error', onArError);
      };
    }

    return () => {
      window.removeEventListener('error', handleCameraError);
    };
  }, [permissionsGranted]);

  // Handle camera permissions
  const requestCameraPermission = async () => {
    try {
      // Request camera permission
      const cameraStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment', // Prefer back camera
        },
      });

      // Release the camera immediately after permission check
      // to avoid blocking it for AR.js
      cameraStream.getTracks().forEach(track => track.stop());

      // Now check location permission
      try {
        await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 0,
          });
        });

        // If we get here, both permissions are granted
        setPermissionsGranted(true);
        setIsLoading(true);
        setShowCameraError(false);

        // Initialize AR with a delay to allow permissions to propagate
        setTimeout(() => {
          initializeAR();
        }, 500);
      } catch (error) {
        console.error('Location permission error:', error);
        setErrorMessage('Location permission denied');
      }
    } catch (error) {
      console.error('Camera permission error:', error);
      setPermissionsGranted(false);
      setErrorMessage('Camera permission denied');
      if (error instanceof Error) {
        setCameraErrorDetails(error.message);
      }
    }
  };

  // Handle camera retry
  const retryCameraAccess = async () => {
    setShowCameraError(false);
    setIsLoading(true);

    // Release camera if possible before retrying
    try {
      const tracks = await navigator.mediaDevices.getUserMedia({ video: true });
      tracks.getTracks().forEach(track => track.stop());
    } catch (e) {
      // Ignore errors here, just trying to release the camera
    }

    // Wait a moment and retry
    setTimeout(() => {
      requestCameraPermission();
    }, 1000);
  };

  // Show markers generated message
  useEffect(() => {
    if (markersGenerated && allMarkers.length > 0) {
      setShowMarkerMessage(true);
      // Hide message after 4 seconds
      const timer = setTimeout(() => {
        setShowMarkerMessage(false);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [markersGenerated, allMarkers.length]);

  // Before permissions have been checked, show loading
  if (!permissionsChecked) {
    return (
      <ErrorBoundary>
        <LoadingState message="Verificando permissões..." />
      </ErrorBoundary>
    );
  }

  // UI for when permissions haven't been granted
  if (!permissionsGranted) {
    return (
      <ErrorBoundary>
        <PermissionRequest
          cameraPermission={false}
          locationPermission={coordinates.latitude !== null}
          cameraError={errorMessage}
          locationError={errorMessage}
          onRequestPermissions={requestCameraPermission}
        />
      </ErrorBoundary>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <ErrorBoundary>
        <LoadingState message="Inicializando AR..." />
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <Box
        sx={{
          position: 'relative',
          width: '100%',
          height: '100%',
          overflow: 'hidden',
        }}
      >
        {/* RESTAURADA A CONFIGURAÇÃO ORIGINAL DO SCENE */}
        <Scene
          ref={sceneRef}
          embedded
          arjs={{
            sourceType: 'webcam',
            trackingMethod: 'best',
            debugUIEnabled: false,
            areaLearningButton: false,
            detectionMode: 'mono_and_matrix',
            matrixCodeType: '3x3',
            patternRatio: 0.5,
            sourceWidth: dimensions.width,
            sourceHeight: dimensions.height,
            displayWidth: dimensions.width,
            displayHeight: dimensions.height,
          }}
          vr-mode-ui={{ enabled: false }}
          renderer={{
            logarithmicDepthBuffer: true,
            alpha: true,
          }}
          style={{
            zIndex: 0,
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
          }}
        >
          {/* Camera - configuração original */}
          <Entity
            primitive="a-camera"
            gps-camera={{
              simulateLatitude: coordinates.latitude,
              simulateLongitude: coordinates.longitude,
              gpsMinDistance: 5,
              gpsTimeInterval: 1000,
              simulateAltitude: coordinates.altitude,
            }}
          />

          {/* AR content - POI markers */}
          {markersGenerated &&
            coordinates.latitude &&
            coordinates.longitude &&
            allMarkers.map(marker => {
              const [lng, lat, altitude = 0] = marker.geometry.coordinates;
              // Only create entities for markers in the current visible list
              const isVisible = visibleMarkers.some(
                visibleMarker => visibleMarker.id === marker.id,
              );

              if (!isVisible) return null;

              return (
                <Entity
                  key={marker.id}
                  primitive="a-box"
                  gps-entity-place={`latitude: ${lat}; longitude: ${lng}; altitude: ${altitude};`}
                  material={{ color: '#2196f3' }}
                  position={{ x: 0, y: 0, z: 0 }}
                  scale={{ x: 0.5, y: 0.5, z: 0.5 }}
                  look-at="[gps-camera]"
                  animation__click={{
                    property: 'scale',
                    startEvents: 'click',
                    easing: 'easeInCubic',
                    dur: 150,
                    from: '0.5 0.5 0.5',
                    to: '1 1 1',
                  }}
                  animation__clickend={{
                    property: 'scale',
                    startEvents: 'mouseup',
                    easing: 'easeOutCubic',
                    dur: 150,
                    from: '1 1 1',
                    to: '0.5 0.5 0.5',
                  }}
                  gps-entity-click-handler
                  data-marker-id={marker.id}
                  data-marker-name={marker.properties.name}
                  data-marker-category={marker.properties.category}
                />
              );
            })}
        </Scene>

        {/* Compass indicator - only show when no marker is selected */}
        {!selectedMarkerId && heading !== null && (
          <AzimuthIndicator
            heading={heading}
            isLandscape={orientation === 'landscape'}
            isLocked={compassLocked}
          />
        )}

        {/* Marker UI Overlay - Only show when no marker is selected */}
        {!selectedMarkerId && (
          <ARMarkerOverlay
            markers={visibleMarkers}
            orientation={orientation}
            dimensions={dimensions}
            heading={heading || 0}
          />
        )}

        {/* Info Card for selected marker as Modal */}
        {selectedMarkerId && (
          <Modal
            open={!!selectedMarkerId}
            onClose={() => selectMarker(null)}
            aria-labelledby="marker-info-modal"
            aria-describedby="marker-information-details"
            sx={{
              display: 'flex',
              alignItems: orientation === 'landscape' ? 'center' : 'flex-end',
              justifyContent: 'center',
              p: 2,
            }}
            BackdropProps={{
              sx: { backgroundColor: 'rgba(0,0,0,0.5)' },
            }}
          >
            <Box
              sx={{
                width:
                  orientation === 'landscape'
                    ? dimensions.width >= 768
                      ? '40%'
                      : '60%'
                    : dimensions.width >= 768
                      ? '70%'
                      : '90%',
                maxWidth: 500,
                outline: 'none',
                maxHeight: orientation === 'portrait' ? '85vh' : '90vh',
                overflowY: 'auto',
              }}
            >
              <ARJSOverlay orientation={orientation} dimensions={dimensions} />
            </Box>
          </Modal>
        )}

        {/* Marker generation notice */}
        <Snackbar
          open={showMarkerMessage}
          autoHideDuration={4000}
          onClose={() => setShowMarkerMessage(false)}
          anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        >
          <Alert
            severity="success"
            icon={<LocationOnIcon />}
            sx={{ width: '100%' }}
          >
            <Typography variant="body2">
              {allMarkers.length} pontos de interesse gerados ao seu redor!
            </Typography>
            <Typography variant="caption">
              Gire a câmera para encontrá-los
            </Typography>
          </Alert>
        </Snackbar>

        {/* Camera Error Dialog */}
        <Modal
          open={showCameraError}
          onClose={() => setShowCameraError(false)}
          aria-labelledby="camera-error-dialog"
        >
          <Box
            sx={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '85%',
              maxWidth: 400,
              bgcolor: 'background.paper',
              borderRadius: 2,
              boxShadow: 24,
              p: 3,
            }}
          >
            <Typography variant="h6" component="h2" sx={{ mb: 2 }}>
              Erro de Câmera
            </Typography>
            <Typography variant="body2" sx={{ mb: 2 }}>
              {cameraErrorDetails || 'Não foi possível iniciar a câmera'}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Isso pode acontecer se outro aplicativo estiver usando sua câmera
              ou se as permissões foram negadas.
            </Typography>
            <Box
              sx={{ mt: 2, display: 'flex', justifyContent: 'space-between' }}
            >
              <Box sx={{ flex: 1 }} />
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Box
                  onClick={() => setShowCameraError(false)}
                  sx={{
                    color: 'primary.main',
                    cursor: 'pointer',
                    fontWeight: 500,
                    p: 1,
                  }}
                >
                  Ignorar
                </Box>
                <Box
                  onClick={retryCameraAccess}
                  sx={{
                    bgcolor: 'primary.main',
                    color: 'white',
                    px: 2,
                    py: 1,
                    borderRadius: 1,
                    cursor: 'pointer',
                    fontWeight: 500,
                  }}
                >
                  Tentar Novamente
                </Box>
              </Box>
            </Box>
          </Box>
        </Modal>
      </Box>
    </ErrorBoundary>
  );
};

export default ARJSView;
