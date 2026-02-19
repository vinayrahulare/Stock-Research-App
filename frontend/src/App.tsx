import {
  Alert,
  Box,
  Button,
  Container,
  Stack,
  Tab,
  Tabs,
  Typography,
  ThemeProvider,
  CssBaseline,
  Paper,
} from "@mui/material";
import CloudUploadRoundedIcon from "@mui/icons-material/CloudUploadRounded";
import DeleteSweepRoundedIcon from "@mui/icons-material/DeleteSweepRounded";
import { theme } from "./theme";
import { useState, useEffect, useCallback } from "react";
import { StatCards } from "./components/StatCards";
import { HoldingsTable, type HoldingsFilters } from "./components/HoldingsTable";
import { CsvUploadDialog } from "./components/CsvUploadDialog";
import { fetchHoldings, fetchStats, purgeHoldings } from "./api/client";
import type { DividendHolding, StatsResponse } from "./types";

const defaultFilters: HoldingsFilters = {
  ticker: "",
  company: "",
  sector: "",
  valuation: "",
  si_verdict: "",
  why_it_fits: "",
};

function App() {
  const [holdings, setHoldings] = useState<DividendHolding[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [csvDialogOpen, setCsvDialogOpen] = useState(false);
  const [tab, setTab] = useState(0);
  const [filters, setFilters] = useState<HoldingsFilters>(defaultFilters);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [purging, setPurging] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: Record<string, string | number> = {
        page: page + 1,
        page_size: rowsPerPage,
      };
      if (filters.ticker) params.ticker = filters.ticker;
      if (filters.company) params.company = filters.company;
      if (filters.sector) params.sector = filters.sector;
      if (filters.valuation) params.valuation = filters.valuation;
      if (filters.si_verdict) params.si_verdict = filters.si_verdict;
      if (filters.why_it_fits) params.why_it_fits = filters.why_it_fits;
      const [listRes, s] = await Promise.all([
        fetchHoldings(params),
        fetchStats(),
      ]);
      setHoldings(listRes.items);
      setTotal(listRes.total);
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
  }, [page, rowsPerPage, filters]);

  useEffect(() => {
    load();
  }, [load]);

  const handlePurge = async () => {
    if (!window.confirm("Delete all holdings? This cannot be undone.")) return;
    setPurging(true);
    setError(null);
    try {
      await purgeHoldings();
      await load();
      setTab(0);
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "message" in e
          ? String((e as { message: unknown }).message)
          : "Failed to purge";
      setError(msg);
    } finally {
      setPurging(false);
    }
  };

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

            <Tabs value={tab} onChange={(_, v) => setTab(v)}>
              <Tab label="Dashboard" />
              <Tab label="Data loader" />
            </Tabs>

            {tab === 0 && (
              <>
                <StatCards stats={stats} />
                {error && (
                  <Alert severity="error" onClose={() => setError(null)}>
                    {error}
                  </Alert>
                )}
                <HoldingsTable
                  rows={holdings}
                  total={total}
                  loading={loading}
                  page={page}
                  rowsPerPage={rowsPerPage}
                  onPageChange={setPage}
                  onRowsPerPageChange={setRowsPerPage}
                  filters={filters}
                  onFilterChange={(f) => {
                    setFilters(f);
                    setPage(0);
                  }}
                />
              </>
            )}

            {tab === 1 && (
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ mb: 1 }}>
                  Data loader
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Data is stored in the database and persists across app and
                  server restarts. Use the actions below to purge all holdings or
                  reload from CSV.
                </Typography>
                {error && (
                  <Alert
                    severity="error"
                    onClose={() => setError(null)}
                    sx={{ mb: 2 }}
                  >
                    {error}
                  </Alert>
                )}
                <Stack direction="row" spacing={2} flexWrap="wrap">
                  <Button
                    variant="outlined"
                    color="error"
                    startIcon={<DeleteSweepRoundedIcon />}
                    onClick={handlePurge}
                    disabled={purging || (stats?.total ?? 0) === 0}
                  >
                    {purging ? "Purging…" : "Purge all data"}
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={<CloudUploadRoundedIcon />}
                    onClick={() => {
                      setCsvDialogOpen(true);
                    }}
                  >
                    Reload from CSV
                  </Button>
                </Stack>
              </Paper>
            )}
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
