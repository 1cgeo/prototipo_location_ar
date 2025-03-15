// Path: features\ar\components\FloatingDebugInfo.tsx
import React, { useState } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Collapse,
  Chip,
  Stack,
  Paper,
} from '@mui/material';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { useCameraStore } from '../stores/cameraStore';

interface FloatingDebugInfoProps {
  position?: 'top' | 'left' | 'right' | 'bottom' | 'center';
  statusItems: Array<{
    label: string;
    value: string | number | boolean | null | undefined;
    color?: 'success' | 'error' | 'warning' | 'info' | 'default';
  }>;
  showLogs?: boolean;
  maxLogEntries?: number;
  maxWidth?: string | number;
}

/**
 * Lightweight floating debug information component
 */
const FloatingDebugInfo: React.FC<FloatingDebugInfoProps> = ({
  position = 'left',
  statusItems = [],
  showLogs = true,
  maxLogEntries = 5,
  maxWidth = '35%',
}) => {
  const [expanded, setExpanded] = useState(false);
  const { logs } = useCameraStore();

  // Get last N logs
  const recentLogs = logs.slice(0, maxLogEntries);

  // Position styles
  const getPositionStyles = () => {
    switch (position) {
      case 'top':
        return {
          top: 16,
          left: '50%',
          transform: 'translateX(-50%)',
        };
      case 'bottom':
        return {
          bottom: 16,
          left: '50%',
          transform: 'translateX(-50%)',
        };
      case 'right':
        return {
          top: '50%',
          right: 8,
          transform: 'translateY(-50%)',
        };
      case 'center':
        return {
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
        };
      case 'left':
      default:
        return {
          top: '50%',
          left: 8,
          transform: 'translateY(-50%)',
        };
    }
  };

  return (
    <Paper
      elevation={3}
      sx={{
        position: 'absolute',
        ...getPositionStyles(),
        zIndex: 1200,
        maxWidth,
        bgcolor: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(4px)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 2,
        overflow: 'hidden',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', p: 0.5 }}>
        <IconButton
          size="small"
          color="inherit"
          onClick={() => setExpanded(!expanded)}
          sx={{ color: 'white' }}
        >
          {expanded ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
        </IconButton>
        <Typography variant="caption" color="white" sx={{ ml: 1 }}>
          Debug Info {expanded ? '(click to hide)' : '(click to show)'}
        </Typography>
      </Box>

      <Collapse in={expanded}>
        {statusItems.length > 0 && (
          <Stack spacing={1} sx={{ p: 1 }}>
            {statusItems.map((item, index) => (
              <Chip
                key={index}
                size="small"
                label={`${item.label}: ${item.value !== null && item.value !== undefined ? item.value : 'N/A'}`}
                color={item.color || 'default'}
                variant="outlined"
                sx={{
                  borderColor: 'rgba(255,255,255,0.2)',
                  '& .MuiChip-label': { fontSize: '0.7rem' },
                }}
              />
            ))}
          </Stack>
        )}

        {showLogs && (
          <Box sx={{ p: 1, maxHeight: '150px', overflowY: 'auto' }}>
            {recentLogs.map((log, i) => (
              <Typography
                key={i}
                variant="caption"
                sx={{
                  display: 'block',
                  color:
                    log.type === 'error'
                      ? '#ff6b6b'
                      : log.type === 'warn'
                        ? '#ffd166'
                        : 'rgba(255,255,255,0.7)',
                  fontSize: '0.6rem',
                  lineHeight: 1.3,
                  mt: i > 0 ? 0.5 : 0,
                  whiteSpace: 'nowrap',
                  textOverflow: 'ellipsis',
                  overflow: 'hidden',
                }}
              >
                {log.timestamp}: {log.message}
              </Typography>
            ))}
          </Box>
        )}
      </Collapse>
    </Paper>
  );
};

export default FloatingDebugInfo;
