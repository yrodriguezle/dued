import React, { ReactNode, ErrorInfo } from "react";
import { Box, Button, Container, Typography, Paper } from "@mui/material";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import logger from "../../common/logger/logger";

const isDevelopment = () => import.meta.env.MODE === "development";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo,
    });

    // Log error details (in development)
    if (isDevelopment()) {
      logger.error("ErrorBoundary caught an error:", error);
      logger.error("Error info:", errorInfo);
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
    // Reindirizza alla dashboard mantenendo l'autenticazione
    window.location.href = "/gestionale/dashboard";
  };

  handleReload = () => {
    // Ricarica la pagina corrente mantenendo l'autenticazione
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            minHeight: "100vh",
            backgroundColor: "#f5f5f5",
            padding: 2,
          }}
        >
          <Container maxWidth="sm">
            <Paper
              elevation={2}
              sx={{
                padding: 4,
                textAlign: "center",
                borderTop: "4px solid #d32f2f",
              }}
            >
              <ErrorOutlineIcon
                sx={{
                  fontSize: 64,
                  color: "#d32f2f",
                  marginBottom: 2,
                }}
              />

              <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: "bold" }}>
                Oops! Qualcosa è andato storto
              </Typography>

              <Typography variant="body1" color="text.secondary" sx={{ marginY: 2 }}>
                Ci scusiamo per l'inconveniente. Un errore inatteso ha interrotto l'applicazione.
              </Typography>

              {isDevelopment() && this.state.error && (
                <Paper
                  variant="outlined"
                  sx={{
                    padding: 2,
                    marginY: 2,
                    backgroundColor: "#f5f5f5",
                    textAlign: "left",
                    maxHeight: "200px",
                    overflow: "auto",
                  }}
                >
                  <Typography variant="subtitle2" sx={{ fontWeight: "bold", marginBottom: 1 }}>
                    Dettagli errore (solo sviluppo):
                  </Typography>
                  <Typography
                    variant="caption"
                    component="pre"
                    sx={{
                      fontFamily: "monospace",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      color: "#d32f2f",
                    }}
                  >
                    {this.state.error.toString()}
                  </Typography>
                  {this.state.errorInfo && (
                    <Typography
                      variant="caption"
                      component="pre"
                      sx={{
                        fontFamily: "monospace",
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                        marginTop: 2,
                        display: "block",
                      }}
                    >
                      {this.state.errorInfo.componentStack}
                    </Typography>
                  )}
                </Paper>
              )}

              <Box sx={{ display: "flex", gap: 2, justifyContent: "center", marginTop: 3 }}>
                <Button variant="contained" color="primary" onClick={this.handleReload}>
                  Ricarica la Pagina
                </Button>
                <Button variant="outlined" color="primary" onClick={this.handleReset}>
                  Vai al Dashboard
                </Button>
              </Box>
            </Paper>
          </Container>
        </Box>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
