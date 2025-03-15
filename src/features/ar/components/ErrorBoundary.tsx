// Path: features\ar\components\ErrorBoundary.tsx
import { Component, ErrorInfo, ReactNode } from 'react';
import { Box, Typography, Button, Paper } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Componente que captura erros em seus filhos e exibe uma UI de fallback
 */
class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null 
    };
  }

  static getDerivedStateFromError(error: Error): State {
    // Atualiza o estado para que a próxima renderização mostre a UI de fallback
    return { 
      hasError: true, 
      error, 
      errorInfo: null 
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Você pode registrar o erro em um serviço de relatório de erros
    console.error('Erro capturado pela ErrorBoundary:', error, errorInfo);
    this.setState({ errorInfo });
  }

  resetError = () => {
    this.setState({ 
      hasError: false, 
      error: null, 
      errorInfo: null 
    });
  }

  reload = () => {
    window.location.reload();
  }

  render() {
    if (this.state.hasError) {
      // Se houver um fallback personalizado fornecido, use-o
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Caso contrário, use a UI de fallback padrão
      return (
        <Box
          sx={{
            height: '100vh',
            width: '100vw',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            padding: 3,
            bgcolor: 'background.default',
            color: 'text.primary',
          }}
        >
          <Paper
            elevation={3}
            sx={{
              p: 3,
              maxWidth: 500,
              width: '100%',
              borderRadius: 2,
              textAlign: 'center',
            }}
          >
            <Typography variant="h5" gutterBottom color="error">
              Ops! Algo deu errado.
            </Typography>
            
            <Typography variant="body1" sx={{ mb: 3 }}>
              A aplicação encontrou um erro. Por favor, tente novamente.
            </Typography>

            <Box sx={{ mb: 3, display: 'flex', gap: 2, justifyContent: 'center' }}>
              <Button 
                variant="contained" 
                color="primary" 
                startIcon={<RefreshIcon />}
                onClick={this.reload}
              >
                Recarregar Aplicativo
              </Button>
              
              <Button
                variant="outlined"
                onClick={this.resetError}
              >
                Tentar Novamente
              </Button>
            </Box>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <Box sx={{ mt: 3, textAlign: 'left' }}>
                <Typography variant="subtitle2" color="error">
                  Detalhes do Erro (somente desenvolvimento):
                </Typography>
                <Box 
                  component="pre" 
                  sx={{ 
                    p: 2, 
                    bgcolor: 'background.paper', 
                    border: '1px solid', 
                    borderColor: 'divider',
                    borderRadius: 1,
                    overflowX: 'auto',
                    fontSize: '0.75rem',
                    lineHeight: 1.5,
                    mt: 1
                  }}
                >
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </Box>
              </Box>
            )}
          </Paper>
        </Box>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;