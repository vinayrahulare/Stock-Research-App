import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Chip,
  CircularProgress,
  TablePagination,
  InputBase,
  Box,
} from "@mui/material";
import type { DividendHolding } from "../types";

export interface HoldingsFilters {
  ticker: string;
  company: string;
  sector: string;
  valuation: string;
  si_verdict: string;
  why_it_fits: string;
}

interface HoldingsTableProps {
  rows: DividendHolding[];
  total: number;
  loading: boolean;
  page: number;
  rowsPerPage: number;
  onPageChange: (page: number) => void;
  onRowsPerPageChange: (rowsPerPage: number) => void;
  filters: HoldingsFilters;
  onFilterChange: (filters: HoldingsFilters) => void;
}

function num(v: string | number | null | undefined): string {
  if (v == null) return "—";
  const n = Number(v);
  return Number.isNaN(n) ? "—" : n.toFixed(2);
}

export function HoldingsTable({
  rows,
  total,
  loading,
  page,
  rowsPerPage,
  onPageChange,
  onRowsPerPageChange,
  filters,
  onFilterChange,
}: HoldingsTableProps) {
  const handleFilter = (field: keyof HoldingsFilters) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    onFilterChange({ ...filters, [field]: e.target.value });
  };

  if (loading) {
    return (
      <Paper sx={{ p: 4, textAlign: "center" }}>
        <CircularProgress />
      </Paper>
    );
  }

  if (rows.length === 0 && total === 0) {
    return (
      <Paper sx={{ p: 4, textAlign: "center" }}>
        <Typography color="text.secondary">
          No holdings yet. Import a dividend portfolio CSV or use the Data loader
          tab to get started.
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper>
      <TableContainer sx={{ maxHeight: "70vh" }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              <TableCell sx={{ minWidth: 90 }}>
                <strong>Ticker</strong>
                <Box sx={{ mt: 0.5 }}>
                  <InputBase
                    size="small"
                    placeholder="Filter…"
                    value={filters.ticker}
                    onChange={handleFilter("ticker")}
                    sx={{
                      fontSize: "0.8rem",
                      "& .MuiInputBase-input": { py: 0.5, px: 1 },
                    }}
                  />
                </Box>
              </TableCell>
              <TableCell sx={{ minWidth: 140 }}>
                <strong>Company</strong>
                <Box sx={{ mt: 0.5 }}>
                  <InputBase
                    size="small"
                    placeholder="Filter…"
                    value={filters.company}
                    onChange={handleFilter("company")}
                    sx={{
                      fontSize: "0.8rem",
                      "& .MuiInputBase-input": { py: 0.5, px: 1 },
                    }}
                  />
                </Box>
              </TableCell>
              <TableCell sx={{ minWidth: 110 }}>
                <strong>Sector</strong>
                <Box sx={{ mt: 0.5 }}>
                  <InputBase
                    size="small"
                    placeholder="Filter…"
                    value={filters.sector}
                    onChange={handleFilter("sector")}
                    sx={{
                      fontSize: "0.8rem",
                      "& .MuiInputBase-input": { py: 0.5, px: 1 },
                    }}
                  />
                </Box>
              </TableCell>
              <TableCell align="right" sx={{ minWidth: 80 }}>
                <strong>Price</strong>
              </TableCell>
              <TableCell align="right" sx={{ minWidth: 60 }}>
                <strong>P/E</strong>
              </TableCell>
              <TableCell align="right" sx={{ minWidth: 80 }}>
                <strong>Ann. Div</strong>
              </TableCell>
              <TableCell align="right" sx={{ minWidth: 80 }}>
                <strong>Cur. Yield</strong>
              </TableCell>
              <TableCell sx={{ minWidth: 100 }}>
                <strong>Valuation</strong>
                <Box sx={{ mt: 0.5 }}>
                  <InputBase
                    size="small"
                    placeholder="Filter…"
                    value={filters.valuation}
                    onChange={handleFilter("valuation")}
                    sx={{
                      fontSize: "0.8rem",
                      "& .MuiInputBase-input": { py: 0.5, px: 1 },
                    }}
                  />
                </Box>
              </TableCell>
              <TableCell sx={{ minWidth: 100 }}>
                <strong>High Quality</strong>
                <Box sx={{ mt: 0.5 }}>
                  <InputBase
                    size="small"
                    placeholder="Filter…"
                    value={filters.si_verdict}
                    onChange={handleFilter("si_verdict")}
                    sx={{
                      fontSize: "0.8rem",
                      "& .MuiInputBase-input": { py: 0.5, px: 1 },
                    }}
                  />
                </Box>
              </TableCell>
              <TableCell sx={{ minWidth: 160 }}>
                <strong>Why it fits</strong>
                <Box sx={{ mt: 0.5 }}>
                  <InputBase
                    size="small"
                    placeholder="Filter…"
                    value={filters.why_it_fits}
                    onChange={handleFilter("why_it_fits")}
                    sx={{
                      fontSize: "0.8rem",
                      "& .MuiInputBase-input": { py: 0.5, px: 1 },
                    }}
                  />
                </Box>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((h) => (
              <TableRow key={h.id} hover>
                <TableCell sx={{ fontFamily: "monospace", color: "primary.main" }}>
                  {h.ticker}
                </TableCell>
                <TableCell>{h.company}</TableCell>
                <TableCell>{h.sector}</TableCell>
                <TableCell align="right">${num(h.price)}</TableCell>
                <TableCell align="right">{num(h.pe)}</TableCell>
                <TableCell align="right">${num(h.annual_div)}</TableCell>
                <TableCell align="right">{num(h.current_yield)}%</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={h.valuation}
                    color={
                      String(h.valuation).toLowerCase().startsWith("under")
                        ? "success"
                        : "default"
                    }
                    variant="outlined"
                  />
                </TableCell>
                <TableCell>{h.si_verdict}</TableCell>
                <TableCell sx={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis" }}>
                  {h.why_it_fits || "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination
        component="div"
        count={total}
        page={page}
        onPageChange={(_, newPage) => onPageChange(newPage)}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={(e) =>
          onRowsPerPageChange(parseInt(e.target.value, 10))
        }
        rowsPerPageOptions={[5, 10, 25, 50]}
        labelRowsPerPage="Rows:"
      />
    </Paper>
  );
}
