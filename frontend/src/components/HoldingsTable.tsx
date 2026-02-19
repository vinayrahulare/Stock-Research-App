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
  Box,
  FormControl,
  MenuItem,
  Select,
  SelectChangeEvent,
  TableSortLabel,
} from "@mui/material";
import { useMemo, useState } from "react";
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
  filterOptions: HoldingsFiltersOptions;
  sortBy: SortableColumn;
  sortOrder: "asc" | "desc";
  onSortChange: (column: SortableColumn) => void;
}

export interface HoldingsFiltersOptions {
  ticker: string[];
  company: string[];
  sector: string[];
  valuation: string[];
  si_verdict: string[];
  why_it_fits: string[];
}

export type SortableColumn =
  | "ticker"
  | "company"
  | "sector"
  | "price"
  | "pe"
  | "annual_div"
  | "current_yield"
  | "valuation"
  | "si_verdict"
  | "why_it_fits";

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
  filterOptions,
  sortBy,
  sortOrder,
  onSortChange,
}: HoldingsTableProps) {
  const [columnWidths, setColumnWidths] = useState<Record<SortableColumn, number>>({
    ticker: 110,
    company: 180,
    sector: 140,
    price: 95,
    pe: 80,
    annual_div: 100,
    current_yield: 110,
    valuation: 130,
    si_verdict: 130,
    why_it_fits: 280,
  });

  const columns = useMemo(
    () => [
      { key: "ticker", label: "Ticker", align: "left" as const },
      { key: "company", label: "Company", align: "left" as const },
      { key: "sector", label: "Sector", align: "left" as const },
      { key: "price", label: "Price", align: "right" as const },
      { key: "pe", label: "P/E", align: "right" as const },
      { key: "annual_div", label: "Ann. Div", align: "right" as const },
      { key: "current_yield", label: "Cur. Yield", align: "right" as const },
      { key: "valuation", label: "Valuation", align: "left" as const },
      { key: "si_verdict", label: "High Quality", align: "left" as const },
      { key: "why_it_fits", label: "Why it fits", align: "left" as const },
    ],
    []
  );

  const handleFilter = (field: keyof HoldingsFilters) => (e: SelectChangeEvent) => {
    onFilterChange({ ...filters, [field]: e.target.value });
  };

  const startResize = (column: SortableColumn, startX: number) => {
    const startWidth = columnWidths[column];
    const onMove = (event: MouseEvent) => {
      const width = Math.max(90, startWidth + (event.clientX - startX));
      setColumnWidths((prev) => ({ ...prev, [column]: width }));
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
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
      <TableContainer sx={{ maxHeight: "70vh", overflowY: "auto" }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              {columns.map((column) => (
                <TableCell
                  key={column.key}
                  align={column.align}
                  sx={{
                    width: columnWidths[column.key as SortableColumn],
                    minWidth: 90,
                    borderRight: (theme) => `1px solid ${theme.palette.divider}`,
                    backgroundColor: "background.paper",
                    top: 0,
                    zIndex: 3,
                    position: "sticky",
                  }}
                >
                  <TableSortLabel
                    active={sortBy === column.key}
                    direction={sortBy === column.key ? sortOrder : "asc"}
                    onClick={() => onSortChange(column.key as SortableColumn)}
                  >
                    <strong>{column.label}</strong>
                  </TableSortLabel>
                  <Box
                    sx={{
                      position: "absolute",
                      top: 8,
                      right: 0,
                      width: 8,
                      bottom: 8,
                      cursor: "col-resize",
                      borderRight: (theme) =>
                        `1px solid ${theme.palette.action.disabled}`,
                    }}
                    onMouseDown={(e) =>
                      startResize(column.key as SortableColumn, e.clientX)
                    }
                  />
                </TableCell>
              ))}
            </TableRow>
            <TableRow>
              <TableCell sx={{ width: columnWidths.ticker }}>
                <FormControl size="small" fullWidth>
                  <Select value={filters.ticker} displayEmpty onChange={handleFilter("ticker")}>
                    <MenuItem value="">All</MenuItem>
                    {filterOptions.ticker.map((option) => (
                      <MenuItem key={option} value={option}>
                        {option}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </TableCell>
              <TableCell sx={{ width: columnWidths.company }}>
                <FormControl size="small" fullWidth>
                  <Select
                    value={filters.company}
                    displayEmpty
                    onChange={handleFilter("company")}
                  >
                    <MenuItem value="">All</MenuItem>
                    {filterOptions.company.map((option) => (
                      <MenuItem key={option} value={option}>
                        {option}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </TableCell>
              <TableCell sx={{ width: columnWidths.sector }}>
                <FormControl size="small" fullWidth>
                  <Select value={filters.sector} displayEmpty onChange={handleFilter("sector")}>
                    <MenuItem value="">All</MenuItem>
                    {filterOptions.sector.map((option) => (
                      <MenuItem key={option} value={option}>
                        {option}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </TableCell>
              <TableCell align="right">—</TableCell>
              <TableCell align="right">—</TableCell>
              <TableCell align="right">—</TableCell>
              <TableCell align="right">—</TableCell>
              <TableCell sx={{ width: columnWidths.valuation }}>
                <FormControl size="small" fullWidth>
                  <Select
                    value={filters.valuation}
                    displayEmpty
                    onChange={handleFilter("valuation")}
                  >
                    <MenuItem value="">All</MenuItem>
                    {filterOptions.valuation.map((option) => (
                      <MenuItem key={option} value={option}>
                        {option}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </TableCell>
              <TableCell sx={{ width: columnWidths.si_verdict }}>
                <FormControl size="small" fullWidth>
                  <Select
                    value={filters.si_verdict}
                    displayEmpty
                    onChange={handleFilter("si_verdict")}
                  >
                    <MenuItem value="">All</MenuItem>
                    {filterOptions.si_verdict.map((option) => (
                      <MenuItem key={option} value={option}>
                        {option}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </TableCell>
              <TableCell sx={{ width: columnWidths.why_it_fits }}>
                <FormControl size="small" fullWidth>
                  <Select
                    value={filters.why_it_fits}
                    displayEmpty
                    onChange={handleFilter("why_it_fits")}
                  >
                    <MenuItem value="">All</MenuItem>
                    {filterOptions.why_it_fits.map((option) => (
                      <MenuItem key={option} value={option}>
                        {option}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
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
                        : String(h.valuation).toLowerCase().startsWith("over")
                          ? "warning"
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
