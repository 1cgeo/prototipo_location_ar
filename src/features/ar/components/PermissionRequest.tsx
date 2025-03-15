// Path: features\ar\components\PermissionRequest.tsx
import React, { useState } from 'react';
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
  Chip,
  LinearProgress,
} from '@mui/material';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import CompassCalibrationIcon from '@mui/icons-material/CompassCalibration';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AppleIcon from '@mui/icons-material/Apple';
import AndroidIcon from '@mui/icons-material/Android';

interface PermissionRequestProps {
  cameraPermission: boolean | null;
  locationPermission: boolean | null;
  cameraError: string | null;
  locationError: string | null;
  orientationError: string | null;
  onRequestPermissions: () => void;
}

/**
 * Simplified component for requesting necessary permissions
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
  const [activeStep, setActiveStep] = useState(0);

  // Detect device OS
  const isIOS = /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase());
  const isAndroid = /android/.test(navigator.userAgent.toLowerCase());

  // Calculate permission progress - we use this directly in the LinearProgress component
  const permissionProgressValue = (() => {
    let progress = 0;
    if (cameraPermission === true) progress += 50;
    if (locationPermission === true) progress += 50;
    return progress;
  })();

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
        <Typography variant="h5" fontWeight="medium" sx={{ mb: 2 }}>
          Permissions Required
        </Typography>

        <Typography variant="body2" sx={{ mb: 3 }}>
          This AR application needs access to your camera, location, and
          orientation sensors to show points of interest in augmented reality.
        </Typography>

        {/* Permission progress bar */}
        <LinearProgress
          variant="determinate"
          value={permissionProgressValue}
          sx={{ mb: 3, height: 8, borderRadius: 4 }}
        />

        {/* Permission status */}
        <Box sx={{ mb: 3, display: 'flex', flexWrap: 'wrap', gap: 2 }}>
          <Box sx={{ flexBasis: '48%', flexGrow: 1 }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                p: 1.5,
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
                  Camera
                </Typography>
                {cameraPermission === true ? (
                  <Chip
                    label="Allowed"
                    size="small"
                    color="success"
                    icon={<CheckCircleIcon />}
                    sx={{ mt: 0.5 }}
                  />
                ) : (
                  <Chip
                    label={cameraPermission === false ? 'Denied' : 'Pending'}
                    size="small"
                    color={cameraPermission === false ? 'error' : 'default'}
                    sx={{ mt: 0.5 }}
                  />
                )}
              </Box>
            </Box>
          </Box>

          <Box sx={{ flexBasis: '48%', flexGrow: 1 }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                p: 1.5,
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
                  Location
                </Typography>
                {locationPermission === true ? (
                  <Chip
                    label="Allowed"
                    size="small"
                    color="success"
                    icon={<CheckCircleIcon />}
                    sx={{ mt: 0.5 }}
                  />
                ) : (
                  <Chip
                    label={locationPermission === false ? 'Denied' : 'Pending'}
                    size="small"
                    color={locationPermission === false ? 'error' : 'default'}
                    sx={{ mt: 0.5 }}
                  />
                )}
              </Box>
            </Box>
          </Box>

          <Box sx={{ width: '100%' }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                p: 1.5,
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
                bgcolor: 'background.paper',
              }}
            >
              <CompassCalibrationIcon
                color={orientationError ? 'warning' : 'primary'}
                sx={{ mr: 1 }}
              />
              <Box sx={{ flexGrow: 1 }}>
                <Typography variant="body2" fontWeight="bold">
                  Orientation Sensors
                </Typography>
                <Chip
                  label={orientationError ? 'Issue Detected' : 'Required'}
                  size="small"
                  color={orientationError ? 'warning' : 'default'}
                  sx={{ mt: 0.5 }}
                />
              </Box>
              {isIOS ? <AppleIcon /> : isAndroid ? <AndroidIcon /> : null}
            </Box>
          </Box>
        </Box>

        {/* Error messages */}
        {(cameraError || locationError || orientationError) && (
          <Alert
            severity="warning"
            sx={{
              mb: 3,
              borderRadius: theme.shape.borderRadius,
            }}
          >
            <Typography variant="body2" fontWeight="medium">
              Problems detected:
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

        {/* Permission request button */}
        <Button
          variant="contained"
          onClick={onRequestPermissions}
          startIcon={<CameraAltIcon />}
          fullWidth
          size="large"
          sx={{
            mb: 2,
            borderRadius: theme.shape.borderRadius,
            py: 1.2,
            fontSize: '1rem',
          }}
        >
          Allow Access
        </Button>

        {/* Help instructions toggle */}
        <Box sx={{ textAlign: 'center' }}>
          <Button
            startIcon={
              showInstructions ? <ExpandMoreIcon /> : <HelpOutlineIcon />
            }
            onClick={() => setShowInstructions(!showInstructions)}
            size="small"
          >
            {showInstructions ? 'Hide Instructions' : 'Need Help?'}
          </Button>
        </Box>

        {/* Collapsible instructions */}
        <Collapse in={showInstructions}>
          <Box
            sx={{
              mt: 2,
              pt: 2,
              borderTop: '1px solid rgba(255,255,255,0.1)',
              bgcolor: 'background.paper',
              borderRadius: theme.shape.borderRadius,
              p: 2,
            }}
          >
            {isIOS ? (
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  On iPhone/iPad:
                </Typography>
                <Stepper activeStep={activeStep} orientation="vertical">
                  <Step>
                    <StepLabel>Allow Camera Access</StepLabel>
                    <StepContent>
                      <Typography variant="body2">
                        When prompted, tap "Allow" to give camera access. If
                        you've previously denied, go to Settings &gt; Safari
                        &gt; Camera and select "Allow".
                      </Typography>
                      <Box sx={{ mt: 1 }}>
                        <Button
                          variant="contained"
                          size="small"
                          onClick={() => setActiveStep(1)}
                          sx={{ mt: 1, mr: 1 }}
                        >
                          Next
                        </Button>
                      </Box>
                    </StepContent>
                  </Step>
                  <Step>
                    <StepLabel>Allow Location Access</StepLabel>
                    <StepContent>
                      <Typography variant="body2">
                        Tap "Allow" when prompted for location. If previously
                        denied, go to Settings &gt; Privacy &gt; Location
                        Services &gt; Safari.
                      </Typography>
                      <Box sx={{ mt: 1 }}>
                        <Button
                          variant="contained"
                          size="small"
                          onClick={() => setActiveStep(2)}
                          sx={{ mt: 1, mr: 1 }}
                        >
                          Next
                        </Button>
                        <Button
                          onClick={() => setActiveStep(0)}
                          sx={{ mt: 1, mr: 1 }}
                        >
                          Back
                        </Button>
                      </Box>
                    </StepContent>
                  </Step>
                  <Step>
                    <StepLabel>Calibrate Sensors</StepLabel>
                    <StepContent>
                      <Typography variant="body2">
                        Move your device in a figure-8 pattern to calibrate the
                        compass.
                      </Typography>
                      <Box sx={{ mt: 1 }}>
                        <Button
                          onClick={() => setActiveStep(1)}
                          sx={{ mt: 1, mr: 1 }}
                        >
                          Back
                        </Button>
                      </Box>
                    </StepContent>
                  </Step>
                </Stepper>
              </Box>
            ) : isAndroid ? (
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  On Android:
                </Typography>
                <Stepper activeStep={activeStep} orientation="vertical">
                  <Step>
                    <StepLabel>Allow Camera and Location</StepLabel>
                    <StepContent>
                      <Typography variant="body2">
                        When prompted, tap "Allow" for camera and location
                        permissions. If previously denied, tap the lock icon in
                        the address bar.
                      </Typography>
                      <Box sx={{ mt: 1 }}>
                        <Button
                          variant="contained"
                          size="small"
                          onClick={() => setActiveStep(1)}
                          sx={{ mt: 1, mr: 1 }}
                        >
                          Next
                        </Button>
                      </Box>
                    </StepContent>
                  </Step>
                  <Step>
                    <StepLabel>System Settings</StepLabel>
                    <StepContent>
                      <Typography variant="body2">
                        If still having issues, go to Settings &gt; Apps &gt;
                        Browser &gt; Permissions and enable Camera and Location.
                      </Typography>
                      <Box sx={{ mt: 1 }}>
                        <Button
                          onClick={() => setActiveStep(0)}
                          sx={{ mt: 1, mr: 1 }}
                        >
                          Back
                        </Button>
                      </Box>
                    </StepContent>
                  </Step>
                </Stepper>
              </Box>
            ) : (
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  General Instructions:
                </Typography>
                <Typography variant="body2" paragraph>
                  1. Click the lock/site icon in your browser's address bar
                </Typography>
                <Typography variant="body2" paragraph>
                  2. Check Camera and Location permissions and set to "Allow"
                </Typography>
                <Typography variant="body2">
                  For best experience, use a mobile device. Desktop browsers may
                  have limited sensor support.
                </Typography>
              </Box>
            )}
          </Box>
        </Collapse>
      </Paper>
    </Box>
  );
};

export default PermissionRequest;
