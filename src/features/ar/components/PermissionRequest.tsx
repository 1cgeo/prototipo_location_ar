// Path: features\ar\components\PermissionRequest.tsx
import React from 'react';
import {
  Box,
  Button,
  Typography,
  Paper,
  Alert,
  useTheme,
  Stack,
} from '@mui/material';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import ExploreIcon from '@mui/icons-material/Explore';

interface PermissionRequestProps {
  cameraPermission: boolean | null;
  locationPermission: boolean | null;
  orientationPermission?: boolean | null;
  cameraError: string | null;
  locationError: string | null;
  onRequestPermissions: () => void;
}

const PermissionRequest: React.FC<PermissionRequestProps> = ({
  cameraPermission,
  locationPermission,
  orientationPermission = null,
  cameraError,
  locationError,
  onRequestPermissions,
}) => {
  const theme = useTheme();

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
          This AR application needs access to your camera, location, and device
          orientation to show points of interest in augmented reality.
        </Typography>

        {/* Permission status */}
        <Stack spacing={2} sx={{ mb: 3 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              p: 1.5,
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
              bgcolor: 'background.paper',
              width: '100%',
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
            <Typography variant="body2" fontWeight="bold">
              Camera:{' '}
              {cameraPermission === true
                ? 'Allowed'
                : cameraPermission === false
                  ? 'Denied'
                  : 'Required'}
            </Typography>
          </Box>

          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              p: 1.5,
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
              bgcolor: 'background.paper',
              width: '100%',
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
            <Typography variant="body2" fontWeight="bold">
              Location:{' '}
              {locationPermission === true
                ? 'Allowed'
                : locationPermission === false
                  ? 'Denied'
                  : 'Required'}
            </Typography>
          </Box>

          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              p: 1.5,
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
              bgcolor: 'background.paper',
              width: '100%',
            }}
          >
            <ExploreIcon
              color={
                orientationPermission === false
                  ? 'error'
                  : orientationPermission === true
                    ? 'success'
                    : 'primary'
              }
              sx={{ mr: 1 }}
            />
            <Typography variant="body2" fontWeight="bold">
              Orientation/Compass:{' '}
              {orientationPermission === true
                ? 'Allowed'
                : orientationPermission === false
                  ? 'Denied'
                  : 'Required'}
            </Typography>
          </Box>
        </Stack>

        {/* Error messages */}
        {(cameraError || locationError) && (
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
          </Alert>
        )}

        {/* iOS note */}
        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="body2">
            On iOS devices, you may need to approve multiple permission
            requests. For best experience, please allow access to all requested
            features.
          </Typography>
        </Alert>

        {/* Permission request button */}
        <Button
          variant="contained"
          onClick={onRequestPermissions}
          startIcon={<CameraAltIcon />}
          fullWidth
          size="large"
          sx={{
            mb: 2,
            py: 1.2,
            fontSize: '1rem',
          }}
        >
          Allow Access
        </Button>
      </Paper>
    </Box>
  );
};

export default PermissionRequest;
