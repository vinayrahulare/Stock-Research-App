import { Card, CardContent, Grid, Typography } from "@mui/material";
import type { StatsResponse } from "../types";

interface StatCardsProps {
  stats: StatsResponse | null;
}

export function StatCards({ stats }: StatCardsProps) {
  if (!stats) return null;

  return (
    <Grid container spacing={2}>
      <Grid item xs={12} sm={4}>
        <Card>
          <CardContent>
            <Typography color="text.secondary" variant="body2" gutterBottom>
              Total Holdings
            </Typography>
            <Typography variant="h4">{stats.total}</Typography>
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={12} sm={4}>
        <Card>
          <CardContent>
            <Typography color="text.secondary" variant="body2" gutterBottom>
              Average Yield
            </Typography>
            <Typography variant="h4">
              {stats.avg_yield != null ? `${Number(stats.avg_yield).toFixed(2)}%` : "—"}
            </Typography>
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={12} sm={4}>
        <Card>
          <CardContent>
            <Typography color="text.secondary" variant="body2" gutterBottom>
              Undervalued
            </Typography>
            <Typography variant="h4" color="success.main">
              {stats.undervalued_count}
            </Typography>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
}
