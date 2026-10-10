import {
  Alert,
  Box,
  Button,
  Chip,
  Container,
  IconButton,
  InputAdornment,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Stack,
  TextField,
  Tab,
  Tabs,
  Typography,
  ThemeProvider,
  CssBaseline,
  Paper,
} from "@mui/material";
import CloudUploadRoundedIcon from "@mui/icons-material/CloudUploadRounded";
import DeleteSweepRoundedIcon from "@mui/icons-material/DeleteSweepRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import DarkModeRoundedIcon from "@mui/icons-material/DarkModeRounded";
import LightModeRoundedIcon from "@mui/icons-material/LightModeRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import { createAppTheme } from "./theme";
import { useState, useEffect, useCallback, useMemo } from "react";
import { StatCards } from "./components/StatCards";
import {
  HoldingsTable,
  type HoldingsFilters,
  type HoldingsFiltersOptions,
  type SortableColumn,
} from "./components/HoldingsTable";
import { CsvUploadDialog } from "./components/CsvUploadDialog";
import {
  fetchFilterOptions,
  fetchAuditLogs,
  exportHoldingsCsv,
  fetchHoldings,
  fetchStats,
  purgeHoldings,
  refreshPrices,
} from "./api/client";
import type { AuditLogEntry } from "./api/client";
import type { DividendHolding, StatsResponse } from "./types";

const defaultFilters: HoldingsFilters = {
  ticker: "",
  company: "",
  sector: "",
  valuation: "",
  si_verdict: "",
  why_it_fits: "",
};

const emptyFilterOptions: HoldingsFiltersOptions = {
  ticker: [],
  company: [],
  sector: [],
  valuation: [],
  si_verdict: [],
  why_it_fits: [],
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
  const [tickerSearch, setTickerSearch] = useState("");
  const [filterOptions, setFilterOptions] =
    useState<HoldingsFiltersOptions>(emptyFilterOptions);
  const [sortBy, setSortBy] = useState<SortableColumn>("valuation");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [purging, setPurging] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState<{
    severity: "success" | "warning";
    text: string;
  } | null>(null);
  const [mode, setMode] = useState<"light" | "dark">(() => {
    const saved = localStorage.getItem("si-theme-mode");
    return saved === "dark" ? "dark" : "light";
  });

  const theme = useMemo(() => createAppTheme(mode), [mode]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);

  const buildQueryParams = useCallback(
    (includePagination: boolean) => {
      const params: Record<string, string | number> = {};
      if (includePagination) {
        params.page = page + 1;
        params.page_size = rowsPerPage;
      }
      if (filters.ticker) params.ticker = filters.ticker;
      if (filters.company) params.company = filters.company;
      if (filters.sector) params.sector = filters.sector;
      if (filters.valuation) params.valuation = filters.valuation;
      if (filters.si_verdict) params.si_verdict = filters.si_verdict;
      if (filters.why_it_fits) params.why_it_fits = filters.why_it_fits;
      if (tickerSearch.trim()) params.ticker_search = tickerSearch.trim();
      params.sort_by = sortBy;
      params.sort_order = sortOrder;
      return params;
    },
    [filters, page, rowsPerPage, sortBy, sortOrder, tickerSearch]
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [listRes, s, options] = await Promise.all([
        fetchHoldings(buildQueryParams(true)),
        fetchStats(),
        fetchFilterOptions(),
      ]);
      setHoldings(listRes.items);
      setTotal(listRes.total);
      setStats(s);
      setFilterOptions(options);
      if (tab === 1) {
        const logs = await fetchAuditLogs(100);
        setAuditLogs(logs);
      }
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "message" in e
          ? String((e as { message: unknown }).message)
          : "Failed to load data";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [buildQueryParams, tab]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    localStorage.setItem("si-theme-mode", mode);
  }, [mode]);

  const handlePurge = async () => {
    if (!window.confirm("Delete all holdings? This cannot be undone.")) return;
    setPurging(true);
    setError(null);
    try {
      await purgeHoldings();
      await load();
      const logs = await fetchAuditLogs(100);
      setAuditLogs(logs);
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

  const handleRefreshPrices = async () => {
    setRefreshing(true);
    setError(null);
    setNotice(null);
    try {
      const result = await refreshPrices();
      setNotice({
        severity: result.failed > 0 ? "warning" : "success",
        text: result.message,
      });
      await load();
    } catch (e: unknown) {
      let msg = "Failed to refresh prices";
      if (e && typeof e === "object") {
        const detail = (e as { response?: { data?: { detail?: unknown } } })
          .response?.data?.detail;
        if (typeof detail === "string") msg = detail;
        else if ("message" in e) msg = String((e as { message: unknown }).message);
      }
      setError(msg);
    } finally {
      setRefreshing(false);
    }
  };

  const handleExportCsv = async () => {
    setExporting(true);
    setError(null);
    try {
      const blob = await exportHoldingsCsv(buildQueryParams(false));
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      a.href = url;
      a.download = `holdings-export-${timestamp}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "message" in e
          ? String((e as { message: unknown }).message)
          : "Failed to export CSV";
      setError(msg);
    } finally {
      setExporting(false);
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
                  {stats && stats.total > 0 &&
                    (stats.last_price_refresh
                      ? ` · Prices refreshed ${new Date(
                          stats.last_price_refresh
                        ).toLocaleString()}`
                      : " · Prices from CSV import")}
                </Typography>
              </Box>
              <Stack direction="row" spacing={1} alignItems="center">
                <IconButton
                  onClick={() => setMode((prev) => (prev === "light" ? "dark" : "light"))}
                  color="primary"
                >
                  {mode === "light" ? <DarkModeRoundedIcon /> : <LightModeRoundedIcon />}
                </IconButton>
                <Button
                  variant="outlined"
                  startIcon={<RefreshRoundedIcon />}
                  onClick={handleRefreshPrices}
                  disabled={refreshing || (stats?.total ?? 0) === 0}
                >
                  {refreshing ? "Refreshing…" : "Refresh prices"}
                </Button>
                <Button
                  variant="contained"
                  startIcon={<CloudUploadRoundedIcon />}
                  onClick={() => setCsvDialogOpen(true)}
                >
                  Import CSV
                </Button>
              </Stack>
            </Stack>

            <Tabs value={tab} onChange={(_, v) => setTab(v)}>
              <Tab label="Dashboard" />
              <Tab label="Data loader" />
            </Tabs>

            {tab === 0 && (
              <>
                <StatCards stats={stats} />
                {notice && (
                  <Alert severity={notice.severity} onClose={() => setNotice(null)}>
                    {notice.text}
                  </Alert>
                )}
                {error && (
                  <Alert severity="error" onClose={() => setError(null)}>
                    {error}
                  </Alert>
                )}
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                  <TextField
                    placeholder="Search any stock ticker..."
                    size="small"
                    value={tickerSearch}
                    onChange={(e) => {
                      setTickerSearch(e.target.value);
                      setPage(0);
                    }}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchRoundedIcon fontSize="small" />
                        </InputAdornment>
                      ),
                    }}
                    fullWidth
                  />
                  <Button
                    variant="outlined"
                    onClick={() => {
                      setFilters(defaultFilters);
                      setTickerSearch("");
                      setPage(0);
                    }}
                    disabled={
                      !tickerSearch &&
                      Object.values(filters).every((value) => value === "")
                    }
                  >
                    Clear filter(s)
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={<DownloadRoundedIcon />}
                    onClick={handleExportCsv}
                    disabled={exporting || total === 0}
                  >
                    {exporting ? "Exporting..." : "Export CSV"}
                  </Button>
                </Stack>
                <HoldingsTable
                  rows={holdings}
                  total={total}
                  loading={loading}
                  page={page}
                  rowsPerPage={rowsPerPage}
                  onPageChange={setPage}
                  onRowsPerPageChange={(value) => {
                    setRowsPerPage(value);
                    setPage(0);
                  }}
                  filters={filters}
                  filterOptions={filterOptions}
                  sortBy={sortBy}
                  sortOrder={sortOrder}
                  onSortChange={(column) => {
                    if (sortBy === column) {
                      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
                    } else {
                      setSortBy(column);
                      setSortOrder("asc");
                    }
                    setPage(0);
                  }}
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
                <TableContainer sx={{ mt: 3 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>
                          <strong>Timestamp</strong>
                        </TableCell>
                        <TableCell>
                          <strong>File</strong>
                        </TableCell>
                        <TableCell>
                          <strong>Imported</strong>
                        </TableCell>
                        <TableCell>
                          <strong>Updated/Purged</strong>
                        </TableCell>
                        <TableCell>
                          <strong>Status</strong>
                        </TableCell>
                        <TableCell>
                          <strong>Message</strong>
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {auditLogs.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} align="center">
                            <Typography color="text.secondary" variant="body2">
                              No audit log entries yet.
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ) : (
                        auditLogs.map((log) => (
                          <TableRow key={log.id} hover>
                            <TableCell>
                              {new Date(log.created_at).toLocaleString()}
                            </TableCell>
                            <TableCell>{log.file_name || "—"}</TableCell>
                            <TableCell>{log.imported_count}</TableCell>
                            <TableCell>{log.updated_count}</TableCell>
                            <TableCell>
                              <Chip
                                size="small"
                                label={log.status}
                                color={
                                  log.status === "success" ? "success" : "error"
                                }
                                variant="outlined"
                              />
                            </TableCell>
                            <TableCell>{log.message}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
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
