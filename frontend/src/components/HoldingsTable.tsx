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
} from "@mui/material";
import type { DividendHolding } from "../types";

interface HoldingsTableProps {
  rows: DividendHolding[];
  loading: boolean;
}

function num(v: string | number | null | undefined): string {
  if (v == null) return "—";
  const n = Number(v);
  return Number.isNaN(n) ? "—" : n.toFixed(2);
}

export function HoldingsTable({ rows, loading }: HoldingsTableProps) {
  if (loading) {
    return (
      <Paper sx={{ p: 4, textAlign: "center" }}>
        <CircularProgress />
      </Paper>
    );
  }

  if (rows.length === 0) {
    return (
      <Paper sx={{ p: 4, textAlign: "center" }}>
        <Typography color="text.secondary">
          No holdings yet. Import a dividend portfolio CSV to get started.
        </Typography>
      </Paper>
    );
  }

  return (
    <TableContainer component={Paper}>
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            <TableCell><strong>Ticker</strong></TableCell>
            <TableCell><strong>Company</strong></TableCell>
            <TableCell><strong>Sector</strong></TableCell>
            <TableCell align="right"><strong>Price</strong></TableCell>
            <TableCell align="right"><strong>P/E</strong></TableCell>
            <TableCell align="right"><strong>Ann. Div</strong></TableCell>
            <TableCell align="right"><strong>Cur. Yield</strong></TableCell>
            <TableCell><strong>Valuation</strong></TableCell>
            <TableCell><strong>SI Verdict</strong></TableCell>
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
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
