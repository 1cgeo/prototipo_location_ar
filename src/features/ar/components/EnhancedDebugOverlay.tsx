// Path: features\ar\components\EnhancedDebugOverlay.tsx
import React, { useCallback, useMemo, useState } from 'react';
import { Box, Button, IconButton, Badge, Tooltip } from '@mui/material';
import BugReportIcon from '@mui/icons-material/BugReport';
import CameraIcon from '@mui/icons-material/Camera';
import LocationOnIcon from '@mui/icons-material/LocationOn';

import { useCameraStore } from '../stores/cameraStore';
import { useLocationStore } from '../stores/locationStore';
import DebugPanel from './DebugPanel';

interface EnhancedDebugOverlayProps {
  onForceReload: () => void;
  onCameraRetry: () => void;
  onToggleDebugMode: (value: boolean) => void;
  onEnableOverrideMode: () => void;
  isActive: boolean;
  forceOverrideMode: boolean;
  startupDuration: number;
  useFallbackHeading: boolean;
}

// Define type for icon colors
type MuiIconColor =
  | 'inherit'
  | 'primary'
  | 'secondary'
  | 'success'
  | 'error'
  | 'info'
  | 'warning'
  | 'disabled'
  | 'action';
// Define type for chip/status colors
type StatusColor = 'success' | 'error' | 'warning' | 'info' | 'default';

/**
 * Enhanced debugging overlay with collapsible panels and detailed information
 */
const EnhancedDebugOverlay: React.FC<EnhancedDebugOverlayProps> = ({
  onForceReload,
  onCameraRetry,
  onToggleDebugMode,
  onEnableOverrideMode,
  isActive,
  forceOverrideMode,
  startupDuration,
  useFallbackHeading,
}) => {
  const [showMainDebug, setShowMainDebug] = useState(false);
  const [showCameraDebug, setShowCameraDebug] = useState(false);
  const [showLocationDebug, setShowLocationDebug] = useState(false);

  // Get store values
  const {
    logs,
    hasPermission: cameraPermission,
    error: cameraError,
  } = useCameraStore();
  const { coordinates, heading } = useLocationStore();

  // Count warning and error logs
  const errorCount = useMemo(() => {
    return logs.filter(log => log.type === 'error' || log.type === 'warn')
      .length;
  }, [logs]);

  // Calculate status colors
  const getCameraStatusColor = useCallback((): MuiIconColor => {
    if (forceOverrideMode) return 'warning';
    if (cameraError) return 'error';
    if (isActive) return 'success';
    return 'disabled';
  }, [cameraError, forceOverrideMode, isActive]);

  const getLocationStatusColor = useCallback((): MuiIconColor => {
    if (!coordinates.latitude) return 'error';
    if (coordinates.accuracy && coordinates.accuracy > 100) return 'warning';
    return 'success';
  }, [coordinates.accuracy, coordinates.latitude]);

  const getHeadingStatusColor = useCallback((): MuiIconColor => {
    if (heading === null) return 'error';
    if (useFallbackHeading) return 'warning';
    return 'success';
  }, [heading, useFallbackHeading]);

  // Convert MUI icon color to status color
  const mapToStatusColor = (color: MuiIconColor): StatusColor => {
    switch (color) {
      case 'success':
        return 'success';
      case 'error':
        return 'error';
      case 'warning':
        return 'warning';
      case 'info':
        return 'info';
      default:
        return 'default';
    }
  };

  // Main debug panel status items with explicit types
  const mainStatusItems = useMemo(() => {
    return [
      {
        label: 'Camera',
        value: forceOverrideMode
          ? 'Override'
          : isActive
            ? 'Active'
            : 'Inactive',
        color: mapToStatusColor(getCameraStatusColor()) as StatusColor,
      },
      {
        label: 'Location',
        value: coordinates.latitude
          ? `${coordinates.latitude.toFixed(6)}, ${coordinates.longitude?.toFixed(6)}`
          : 'Unavailable',
        color: mapToStatusColor(getLocationStatusColor()) as StatusColor,
      },
      {
        label: 'Heading',
        value: heading !== null ? `${heading.toFixed(1)}°` : 'Unavailable',
        color: mapToStatusColor(getHeadingStatusColor()) as StatusColor,
      },
      {
        label: 'Orientation',
        value: useFallbackHeading ? 'Fallback Mode' : 'Device Sensors',
        color: (useFallbackHeading ? 'warning' : 'success') as StatusColor,
      },
      {
        label: 'Camera Permission',
        value:
          cameraPermission === null
            ? 'Unknown'
            : cameraPermission
              ? 'Granted'
              : 'Denied',
        color: (cameraPermission === true
          ? 'success'
          : cameraPermission === false
            ? 'error'
            : 'default') as StatusColor,
      },
      {
        label: 'Startup Time',
        value: `${startupDuration}s`,
        color: (startupDuration > 10
          ? 'error'
          : startupDuration > 5
            ? 'warning'
            : 'success') as StatusColor,
      },
    ];
  }, [
    forceOverrideMode,
    isActive,
    coordinates,
    heading,
    useFallbackHeading,
    cameraPermission,
    startupDuration,
    getCameraStatusColor,
    getLocationStatusColor,
    getHeadingStatusColor,
  ]);

  // Main debug panel actions
  const mainActions = useMemo(
    () => [
      {
        label: 'Full Debug',
        onClick: () => onToggleDebugMode(true),
        color: 'primary' as const,
      },
      {
        label: 'Retry Camera',
        onClick: onCameraRetry,
        color: 'info' as const,
      },
      {
        label: 'Force Reload',
        onClick: onForceReload,
        color: 'warning' as const,
      },
      {
        label: 'Override Mode',
        onClick: onEnableOverrideMode,
        color: 'success' as const,
      },
    ],
    [onCameraRetry, onEnableOverrideMode, onForceReload, onToggleDebugMode],
  );

  // Camera details status items with explicit types
  const cameraStatusItems = useMemo(() => {
    return [
      {
        label: 'Active',
        value: isActive ? 'Yes' : 'No',
        color: (isActive ? 'success' : 'error') as StatusColor,
      },
      {
        label: 'Override',
        value: forceOverrideMode ? 'Enabled' : 'Disabled',
        color: (forceOverrideMode ? 'warning' : 'default') as StatusColor,
      },
      {
        label: 'Permission',
        value:
          cameraPermission === null
            ? 'Unknown'
            : cameraPermission
              ? 'Granted'
              : 'Denied',
        color: (cameraPermission === true
          ? 'success'
          : cameraPermission === false
            ? 'error'
            : 'default') as StatusColor,
      },
      {
        label: 'Error',
        value: cameraError || 'None',
        color: (cameraError ? 'error' : 'success') as StatusColor,
      },
      {
        label: 'Startup Duration',
        value: `${startupDuration}s`,
        color: (startupDuration > 10
          ? 'error'
          : startupDuration > 5
            ? 'warning'
            : 'success') as StatusColor,
      },
    ];
  }, [
    cameraError,
    cameraPermission,
    forceOverrideMode,
    isActive,
    startupDuration,
  ]);

  // Location details status items with explicit types
  const locationStatusItems = useMemo(() => {
    return [
      {
        label: 'Latitude',
        value: coordinates.latitude?.toFixed(6) || 'N/A',
      },
      {
        label: 'Longitude',
        value: coordinates.longitude?.toFixed(6) || 'N/A',
      },
      {
        label: 'Accuracy',
        value: coordinates.accuracy
          ? `${coordinates.accuracy.toFixed(1)}m`
          : 'N/A',
        color: (!coordinates.accuracy
          ? 'default'
          : coordinates.accuracy > 100
            ? 'error'
            : coordinates.accuracy > 50
              ? 'warning'
              : 'success') as StatusColor,
      },
      {
        label: 'Heading',
        value: heading !== null ? `${heading.toFixed(1)}°` : 'N/A',
        color: (heading !== null
          ? useFallbackHeading
            ? 'warning'
            : 'success'
          : 'error') as StatusColor,
      },
      {
        label: 'Fallback Mode',
        value: useFallbackHeading ? 'Enabled' : 'Disabled',
        color: (useFallbackHeading ? 'warning' : 'success') as StatusColor,
      },
    ];
  }, [
    coordinates.accuracy,
    coordinates.latitude,
    coordinates.longitude,
    heading,
    useFallbackHeading,
  ]);

  return (
    <>
      {/* Quick access buttons */}
      <Box
        sx={{
          position: 'absolute',
          top: 16,
          right: 16,
          zIndex: 1200,
          display: 'flex',
          gap: 1,
        }}
      >
        <Tooltip title="Camera Debug">
          <IconButton
            color="inherit"
            sx={{
              bgcolor: 'rgba(0,0,0,0.3)',
              '&:hover': { bgcolor: 'rgba(0,0,0,0.5)' },
            }}
            onClick={() => setShowCameraDebug(!showCameraDebug)}
          >
            <CameraIcon color={getCameraStatusColor()} />
          </IconButton>
        </Tooltip>

        <Tooltip title="Location Debug">
          <IconButton
            color="inherit"
            sx={{
              bgcolor: 'rgba(0,0,0,0.3)',
              '&:hover': { bgcolor: 'rgba(0,0,0,0.5)' },
            }}
            onClick={() => setShowLocationDebug(!showLocationDebug)}
          >
            <LocationOnIcon color={getLocationStatusColor()} />
          </IconButton>
        </Tooltip>

        <Tooltip title="Main Debug Panel">
          <IconButton
            color="inherit"
            sx={{
              bgcolor: 'rgba(0,0,0,0.3)',
              '&:hover': { bgcolor: 'rgba(0,0,0,0.5)' },
            }}
            onClick={() => setShowMainDebug(!showMainDebug)}
          >
            <Badge badgeContent={errorCount} color="error" max={99}>
              <BugReportIcon />
            </Badge>
          </IconButton>
        </Tooltip>
      </Box>

      {/* Debug Panels */}
      {showMainDebug && (
        <DebugPanel
          title="AR Debug Information"
          position="topRight"
          initialExpanded={true}
          width={350}
          statusItems={mainStatusItems}
          actions={mainActions}
          onClose={() => setShowMainDebug(false)}
        />
      )}

      {showCameraDebug && (
        <DebugPanel
          title="Camera Details"
          position="bottomLeft"
          initialExpanded={true}
          width={300}
          statusItems={cameraStatusItems}
          actions={[
            {
              label: 'Retry Camera',
              onClick: onCameraRetry,
              color: 'primary',
            },
            {
              label: forceOverrideMode ? 'Disable Override' : 'Enable Override',
              onClick: forceOverrideMode
                ? () => window.location.reload()
                : onEnableOverrideMode,
              color: forceOverrideMode ? 'warning' : 'success',
            },
          ]}
          showLogs={false}
          onClose={() => setShowCameraDebug(false)}
        />
      )}

      {showLocationDebug && (
        <DebugPanel
          title="Location Details"
          position="bottomRight"
          initialExpanded={true}
          width={300}
          statusItems={locationStatusItems}
          showLogs={false}
          onClose={() => setShowLocationDebug(false)}
        />
      )}

      {/* Footer Debug Button */}
      <Button
        variant="contained"
        size="small"
        onClick={() => onToggleDebugMode(true)}
        startIcon={<BugReportIcon />}
        sx={{
          position: 'absolute',
          bottom: 16,
          right: 16,
          zIndex: 1000,
          opacity: 0.7,
        }}
      >
        Full Debug
      </Button>
    </>
  );
};

export default EnhancedDebugOverlay;
