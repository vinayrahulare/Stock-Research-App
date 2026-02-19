import { createTheme } from "@mui/material/styles";

export function createAppTheme(mode: "light" | "dark") {
  return createTheme({
    palette: {
      mode,
      background:
        mode === "dark"
          ? {
              default: "#0f172a",
              paper: "#111827",
            }
          : {
              default: "#f8fafc",
              paper: "#ffffff",
            },
      primary: {
        main: "#0d9488",
        light: "#14b8a6",
        dark: "#0f766e",
      },
      secondary: {
        main: "#64748b",
        light: "#94a3b8",
        dark: "#475569",
      },
      success: {
        main: "#10b981",
        light: "#34d399",
      },
      warning: {
        main: "#f59e0b",
        light: "#fbbf24",
      },
      error: {
        main: "#ef4444",
        light: "#f87171",
      },
      text:
        mode === "dark"
          ? {
              primary: "#e5e7eb",
              secondary: "#9ca3af",
            }
          : {
              primary: "#0f172a",
              secondary: "#64748b",
            },
      divider: mode === "dark" ? "#374151" : "#e2e8f0",
    },
    shape: {
      borderRadius: 12,
    },
    typography: {
      fontFamily:
        'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      h4: {
        fontWeight: 700,
        letterSpacing: "-0.02em",
      },
      h6: {
        fontWeight: 600,
        letterSpacing: "-0.01em",
      },
      button: {
        textTransform: "none",
        fontWeight: 600,
      },
    },
    components: {
      MuiCard: {
        styleOverrides: {
          root: {
            boxShadow:
              mode === "dark"
                ? "0 1px 2px 0 rgb(0 0 0 / 0.35)"
                : "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            boxShadow: "none",
            "&:hover": {
              boxShadow: "none",
            },
          },
          contained: {
            "&:hover": {
              transform: "translateY(-1px)",
            },
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            boxShadow:
              mode === "dark"
                ? "0 1px 2px 0 rgb(0 0 0 / 0.35)"
                : "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
          },
        },
      },
    },
  });
}
