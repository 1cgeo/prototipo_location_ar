// Path: features\ar\components\PermissionRequest.tsx
import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Button,
  Typography,
  Paper,
  Alert,
  Collapse,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  useTheme,
  Divider,
  LinearProgress,
  Chip,
  Grid,
  alpha, // Importação adicionada
} from '@mui/material';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import CompassCalibrationIcon from '@mui/icons-material/CompassCalibration';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AndroidIcon from '@mui/icons-material/Android';
import AppleIcon from '@mui/icons-material/Apple';
import LaptopIcon from '@mui/icons-material/Laptop';
import ScreenRotationIcon from '@mui/icons-material/ScreenRotation';
import InfoIcon from '@mui/icons-material/Info';

interface PermissionRequestProps {
  cameraPermission: boolean | null;
  locationPermission: boolean | null;
  cameraError: string | null;
  locationError: string | null;
  orientationError: string | null;
  onRequestPermissions: () => void;
}

// Detecta o sistema operacional do dispositivo
const getDeviceOS = (): 'iOS' | 'Android' | 'Desktop' | 'Unknown' => {
  const userAgent = navigator.userAgent.toLowerCase();

  if (/iphone|ipad|ipod/.test(userAgent)) {
    return 'iOS';
  } else if (/android/.test(userAgent)) {
    return 'Android';
  } else if (/windows|macintosh|linux/.test(userAgent)) {
    return 'Desktop';
  }

  return 'Unknown';
};

// Detecta o navegador usado
const getBrowser = (): 'Chrome' | 'Safari' | 'Firefox' | 'Edge' | 'Other' => {
  const userAgent = navigator.userAgent.toLowerCase();

  if (userAgent.indexOf('chrome') > -1 && userAgent.indexOf('edg') === -1) {
    return 'Chrome';
  } else if (
    userAgent.indexOf('safari') > -1 &&
    userAgent.indexOf('chrome') === -1
  ) {
    return 'Safari';
  } else if (userAgent.indexOf('firefox') > -1) {
    return 'Firefox';
  } else if (userAgent.indexOf('edg') > -1) {
    return 'Edge';
  }

  return 'Other';
};

/**
 * Componente que solicita permissões necessárias para o AR funcionar
 * Com instruções personalizadas para diferentes dispositivos e navegadores
 */
const PermissionRequest: React.FC<PermissionRequestProps> = ({
  cameraPermission,
  locationPermission,
  cameraError,
  locationError,
  orientationError,
  onRequestPermissions,
}) => {
  const theme = useTheme();
  const [showInstructions, setShowInstructions] = useState(false);
  const [deviceOS, setDeviceOS] = useState<
    'iOS' | 'Android' | 'Desktop' | 'Unknown'
  >('Unknown');
  const [browser, setBrowser] = useState<
    'Chrome' | 'Safari' | 'Firefox' | 'Edge' | 'Other'
  >('Other');
  const [activeStep, setActiveStep] = useState(0);

  // Detecta dispositivo e navegador ao montar o componente
  useEffect(() => {
    setDeviceOS(getDeviceOS());
    setBrowser(getBrowser());
  }, []);

  // Calcula o progresso das permissões
  const permissionProgress = useMemo(() => {
    let progress = 0;
    if (cameraPermission === true) progress += 50;
    if (locationPermission === true) progress += 50;
    return progress;
  }, [cameraPermission, locationPermission]);

  // Determina qual ícone exibir para o dispositivo
  const getDeviceIcon = () => {
    switch (deviceOS) {
      case 'iOS':
        return <AppleIcon />;
      case 'Android':
        return <AndroidIcon />;
      case 'Desktop':
        return <LaptopIcon />;
      default:
        return <InfoIcon />;
    }
  };

  // Retorna instruções específicas para cada combinação de dispositivo/navegador
  const getSpecificInstructions = () => {
    // iOS com Safari
    if (deviceOS === 'iOS' && browser === 'Safari') {
      return (
        <Box>
          <Typography variant="subtitle2" gutterBottom>
            No iPhone ou iPad com Safari:
          </Typography>
          <Stepper activeStep={activeStep} orientation="vertical">
            <Step>
              <StepLabel>Permitir Acesso à Câmera</StepLabel>
              <StepContent>
                <Typography variant="body2">
                  Quando solicitado, toque em "Permitir" para dar acesso à
                  câmera. Se já negou, vá em Configurações &gt; Safari &gt;
                  Câmera e selecione "Permitir".
                </Typography>
                <Box sx={{ mb: 2, mt: 1 }}>
                  <Button
                    variant="contained"
                    size="small"
                    onClick={() => setActiveStep(1)}
                    sx={{ mt: 1, mr: 1 }}
                  >
                    Próximo
                  </Button>
                </Box>
              </StepContent>
            </Step>
            <Step>
              <StepLabel>Permitir Acesso à Localização</StepLabel>
              <StepContent>
                <Typography variant="body2">
                  Toque em "Permitir" quando solicitado para localização. Caso
                  já tenha negado, acesse Configurações &gt; Privacidade &gt;
                  Serviços de Localização &gt; Safari.
                </Typography>
                <Box sx={{ mb: 2, mt: 1 }}>
                  <Button
                    variant="contained"
                    size="small"
                    onClick={() => setActiveStep(2)}
                    sx={{ mt: 1, mr: 1 }}
                  >
                    Próximo
                  </Button>
                  <Button
                    onClick={() => setActiveStep(0)}
                    sx={{ mt: 1, mr: 1 }}
                  >
                    Voltar
                  </Button>
                </Box>
              </StepContent>
            </Step>
            <Step>
              <StepLabel>Calibrar Sensores</StepLabel>
              <StepContent>
                <Typography variant="body2">
                  Para calibrar a bússola do dispositivo, mova o iPhone fazendo
                  um "8" no ar até que a orientação apareça corretamente.
                </Typography>
                <Box sx={{ mt: 1 }}>
                  <Button
                    onClick={() => setActiveStep(1)}
                    sx={{ mt: 1, mr: 1 }}
                  >
                    Voltar
                  </Button>
                </Box>
              </StepContent>
            </Step>
          </Stepper>
        </Box>
      );
    }

    // Android com Chrome
    else if (deviceOS === 'Android' && browser === 'Chrome') {
      return (
        <Box>
          <Typography variant="subtitle2" gutterBottom>
            No Android com Chrome:
          </Typography>
          <Stepper activeStep={activeStep} orientation="vertical">
            <Step>
              <StepLabel>Permitir Acesso à Câmera e Localização</StepLabel>
              <StepContent>
                <Typography variant="body2">
                  Quando aparecer a notificação, toque em "Permitir" para câmera
                  e localização. Se já negou anteriormente, toque no ícone de
                  cadeado na barra de endereço e ative as permissões.
                </Typography>
                <Box sx={{ mb: 2, mt: 1 }}>
                  <Button
                    variant="contained"
                    size="small"
                    onClick={() => setActiveStep(1)}
                    sx={{ mt: 1, mr: 1 }}
                  >
                    Próximo
                  </Button>
                </Box>
              </StepContent>
            </Step>
            <Step>
              <StepLabel>Configurações do Sistema</StepLabel>
              <StepContent>
                <Typography variant="body2">
                  Se continuar com problemas, vá para Configurações &gt; Apps
                  &gt; Chrome &gt; Permissões e ative a Câmera e Localização.
                </Typography>
                <Box sx={{ mb: 2, mt: 1 }}>
                  <Button
                    variant="contained"
                    size="small"
                    onClick={() => setActiveStep(2)}
                    sx={{ mt: 1, mr: 1 }}
                  >
                    Próximo
                  </Button>
                  <Button
                    onClick={() => setActiveStep(0)}
                    sx={{ mt: 1, mr: 1 }}
                  >
                    Voltar
                  </Button>
                </Box>
              </StepContent>
            </Step>
            <Step>
              <StepLabel>Calibrar Sensores</StepLabel>
              <StepContent>
                <Typography variant="body2">
                  Para calibrar a bússola, mova o telefone em formato de "8" no
                  ar. Verifique se o GPS está ativado nas configurações rápidas
                  (arraste para baixo na tela).
                </Typography>
                <Box sx={{ mt: 1 }}>
                  <Button
                    onClick={() => setActiveStep(1)}
                    sx={{ mt: 1, mr: 1 }}
                  >
                    Voltar
                  </Button>
                </Box>
              </StepContent>
            </Step>
          </Stepper>
        </Box>
      );
    }

    // Desktop (qualquer navegador)
    else if (deviceOS === 'Desktop') {
      return (
        <Box>
          <Typography variant="subtitle2" gutterBottom>
            No {browser} em Desktop:
          </Typography>
          <Alert severity="info" sx={{ mb: 2 }}>
            Em computadores, a experiência AR pode ser limitada devido à falta
            de sensores. A câmera e localização são essenciais.
          </Alert>
          <ol>
            <Typography component="li" variant="body2" sx={{ mb: 1 }}>
              Clique no ícone de cadeado ou site na barra de endereços
            </Typography>
            <Typography component="li" variant="body2" sx={{ mb: 1 }}>
              Verifique as permissões de Câmera e Localização
            </Typography>
            <Typography component="li" variant="body2">
              Selecione "Permitir" para cada uma delas
            </Typography>
          </ol>
          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle2" color="primary">
            Dica: Para uma experiência completa, recomendamos usar um
            dispositivo móvel.
          </Typography>
        </Box>
      );
    }

    // Instruções genéricas para outros casos
    else {
      return (
        <Box>
          <Typography variant="subtitle2" gutterBottom>
            Instruções gerais:
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" fontWeight="medium">
                  Para Câmera e Localização:
                </Typography>
                <ul>
                  <Typography component="li" variant="body2">
                    Em iOS: Configurações &gt; Privacidade &gt;
                    Câmera/Localização
                  </Typography>
                  <Typography component="li" variant="body2">
                    Em Android: Configurações &gt; Apps &gt; Este App &gt;
                    Permissões
                  </Typography>
                  <Typography component="li" variant="body2">
                    No Desktop: Clique no ícone de cadeado na barra de endereço
                  </Typography>
                </ul>
              </Box>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Box>
                <Typography variant="body2" fontWeight="medium">
                  Para Sensores de Orientação:
                </Typography>
                <ul>
                  <Typography component="li" variant="body2">
                    Certifique-se de que seu dispositivo tenha
                    bússola/magnetômetro
                  </Typography>
                  <Typography component="li" variant="body2">
                    Calibre sua bússola movendo o telefone em forma de 8 no ar
                  </Typography>
                  <Typography component="li" variant="body2">
                    Em alguns navegadores, os sensores funcionam apenas via
                    HTTPS
                  </Typography>
                </ul>
              </Box>
            </Grid>
          </Grid>
        </Box>
      );
    }
  };

  return (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 2,
        bgcolor: 'background.default',
      }}
    >
      <Paper
        elevation={4}
        sx={{
          padding: 3,
          maxWidth: 500,
          width: '100%',
          borderRadius: theme.shape.borderRadius * 1.5,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <ScreenRotationIcon color="primary" sx={{ mr: 1, fontSize: 32 }} />
          <Typography variant="h5" fontWeight="medium">
            Permissões Necessárias
          </Typography>
        </Box>

        <Typography variant="body2" sx={{ mb: 3 }}>
          Este aplicativo precisa de acesso à sua câmera, localização e sensores
          de orientação para mostrar pontos de interesse em realidade aumentada.
        </Typography>

        <LinearProgress
          variant="determinate"
          value={permissionProgress}
          sx={{ mb: 3, height: 8, borderRadius: 4 }}
        />

        <Box sx={{ mb: 3 }}>
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  mb: 1,
                  p: 1,
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1,
                  bgcolor: 'background.paper',
                }}
              >
                <CameraAltIcon
                  color={
                    cameraPermission === false
                      ? 'error'
                      : cameraPermission === true
                        ? 'success'
                        : 'primary'
                  }
                  sx={{ mr: 1 }}
                />
                <Box>
                  <Typography variant="body2" fontWeight="bold">
                    Câmera
                  </Typography>
                  {/* Corrigido: condicionais para icon prop no Chip */}
                  {cameraPermission === true ? (
                    <Chip
                      label="Permitido"
                      size="small"
                      color="success"
                      icon={<CheckCircleIcon />}
                      sx={{ mt: 0.5 }}
                    />
                  ) : (
                    <Chip
                      label={cameraPermission === false ? 'Negado' : 'Pendente'}
                      size="small"
                      color={cameraPermission === false ? 'error' : 'default'}
                      sx={{ mt: 0.5 }}
                    />
                  )}
                </Box>
              </Box>
            </Grid>

            <Grid item xs={6}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  mb: 1,
                  p: 1,
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1,
                  bgcolor: 'background.paper',
                }}
              >
                <LocationOnIcon
                  color={
                    locationPermission === false
                      ? 'error'
                      : locationPermission === true
                        ? 'success'
                        : 'primary'
                  }
                  sx={{ mr: 1 }}
                />
                <Box>
                  <Typography variant="body2" fontWeight="bold">
                    Localização
                  </Typography>
                  {/* Corrigido: condicionais para icon prop no Chip */}
                  {locationPermission === true ? (
                    <Chip
                      label="Permitido"
                      size="small"
                      color="success"
                      icon={<CheckCircleIcon />}
                      sx={{ mt: 0.5 }}
                    />
                  ) : (
                    <Chip
                      label={
                        locationPermission === false ? 'Negado' : 'Pendente'
                      }
                      size="small"
                      color={locationPermission === false ? 'error' : 'default'}
                      sx={{ mt: 0.5 }}
                    />
                  )}
                </Box>
              </Box>
            </Grid>

            <Grid item xs={12}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  p: 1,
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1,
                  bgcolor: 'background.paper',
                }}
              >
                <CompassCalibrationIcon
                  color={orientationError ? 'error' : 'primary'}
                  sx={{ mr: 1 }}
                />
                <Box sx={{ flexGrow: 1 }}>
                  <Typography variant="body2" fontWeight="bold">
                    Sensores de Orientação
                  </Typography>
                  <Chip
                    label={
                      orientationError ? 'Problema Detectado' : 'Necessários'
                    }
                    size="small"
                    color={orientationError ? 'warning' : 'default'}
                    sx={{ mt: 0.5 }}
                  />
                </Box>
                {getDeviceIcon()}
              </Box>
            </Grid>
          </Grid>
        </Box>

        {(cameraError || locationError || orientationError) && (
          <Alert
            severity="warning"
            sx={{
              mb: 3,
              borderRadius: theme.shape.borderRadius * 1.5,
            }}
          >
            <Typography variant="body2" fontWeight="medium">
              Problemas detectados:
            </Typography>
            {cameraError && (
              <Typography variant="body2">• {cameraError}</Typography>
            )}
            {locationError && (
              <Typography variant="body2">• {locationError}</Typography>
            )}
            {orientationError && (
              <Typography variant="body2">• {orientationError}</Typography>
            )}
          </Alert>
        )}

        <Button
          variant="contained"
          onClick={onRequestPermissions}
          startIcon={<CameraAltIcon />}
          fullWidth
          size="large"
          sx={{
            mb: 2,
            borderRadius: theme.shape.borderRadius * 1.5,
            py: 1.2,
            fontSize: '1rem',
            boxShadow: theme.shadows[4],
            transition: 'transform 0.2s, box-shadow 0.2s',
            '&:hover': {
              transform: 'translateY(-2px)',
              boxShadow: theme.shadows[8],
            },
          }}
        >
          Permitir Acesso
        </Button>

        <Box sx={{ textAlign: 'center' }}>
          <Button
            startIcon={
              showInstructions ? <ExpandMoreIcon /> : <HelpOutlineIcon />
            }
            onClick={() => setShowInstructions(!showInstructions)}
            size="small"
            sx={{ textTransform: 'none' }}
          >
            {showInstructions ? 'Esconder Instruções' : 'Precisa de Ajuda?'}
          </Button>
        </Box>

        <Collapse in={showInstructions}>
          <Box
            sx={{
              mt: 2,
              pt: 2,
              borderTop: '1px solid rgba(255,255,255,0.1)',
              bgcolor: alpha(theme.palette.background.paper, 0.3),
              borderRadius: theme.shape.borderRadius,
              p: 2,
            }}
          >
            {getSpecificInstructions()}

            <Typography
              variant="body2"
              sx={{
                mt: 2,
                fontStyle: 'italic',
                textAlign: 'center',
                color: theme.palette.primary.main,
                fontWeight: 'medium',
              }}
            >
              Após ajustar as permissões, recarregue a página ou toque no botão
              acima
            </Typography>
          </Box>
        </Collapse>
      </Paper>
    </Box>
  );
};

export default PermissionRequest;
