import argparse
from dataclasses import dataclass
from typing import List, Optional, Dict, Any

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


def summarize_excel(path: str) -> Dict[str, Any]:
    xl = pd.ExcelFile(path)
    summaries: List[SheetSummary] = []
    tickers: List[str] = []

    for sheet_name in xl.sheet_names:
        df = xl.parse(sheet_name)
        inferred_ticker_cols: List[str] = []

        for col in df.columns:
            try:
                if _is_ticker_column(df[col], str(col)):
                    inferred_ticker_cols.append(str(col))
                    tickers.extend(
                        df[col]
                        .dropna()
                        .astype(str)
                        .str.strip()
                        .tolist()
                    )
            except Exception:
                continue

        summaries.append(
            SheetSummary(
                name=sheet_name,
                n_rows=len(df),
                n_cols=df.shape[1],
                columns=[str(c) for c in df.columns],
                inferred_ticker_cols=inferred_ticker_cols,
            )
        )

    clean_tickers = []
    seen = set()
    for t in tickers:
        if not t:
            continue
        if " " in t:
            continue
        if len(t) > 10:
            continue
        if t in seen:
            continue
        seen.add(t)
        clean_tickers.append(t)

    return {
        "sheets": [s.__dict__ for s in summaries],
        "tickers": clean_tickers,
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


def analyze_excel(path: str, max_tickers: int = 100) -> None:
    summary = summarize_excel(path)
    sheets = summary["sheets"]
    tickers: List[str] = summary["tickers"][:max_tickers]

    print("## Excel Structure")
    print()
    if not sheets:
        print("No sheets found.")
    else:
        for s in sheets:
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

    data = fetch_yfinance_data(tickers)
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
        description="Analyze an Excel file with stock tickers using yfinance."
    )
    parser.add_argument("path", help="Path to the Excel (.xlsx) file")
    parser.add_argument(
        "--max-tickers",
        type=int,
        default=100,
        help="Maximum number of tickers to analyze (default: 100)",
    )
    args = parser.parse_args()

    analyze_excel(args.path, max_tickers=args.max_tickers)


if __name__ == "__main__":
    main()

