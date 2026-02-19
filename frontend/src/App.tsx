import {
  Alert,
  Box,
  Button,
  Container,
  Stack,
  Typography,
  ThemeProvider,
  CssBaseline,
} from "@mui/material";
import CloudUploadRoundedIcon from "@mui/icons-material/CloudUploadRounded";
import { theme } from "./theme";
import { useState, useEffect } from "react";
import { StatCards } from "./components/StatCards";
import { HoldingsTable } from "./components/HoldingsTable";
import { CsvUploadDialog } from "./components/CsvUploadDialog";
import { fetchHoldings, fetchStats } from "./api/client";
import type { DividendHolding, StatsResponse } from "./types";

function App() {
  const [holdings, setHoldings] = useState<DividendHolding[]>([]);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [csvDialogOpen, setCsvDialogOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [h, s] = await Promise.all([fetchHoldings(), fetchStats()]);
      setHoldings(h);
      setStats(s);
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "message" in e
          ? String((e as { message: unknown }).message)
          : "Failed to load data";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
        <Container maxWidth="xl" sx={{ py: 4 }}>
          <Stack spacing={3}>
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              flexWrap="wrap"
              gap={2}
            >
              <Box>
                <Typography variant="h4" sx={{ mb: 0.5 }}>
                  Dividend Portfolio
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Personal dividend holdings dashboard
                </Typography>
              </Box>
              <Button
                variant="contained"
                startIcon={<CloudUploadRoundedIcon />}
                onClick={() => setCsvDialogOpen(true)}
              >
                Import CSV
              </Button>
            </Stack>

            <StatCards stats={stats} />

            {error && (
              <Alert severity="error" onClose={() => setError(null)}>
                {error}
              </Alert>
            )}

            <HoldingsTable rows={holdings} loading={loading} />
          </Stack>

          <CsvUploadDialog
            open={csvDialogOpen}
            onClose={() => setCsvDialogOpen(false)}
            onSuccess={load}
          />
        </Container>
      </Box>
    </ThemeProvider>
  );
}

export default App;
