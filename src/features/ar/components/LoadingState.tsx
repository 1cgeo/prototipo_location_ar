// Path: features\ar\components\LoadingState.tsx
import React from 'react';
import { Box, Typography, CircularProgress } from '@mui/material';
import ExploreIcon from '@mui/icons-material/Explore';

interface LoadingStateProps {
  message?: string;
}

/**
 * Simplified loading state component
 */
const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Loading...',
}) => {
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

      <CircularProgress size={60} thickness={4} />
    </Box>
  );
};

export default LoadingState;
