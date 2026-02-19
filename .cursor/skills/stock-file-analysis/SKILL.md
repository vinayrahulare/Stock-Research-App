---
name: stock-file-analysis
description: Parse Excel (.xlsx) and CSV (.csv) files containing stock tickers (including multi-table SI report CSVs), infer schema, extract tickers from Symbol/Ticker-like columns, and run fundamentals/performance analysis via yfinance. Use whenever the user attaches a spreadsheet/CSV with stock symbols and wants repeated, consistent analysis.
---

# Stock File Analysis (Excel + CSV)

Use this skill when the user provides a `.xlsx` or `.csv` file and wants you to understand its structure and analyze the stock tickers in it.

## Default workflow

1. **Inspect the file structure**
   - For Excel: treat each sheet as a separate table.
   - For CSV: detect whether it is:
     - **Single-table CSV**, or
     - **Multi-table report CSV** (e.g., “USA Stocks: Table 1”, “CDN Stocks: Table 1”) with repeated header rows, blank separators, and non-data instruction sections.

2. **Extract tickers**
   - Prefer the `Symbol` column if present.
   - Otherwise infer ticker-like columns using:
     - header keywords (`symbol`, `ticker`, `stock`, `underlying`)
     - values that look like tickers (short, uppercase-ish strings)
   - Clean and deduplicate tickers, preserving order.

3. **Run the analyzer script**
   - Use the repo helper:
     - `scripts/excel_stock_analysis.py`
   - Example:

```bash
python scripts/excel_stock_analysis.py "path/to/file.csv" --max-tickers 100 --period 1y
```

4. **Interpret results and present tables**
   - Keep output **table-first**:
     - Ticker overview (name/sector/market cap/P-E/div yield)
     - Performance summary (1M/3M/6M/1Y, volatility, max drawdown)
   - If yfinance fails for a subset, present an “Unresolved tickers” list and continue.

## SI report CSV specifics (important)

When the file matches the “SI report” pattern:

- Treat each section with the header row starting with **`Company Name,Symbol,...`** as a distinct table.
- Ignore instructional sections like **“How to Sort Data”**.
- For **Canadian** sections (table title includes “CDN”/“Canada”):
  - If a ticker fetch fails, retry with a TSX suffix (e.g., `RY` → `RY.TO`).

## What to ask from the user (only if needed)

- If a CSV has ambiguous structure or no `Symbol` column, ask which column contains tickers.
- If analysis should be limited to a subset, ask for:
  - a max ticker count, or
  - a filter rule (e.g., only `SI Criteria >= 8`, only undervalued `U`).

