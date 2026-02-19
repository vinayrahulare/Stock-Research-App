import csv
from decimal import Decimal
from io import StringIO
from typing import List, Tuple

from .schemas import DividendHoldingCreate


def _parse_money(s: str) -> Decimal:
    return Decimal(s.replace("$", "").replace(",", "").strip() or "0")


def _parse_percent(s: str) -> Decimal:
    return Decimal(s.replace("%", "").strip() or "0")


def _parse_optional_decimal(s: str) -> Decimal | None:
    s = s.replace("%", "").replace("$", "").replace(",", "").strip()
    return Decimal(s) if s else None


def _split_csv_line(line: str) -> List[str]:
    result: List[str] = []
    current = ""
    in_quotes = False
    for i, ch in enumerate(line):
        if ch == '"':
            if in_quotes and i + 1 < len(line) and line[i + 1] == '"':
                current += '"'
                continue
            in_quotes = not in_quotes
        elif ch == "," and not in_quotes:
            result.append(current)
            current = ""
        else:
            current += ch
    result.append(current)
    return result


def parse_dividend_csv(content: str) -> Tuple[List[DividendHoldingCreate], List[dict]]:
    """
    Parse dividend portfolio CSV. Header: Ticker, Company, Sector, Price, P/E, Ann. Div,
    Cur. Yield, 5-Yr Avg Yield, Valuation, Payout %, 5-Yr Gr, SI Verdict, Why it fits.
    Returns (records, skipped_with_reasons).
    """
    reader = csv.reader(StringIO(content))
    rows = list(reader)
    if not rows:
        return [], []

    header = [c.strip().lower() for c in rows[0]]
    records: List[DividendHoldingCreate] = []
    skipped: List[dict] = []

    for i, row in enumerate(rows[1:], start=2):
        if len(row) < 13:
            skipped.append({"line": i, "reason": f"Not enough columns ({len(row)})"})
            continue
        try:
            ticker = row[0].strip()
            company = row[1].strip()
            sector = row[2].strip()
            price = _parse_money(row[3])
            pe = _parse_optional_decimal(row[4])
            annual_div = _parse_money(row[5])
            current_yield = _parse_percent(row[6])
            avg_yield_5y = _parse_optional_decimal(row[7])
            valuation = row[8].strip()
            payout_pct = _parse_optional_decimal(row[9])
            growth_5y = _parse_optional_decimal(row[10])
            si_verdict = row[11].strip()
            why_it_fits = row[12].strip() if len(row) > 12 else ""

            if not ticker:
                skipped.append({"line": i, "reason": "Missing ticker"})
                continue

            records.append(
                DividendHoldingCreate(
                    ticker=ticker,
                    company=company,
                    sector=sector,
                    price=price,
                    pe=pe,
                    annual_div=annual_div,
                    current_yield=current_yield,
                    avg_yield_5y=avg_yield_5y,
                    valuation=valuation,
                    payout_pct=payout_pct,
                    growth_5y=growth_5y,
                    si_verdict=si_verdict,
                    why_it_fits=why_it_fits,
                )
            )
        except Exception as e:
            skipped.append({"line": i, "reason": str(e)})

    return records, skipped
