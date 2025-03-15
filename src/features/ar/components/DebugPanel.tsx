// Path: features\ar\components\DebugPanel.tsx
import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Collapse,
  IconButton,
  Divider,
  Chip,
  Button,
  Stack,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useCameraStore } from '../stores/cameraStore';

interface DebugPanelProps {
  title?: string;
  position?: 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight' | 'center';
  initialExpanded?: boolean;
  width?: string | number;
  statusItems?: Array<{
    label: string;
    value: string | number | boolean | null | undefined;
    color?: 'success' | 'error' | 'warning' | 'info' | 'default';
  }>;
  actions?: Array<{
    label: string;
    color?: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info';
    onClick: () => void;
  }>;
  showLogs?: boolean;
  maxLogEntries?: number;
  onClose?: () => void;
}

/**
 * Reusable debugging panel that can be positioned anywhere in the UI
 */
const DebugPanel: React.FC<DebugPanelProps> = ({
  title = 'Debug Information',
  position = 'bottomRight',
  initialExpanded = false,
  width = 300,
  statusItems = [],
  actions = [],
  showLogs = true,
  maxLogEntries = 20,
  onClose,
}) => {
  const [expanded, setExpanded] = useState(initialExpanded);
  const { logs, clearLogs } = useCameraStore();

  // Get position styles based on the requested position
  const getPositionStyles = () => {
    switch (position) {
      case 'topLeft':
        return { top: 16, left: 16 };
      case 'topRight':
        return { top: 16, right: 16 };
      case 'bottomLeft':
        return { bottom: 16, left: 16 };
      case 'bottomRight':
        return { bottom: 16, right: 16 };
      case 'center':
        return {
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        };
      default:
        return { bottom: 16, right: 16 };
    }
  };

  // Filter logs to most recent entries
  const filteredLogs = logs.slice(0, maxLogEntries);

  return (
    <Paper
      elevation={3}
      sx={{
        position: 'absolute',
        ...getPositionStyles(),
        width,
        maxWidth: '95vw',
        opacity: 0.95,
        zIndex: 1200,
        backdropFilter: 'blur(6px)',
        overflow: 'hidden',
        maxHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: 1,
          bgcolor: 'primary.dark',
          color: 'white',
        }}
      >
        <Typography variant="subtitle2" fontWeight="medium">
          {title}
        </Typography>
        <Box>
          <IconButton
            size="small"
            color="inherit"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
          {onClose && (
            <IconButton
              size="small"
              color="inherit"
              onClick={onClose}
              sx={{ ml: 0.5 }}
            >
              ×
            </IconButton>
          )}
        </Box>
      </Box>

      {/* Collapsible content */}
      <Collapse in={expanded}>
        {/* Status items */}
        {statusItems.length > 0 && (
          <Box sx={{ p: 1.5, maxHeight: '30vh', overflowY: 'auto' }}>
            <Stack spacing={1}>
              {statusItems.map((item, index) => (
                <Chip
                  key={index}
                  label={`${item.label}: ${item.value !== null && item.value !== undefined ? item.value : 'N/A'}`}
                  color={item.color || 'default'}
                  size="small"
                  variant="outlined"
                />
              ))}
            </Stack>
          </Box>
        )}

        {/* Actions */}
        {actions.length > 0 && (
          <Box
            sx={{
              p: 1,
              display: 'flex',
              flexWrap: 'wrap',
              gap: 1,
              borderTop: 1,
              borderColor: 'divider',
            }}
          >
            {actions.map((action, index) => (
              <Button
                key={index}
                variant="outlined"
                size="small"
                color={action.color || 'primary'}
                onClick={action.onClick}
              >
                {action.label}
              </Button>
            ))}
          </Box>
        )}

        {/* Logs */}
        {showLogs && (
          <>
            <Divider />
            <Box
              sx={{
                p: 1,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                bgcolor: 'background.default',
              }}
            >
              <Typography variant="caption" color="text.secondary">
                Log History
              </Typography>
              <Button
                startIcon={<RefreshIcon />}
                size="small"
                onClick={clearLogs}
                variant="text"
                color="inherit"
                sx={{ fontSize: '0.7rem' }}
              >
                Clear
              </Button>
            </Box>
            <Box
              sx={{
                maxHeight: '40vh',
                overflowY: 'auto',
                bgcolor: 'background.paper',
                p: 1,
                fontFamily: 'monospace',
                fontSize: '0.7rem',
              }}
            >
              {filteredLogs.length === 0 ? (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: 'block', textAlign: 'center', py: 2 }}
                >
                  No logs available
                </Typography>
              ) : (
                filteredLogs.map((log, index) => (
                  <Typography
                    key={index}
                    variant="caption"
                    sx={{
                      display: 'block',
                      mb: 0.5,
                      color:
                        log.type === 'error'
                          ? 'error.main'
                          : log.type === 'warn'
                            ? 'warning.main'
                            : 'text.primary',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}
                  >
                    [{log.timestamp}] {log.message}
                  </Typography>
                ))
              )}
            </Box>
          </>
        )}
      </Collapse>
    </Paper>
  );
};

export default DebugPanel;
