import argparse
import csv
import os
from dataclasses import dataclass
from typing import List, Optional, Dict, Any, Tuple, Iterable

import pandas as pd

try:
    import yfinance as yf
except ImportError:  # pragma: no cover - handled at runtime
    yf = None


TICKER_LIKE_HEADERS = {"ticker", "symbol", "stock", "underlying"}


@dataclass
class SheetSummary:
    name: str
    n_rows: int
    n_cols: int
    columns: List[str]
    inferred_ticker_cols: List[str]


@dataclass
class Table:
    name: str
    df: pd.DataFrame


def _is_ticker_column(series: pd.Series, header: str) -> bool:
    header_l = header.lower()
    if any(key in header_l for key in TICKER_LIKE_HEADERS):
        return True

    # Heuristic: many short uppercase-ish strings
    non_null = series.dropna().astype(str)
    if non_null.empty:
        return False
    short = non_null[non_null.str.len() <= 6]
    if short.empty:
        return False
    upper_ratio = (short.str.match(r"^[A-Z\.\-]+$")).mean()
    return upper_ratio >= 0.6


def _clean_tickers(tickers: Iterable[str]) -> List[str]:
    clean_tickers: List[str] = []
    seen = set()
    for t in tickers:
        if t is None:
            continue
        t = str(t).strip()
        if not t:
            continue
        if " " in t:
            continue
        if len(t) > 12:
            continue
        if t in seen:
            continue
        seen.add(t)
        clean_tickers.append(t)
    return clean_tickers


def _load_excel_tables(path: str) -> List[Table]:
    xl = pd.ExcelFile(path)
    tables: List[Table] = []
    for sheet_name in xl.sheet_names:
        df = xl.parse(sheet_name)
        tables.append(Table(name=str(sheet_name), df=df))
    return tables


def _is_expected_header(fields: List[str]) -> bool:
    fields_l = [f.strip().lower() for f in fields]
    return ("company name" in fields_l) and ("symbol" in fields_l)


def _parse_csv_tables(path: str) -> List[Table]:
    # This supports the “SI report” style where multiple tables appear in one CSV,
    # with title lines (e.g. "USA Stocks: Table 1"), repeated headers, blank lines,
    # and trailing instructional text.
    with open(path, "r", encoding="utf-8-sig", newline="") as f:
        reader = csv.reader(f)
        rows: List[List[str]] = [r for r in reader]

    tables: List[Table] = []
    i = 0
    while i < len(rows):
        r = rows[i]
        if not r or all(not c.strip() for c in r):
            i += 1
            continue

        if _is_expected_header(r):
            header = [c.strip() for c in r]
            title = ""
            # Look back for a one-cell title line
            for back in range(i - 1, max(-1, i - 5), -1):
                prev = rows[back] if back >= 0 else []
                if prev and prev[0].strip() and sum(1 for c in prev if c.strip()) == 1:
                    title = prev[0].strip()
                    break

            data_rows: List[List[str]] = []
            i += 1
            while i < len(rows):
                rr = rows[i]
                if not rr or all(not c.strip() for c in rr):
                    break
                # Stop if we hit another table header
                if _is_expected_header(rr):
                    i -= 1
                    break
                # Stop at obvious instruction section
                if rr and rr[0].strip().lower().startswith("how to "):
                    break

                # Normalize row length to header length
                rr = [c.strip() for c in rr]
                if len(rr) < len(header):
                    rr = rr + [""] * (len(header) - len(rr))
                elif len(rr) > len(header):
                    rr = rr[: len(header)]
                data_rows.append(rr)
                i += 1

            df = pd.DataFrame(data_rows, columns=header)
            name = title or "csv-table"
            tables.append(Table(name=name, df=df))
        i += 1

    # Fallback: if no tables detected, parse as a normal single-table CSV
    if not tables:
        df = pd.read_csv(path)
        tables.append(Table(name="csv", df=df))

    return tables


def _load_tables(path: str) -> Tuple[str, List[Table]]:
    ext = os.path.splitext(path)[1].lower()
    if ext in {".xlsx", ".xls"}:
        return "excel", _load_excel_tables(path)
    if ext == ".csv":
        return "csv", _parse_csv_tables(path)
    raise ValueError(f"Unsupported file type: {ext}")


def summarize_file(path: str) -> Dict[str, Any]:
    file_type, tables = _load_tables(path)
    summaries: List[SheetSummary] = []
    tickers: List[str] = []

    for table in tables:
        df = table.df
        inferred_ticker_cols: List[str] = []

        for col in df.columns:
            try:
                if _is_ticker_column(df[col], str(col)):
                    inferred_ticker_cols.append(str(col))
                    if str(col).strip().lower() == "symbol":
                        tickers.extend(df[col].dropna().tolist())
                    else:
                        tickers.extend(df[col].dropna().tolist())
            except Exception:
                continue

        summaries.append(
            SheetSummary(
                name=table.name,
                n_rows=len(df),
                n_cols=df.shape[1],
                columns=[str(c) for c in df.columns],
                inferred_ticker_cols=inferred_ticker_cols,
            )
        )

    return {
        "file_type": file_type,
        "tables": [s.__dict__ for s in summaries],
        "tickers": _clean_tickers(tickers),
    }


def fetch_yfinance_data(tickers: List[str], period: str = "1y") -> Dict[str, Any]:
    if yf is None:
        raise RuntimeError(
            "yfinance is not installed. Add 'yfinance' to requirements and reinstall."
        )

    info: Dict[str, Any] = {}
    history: Dict[str, pd.DataFrame] = {}

    for t in tickers:
        try:
            ticker = yf.Ticker(t)
            info[t] = ticker.info or {}
            hist = ticker.history(period=period)
            history[t] = hist
        except Exception:
            info.setdefault(t, {})
            history.setdefault(t, pd.DataFrame())

    return {"info": info, "history": history}


def _try_fetch_one(ticker: str, period: str) -> Tuple[Dict[str, Any], pd.DataFrame]:
    t = yf.Ticker(ticker)
    info = t.info or {}
    hist = t.history(period=period)
    return info, hist


def fetch_yfinance_data_with_table_hints(
    tickers_by_table: Dict[str, List[str]],
    period: str = "1y",
) -> Dict[str, Any]:
    if yf is None:
        raise RuntimeError(
            "yfinance is not installed. Add 'yfinance' to requirements and reinstall."
        )

    info: Dict[str, Any] = {}
    history: Dict[str, pd.DataFrame] = {}

    for table_name, tickers in tickers_by_table.items():
        is_cdn = "cdn" in table_name.lower() or "canada" in table_name.lower()
        for t in tickers:
            if t in info:
                continue
            candidates = [t]
            if is_cdn and not any(suffix in t for suffix in [".TO", ".V"]):
                candidates = [t + ".TO", t]

            last_info: Dict[str, Any] = {}
            last_hist = pd.DataFrame()
            for c in candidates:
                try:
                    last_info, last_hist = _try_fetch_one(c, period=period)
                    if not last_hist.empty:
                        info[t] = last_info
                        history[t] = last_hist
                        break
                except Exception:
                    continue
            else:
                info.setdefault(t, last_info or {})
                history.setdefault(t, last_hist if isinstance(last_hist, pd.DataFrame) else pd.DataFrame())

    return {"info": info, "history": history}


def compute_performance(history: Dict[str, pd.DataFrame]) -> pd.DataFrame:
    rows = []

    for t, df in history.items():
        if df.empty or "Close" not in df.columns:
            rows.append(
                {
                    "Ticker": t,
                    "1M Return": None,
                    "3M Return": None,
                    "6M Return": None,
                    "1Y Return": None,
                    "Ann. Volatility": None,
                    "Max Drawdown": None,
                }
            )
            continue

        close = df["Close"].dropna()
        if close.empty:
            continue

        ret = close.pct_change().dropna()
        if ret.empty:
            continue

        total_return = (close.iloc[-1] / close.iloc[0]) - 1
        ann_vol = (ret.std() * (252 ** 0.5)) if len(ret) > 1 else None

        running_max = close.cummax()
        drawdowns = close / running_max - 1
        max_dd = drawdowns.min()

        def period_return(days: int) -> Optional[float]:
            if len(close) <= days:
                return None
            return (close.iloc[-1] / close.iloc[-days - 1]) - 1

        rows.append(
            {
                "Ticker": t,
                "1M Return": period_return(21),
                "3M Return": period_return(63),
                "6M Return": period_return(126),
                "1Y Return": total_return,
                "Ann. Volatility": ann_vol,
                "Max Drawdown": max_dd,
            }
        )

    return pd.DataFrame(rows)


def build_overview_table(info: Dict[str, Any]) -> pd.DataFrame:
    rows = []
    for t, meta in info.items():
        meta = meta or {}
        rows.append(
            {
                "Ticker": t,
                "Name": meta.get("shortName") or meta.get("longName"),
                "Sector": meta.get("sector"),
                "Market Cap": meta.get("marketCap"),
                "P/E": meta.get("trailingPE") or meta.get("forwardPE"),
                "Dividend Yield": meta.get("dividendYield"),
            }
        )
    return pd.DataFrame(rows)


def format_markdown_table(df: pd.DataFrame, float_precision: int = 4) -> str:
    if df.empty:
        return "_No data._"
    df_fmt = df.copy()
    for col in df_fmt.columns:
        if pd.api.types.is_numeric_dtype(df_fmt[col]):
            df_fmt[col] = df_fmt[col].round(float_precision)
    return df_fmt.to_markdown(index=False)


def _tickers_by_table(tables: List[Table], max_tickers: int) -> Dict[str, List[str]]:
    out: Dict[str, List[str]] = {}
    for table in tables:
        df = table.df
        if "Symbol" in df.columns:
            out[table.name] = _clean_tickers(df["Symbol"].dropna().tolist())[:max_tickers]
            continue
        # fallback: infer via heuristic
        candidates: List[str] = []
        for col in df.columns:
            try:
                if _is_ticker_column(df[col], str(col)):
                    candidates.extend(df[col].dropna().tolist())
            except Exception:
                continue
        out[table.name] = _clean_tickers(candidates)[:max_tickers]
    return out


def analyze_file(path: str, max_tickers: int = 100, period: str = "1y") -> None:
    file_type, tables = _load_tables(path)
    summary = summarize_file(path)
    table_summaries = summary["tables"]

    tickers_by_table = _tickers_by_table(tables, max_tickers=max_tickers)
    tickers = _clean_tickers([t for ts in tickers_by_table.values() for t in ts])[:max_tickers]

    print(f"## File Structure ({file_type})")
    print()
    if not table_summaries:
        print("No tables found.")
    else:
        for s in table_summaries:
            print(f"- **{s['name']}**: {s['n_rows']} rows, {s['n_cols']} cols")
            if s["inferred_ticker_cols"]:
                print(f"  - Ticker-like columns: {', '.join(s['inferred_ticker_cols'])}")

    print()
    print("## Tickers")
    print()
    if not tickers:
        print("No tickers inferred from the file.")
        return

    print(f"Found {len(tickers)} unique tickers (showing up to {max_tickers}):")
    print(", ".join(tickers))
    print()

    data = fetch_yfinance_data_with_table_hints(tickers_by_table, period=period)
    overview = build_overview_table(data["info"])
    perf = compute_performance(data["history"])

    print("## Ticker Overview")
    print()
    print(format_markdown_table(overview))
    print()

    print("## Performance Summary")
    print()
    print(format_markdown_table(perf))


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Analyze an Excel/CSV file with stock tickers using yfinance."
    )
    parser.add_argument("path", help="Path to the Excel (.xlsx) or CSV (.csv) file")
    parser.add_argument(
        "--max-tickers",
        type=int,
        default=100,
        help="Maximum number of tickers to analyze (default: 100)",
    )
    parser.add_argument(
        "--period",
        default="1y",
        help="Price history period to request from yfinance (default: 1y)",
    )
    args = parser.parse_args()

    analyze_file(args.path, max_tickers=args.max_tickers, period=args.period)


if __name__ == "__main__":
    main()

