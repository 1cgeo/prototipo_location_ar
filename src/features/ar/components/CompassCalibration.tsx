// Path: features\ar\components\CompassCalibration.tsx
import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Button, 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions,
  CircularProgress,
  useTheme,
  alpha
} from '@mui/material';
import ExploreIcon from '@mui/icons-material/Explore';
import RotateLeftIcon from '@mui/icons-material/RotateLeft';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import { useARStore } from '../stores/arStore';

interface CompassCalibrationProps {
  onCalibrationComplete?: () => void;
}

/**
 * Componente para calibração da bússola do dispositivo
 */
const CompassCalibration: React.FC<CompassCalibrationProps> = ({ 
  onCalibrationComplete 
}) => {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [calibrating, setCalibrating] = useState(false);
  const [calibrationProgress, setCalibrationProgress] = useState(0);
  const [headingReadings, setHeadingReadings] = useState<number[]>([]);
  const [calibrationQuality, setCalibrationQuality] = useState<'low' | 'medium' | 'high' | null>(null);
  const { heading, setCompassCalibrated } = useARStore();

  // Abre o diálogo de calibração
  const handleOpenCalibration = () => {
    setOpen(true);
    setCalibrating(false);
    setCalibrationProgress(0);
    setHeadingReadings([]);
    setCalibrationQuality(null);
  };

  // Fecha o diálogo de calibração
  const handleCloseCalibration = () => {
    setOpen(false);
    setCalibrating(false);
  };

  // Inicia o processo de calibração
  const startCalibration = () => {
    setCalibrating(true);
    setCalibrationProgress(0);
    setHeadingReadings([]);
    
    // Cria temporizador para simular progresso de calibração
    // Na prática, estamos apenas coletando leituras por um período
    const startTime = Date.now();
    const calibrationDuration = 15000; // 15 segundos
    
    const progressInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(100, (elapsed / calibrationDuration) * 100);
      setCalibrationProgress(progress);
      
      if (progress >= 100) {
        clearInterval(progressInterval);
        finishCalibration();
      }
    }, 100);
    
    // Armazena o intervalo para limpeza posterior
    return () => clearInterval(progressInterval);
  };

  // Finaliza o processo de calibração
  const finishCalibration = () => {
    setCalibrating(false);
    
    // Analisa as leituras para determinar a qualidade da calibração
    if (headingReadings.length < 10) {
      setCalibrationQuality('low');
    } else {
      // Calcula a variância das leituras para determinar a qualidade
      const avgHeading = headingReadings.reduce((sum, val) => sum + val, 0) / headingReadings.length;
      const variance = headingReadings.reduce((sum, val) => sum + Math.pow(val - avgHeading, 2), 0) / headingReadings.length;
      
      if (variance > 1000) {
        // Alta variância = rotacionou bastante = boa calibração
        setCalibrationQuality('high');
        setCompassCalibrated(true);
      } else if (variance > 500) {
        setCalibrationQuality('medium');
        setCompassCalibrated(true);
      } else {
        setCalibrationQuality('low');
        setCompassCalibrated(false);
      }
    }
    
    // Callback para o componente pai
    if (onCalibrationComplete) {
      onCalibrationComplete();
    }
  };

  // Coleta leituras da bússola durante a calibração
  useEffect(() => {
    if (calibrating && heading !== null) {
      setHeadingReadings(prev => [...prev, heading]);
    }
  }, [calibrating, heading]);

  // Botão para iniciar calibração
  const renderCalibrationButton = () => (
    <Button
      variant="outlined"
      color="primary"
      onClick={handleOpenCalibration}
      startIcon={<ExploreIcon />}
      size="small"
      sx={{
        borderRadius: 2,
        backdropFilter: 'blur(4px)',
        backgroundColor: alpha(theme.palette.background.paper, 0.7),
        '&:hover': {
          backgroundColor: alpha(theme.palette.background.paper, 0.9),
        }
      }}
    >
      Calibrar Bússola
    </Button>
  );

  return (
    <>
      {renderCalibrationButton()}
      
      <Dialog 
        open={open} 
        onClose={handleCloseCalibration}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Calibração da Bússola
        </DialogTitle>
        
        <DialogContent>
          {!calibrating && calibrationQuality === null && (
            <Box sx={{ textAlign: 'center', py: 2 }}>
              <ExploreIcon sx={{ fontSize: 60, color: 'primary.main', mb: 2 }} />
              
              <Typography variant="body1" paragraph>
                Para melhorar a precisão da bússola, você precisa calibrá-la. 
              </Typography>
              
              <Typography variant="body2" paragraph>
                Durante a calibração, gire o dispositivo fazendo o movimento de "8" no ar. 
                Tente virar o dispositivo em todas as direções.
              </Typography>
              
              <Box 
                component="img" 
                src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNDAgMTYwIj48cGF0aCBkPSJNNDAgODBjMC0yMiAxOC00MCA0MC00MHM0MCAxOCA0MCA0MC0xOCA0MC00MCA0MFM0MCAxMDIgNDAgODB6TTEyMCA4MGMwIDIyIDE4IDQwIDQwIDQwczQwLTE4IDQwLTQwLTE4LTQwLTQwLTQwLTQwIDE4LTQwIDQweiIgZmlsbD0ibm9uZSIgc3Ryb2tlPSIjMDA3N0NDIiBzdHJva2Utd2lkdGg9IjMiLz48cGF0aCBkPSJNMTAwIDgwYzAtMTEgOS0yMCAyMC0yMHMyMCA5IDIwIDIwLTkgMjAtMjAgMjAtMjAtOS0yMC0yMHoiIGZpbGw9IiMwMDc3Q0MiLz48cGF0aCBkPSJNMTYwIDgwYzAgMCAxMC0yMCAyMC0yME0yMCAyMGw0MCAyME0xODAgMTIwbDQwIDIwIiBzdHJva2U9IiMwMDc3Q0MiIHN0cm9rZS13aWR0aD0iMyIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBmaWxsPSJub25lIi8+PC9zdmc+" 
                alt="Calibration motion instructions"
                sx={{ 
                  maxWidth: '100%', 
                  height: 'auto',
                  maxHeight: 180,
                  mx: 'auto',
                  mb: 2
                }}
              />
            </Box>
          )}
          
          {calibrating && (
            <Box sx={{ textAlign: 'center', py: 3 }}>
              <Box sx={{ position: 'relative', display: 'inline-block', mb: 2 }}>
                <CircularProgress 
                  variant="determinate" 
                  value={calibrationProgress} 
                  size={100}
                  thickness={4}
                />
                <Typography 
                  variant="body2"
                  sx={{ 
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                  }}
                >
                  {Math.round(calibrationProgress)}%
                </Typography>
              </Box>
              
              <Typography variant="h6" sx={{ mb: 1 }}>
                Gire o dispositivo...
              </Typography>
              
              <Typography variant="body2" color="text.secondary">
                Faça movimentos amplos em formato de "8" com seu dispositivo.
                <br />Coletando leituras: {headingReadings.length}
              </Typography>
              
              <Box sx={{ mt: 3, animation: 'pulse 2s infinite' }}>
                <RotateLeftIcon sx={{ fontSize: 40, color: 'primary.main' }} />
              </Box>
            </Box>
          )}
          
          {!calibrating && calibrationQuality !== null && (
            <Box sx={{ textAlign: 'center', py: 2 }}>
              {calibrationQuality === 'high' && (
                <>
                  <CheckCircleIcon sx={{ fontSize: 60, color: 'success.main', mb: 2 }} />
                  <Typography variant="h6" sx={{ color: 'success.main', mb: 2 }}>
                    Calibração excelente!
                  </Typography>
                  <Typography variant="body2">
                    A bússola foi calibrada com sucesso e deve fornecer leituras precisas.
                  </Typography>
                </>
              )}
              
              {calibrationQuality === 'medium' && (
                <>
                  <CheckCircleIcon sx={{ fontSize: 60, color: 'info.main', mb: 2 }} />
                  <Typography variant="h6" sx={{ color: 'info.main', mb: 2 }}>
                    Calibração moderada
                  </Typography>
                  <Typography variant="body2">
                    A bússola foi calibrada, mas pode não ser totalmente precisa.
                    Considere recalibrar caso note problemas de direção.
                  </Typography>
                </>
              )}
              
              {calibrationQuality === 'low' && (
                <>
                  <WarningIcon sx={{ fontSize: 60, color: 'warning.main', mb: 2 }} />
                  <Typography variant="h6" sx={{ color: 'warning.main', mb: 2 }}>
                    Calibração incompleta
                  </Typography>
                  <Typography variant="body2">
                    A calibração não foi suficiente. Tente girar o dispositivo mais 
                    amplamente em todas as direções durante a calibração.
                  </Typography>
                </>
              )}
            </Box>
          )}
        </DialogContent>
        
        <DialogActions sx={{ px: 3, pb: 3 }}>
          {!calibrating && calibrationQuality === null && (
            <>
              <Button onClick={handleCloseCalibration}>Cancelar</Button>
              <Button 
                variant="contained" 
                onClick={startCalibration} 
                startIcon={<ExploreIcon />}
              >
                Iniciar Calibração
              </Button>
            </>
          )}
          
          {calibrating && (
            <Button onClick={() => finishCalibration()}>Cancelar</Button>
          )}
          
          {!calibrating && calibrationQuality !== null && (
            <>
              <Button 
                onClick={handleCloseCalibration}
                color={calibrationQuality === 'low' ? 'warning' : 'primary'}
              >
                Fechar
              </Button>
              
              {calibrationQuality === 'low' && (
                <Button 
                  variant="contained" 
                  onClick={startCalibration}
                >
                  Tentar Novamente
                </Button>
              )}
            </>
          )}
        </DialogActions>
      </Dialog>
    </>
  );
};

export default CompassCalibration;