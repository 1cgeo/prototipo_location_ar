// Path: features\ar\components\LoadingState.tsx
import React, { useState, useEffect } from 'react';
import { Box, Typography, CircularProgress, Button } from '@mui/material';
import ExploreIcon from '@mui/icons-material/Explore';
import RefreshIcon from '@mui/icons-material/Refresh';

interface LoadingStateProps {
  message?: string;
}

/**
 * Improved loading state component with timeout handling
 */
const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Loading...',
}) => {
  const [elapsedTime, setElapsedTime] = useState(0);
  const [showRetry, setShowRetry] = useState(false);

  // Increment elapsed time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedTime(prev => prev + 1);
    }, 1000);

    // Show retry button after 15 seconds
    const retryTimer = setTimeout(() => {
      setShowRetry(true);
    }, 15000);

    return () => {
      clearInterval(timer);
      clearTimeout(retryTimer);
    };
  }, []);

  // Handle refresh on timeout
  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <Box
      sx={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        bgcolor: 'background.default',
        zIndex: 1000,
        gap: 3,
        padding: 3,
      }}
    >
      <ExploreIcon
        sx={{
          fontSize: 80,
          color: 'primary.main',
          animation: 'pulse 2s infinite',
        }}
      />

      <Typography
        variant="h5"
        textAlign="center"
        fontWeight="medium"
        sx={{ mb: 1 }}
      >
        {message}
      </Typography>

      {/* Show elapsed time after 5 seconds */}
      {elapsedTime > 5 && (
        <Typography variant="body2" color="text.secondary">
          {elapsedTime < 10
            ? 'Initializing sensors...'
            : elapsedTime < 20
              ? 'This is taking longer than usual'
              : 'Still trying to initialize AR view'}
        </Typography>
      )}

      <CircularProgress
        size={60}
        thickness={4}
        variant={elapsedTime > 10 ? 'indeterminate' : 'indeterminate'}
        value={Math.min(100, elapsedTime * 10)}
      />

      {/* Show retry button if it's taking too long */}
      {showRetry && (
        <Button
          variant="contained"
          color="primary"
          startIcon={<RefreshIcon />}
          onClick={handleRefresh}
          sx={{ mt: 2 }}
        >
          Reload App
        </Button>
      )}
    </Box>
  );
};

export default LoadingState;
