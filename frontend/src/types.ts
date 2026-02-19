export interface DividendHolding {
  id: number;
  ticker: string;
  company: string;
  sector: string;
  price: string | number;
  pe: string | number | null;
  annual_div: string | number;
  current_yield: string | number;
  avg_yield_5y: string | number | null;
  valuation: string;
  payout_pct: string | number | null;
  growth_5y: string | number | null;
  si_verdict: string;
  why_it_fits: string;
  created_at: string;
}

export interface StatsResponse {
  total: number;
  avg_yield: number | null;
  undervalued_count: number;
}
