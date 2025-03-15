// Path: features\ar\components\LoadingState.tsx
import { Box, Typography, CircularProgress, useTheme } from '@mui/material';
import { motion } from 'framer-motion';
import ExploreIcon from '@mui/icons-material/Explore';

interface LoadingStateProps {
  message: string;
  progress?: number;
}

const LoadingState: React.FC<LoadingStateProps> = ({ message, progress }) => {
  const theme = useTheme();

  return (
    <Box
      component={motion.div}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
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
      <Box
        component={motion.div}
        animate={{
          scale: [1, 1.1, 1],
          rotate: [0, 5, 0, -5, 0],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
          repeatType: 'loop',
        }}
      >
        <ExploreIcon
          sx={{
            fontSize: 80,
            color: 'primary.main',
          }}
        />
      </Box>

      <Typography
        variant="h5"
        component={motion.h2}
        animate={{ opacity: [0.7, 1, 0.7] }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          repeatType: 'loop',
        }}
        textAlign="center"
        fontWeight="medium"
        sx={{ mb: 1 }}
      >
        {message}
      </Typography>

      {progress !== undefined ? (
        <Box sx={{ position: 'relative', width: 100, height: 100 }}>
          <CircularProgress
            variant="determinate"
            value={progress}
            size={100}
            thickness={4}
            sx={{
              color: theme.palette.primary.main,
            }}
          />
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              bottom: 0,
              right: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Typography variant="body1" color="text.secondary">
              {`${Math.round(progress)}%`}
            </Typography>
          </Box>
        </Box>
      ) : (
        <CircularProgress size={60} thickness={4} />
      )}
    </Box>
  );
};

export default LoadingState;
