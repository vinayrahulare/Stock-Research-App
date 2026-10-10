"""Refresh holding prices from Yahoo Finance (via yfinance).

Each refresh pulls the latest daily close for every holding, then recalculates the
fields that depend on price: current yield (annual dividend / price) and P/E
(earnings are implied from the previous price and P/E, so P/E scales with price).
Fields that come from the research report (valuation, verdict, 5-yr averages)
are left untouched.
"""

import asyncio
import logging
import os
import threading
from dataclasses import dataclass, field
from datetime import datetime, time as dtime, timedelta, timezone
from decimal import ROUND_HALF_UP, Decimal
from typing import Callable, Dict, List

from sqlalchemy.orm import Session

from .database import SessionLocal
from .models import DividendHolding as DividendHoldingModel
from .store import HoldingStore

logger = logging.getLogger(__name__)

# Maps ticker -> latest close price. Tickers with no price are left out.
PriceFetcher = Callable[[List[str]], Dict[str, Decimal]]

TWO_PLACES = Decimal("0.01")
BATCH_SIZE = 50

# Only one refresh at a time (manual button and daily schedule share this).
_refresh_lock = threading.Lock()


class RefreshInProgressError(RuntimeError):
    pass


@dataclass
class RefreshResult:
    updated: int = 0
    failed_tickers: List[str] = field(default_factory=list)
    refreshed_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    @property
    def total(self) -> int:
        return self.updated + len(self.failed_tickers)


def _last_close(frame, ticker: str) -> Decimal | None:
    """Pull the most recent non-empty close for `ticker` out of a yf.download frame."""
    if frame is None or frame.empty:
        return None
    try:
        if getattr(frame.columns, "nlevels", 1) > 1:
            if ticker not in frame.columns.get_level_values(0):
                return None
            closes = frame[ticker]["Close"]
        else:
            closes = frame["Close"]
    except KeyError:
        return None
    closes = closes.dropna()
    if closes.empty:
        return None
    value = Decimal(str(float(closes.iloc[-1])))
    return value if value > 0 else None


def _download_closes(tickers: List[str]) -> Dict[str, Decimal]:
    import yfinance as yf

    prices: Dict[str, Decimal] = {}
    for start in range(0, len(tickers), BATCH_SIZE):
        batch = tickers[start : start + BATCH_SIZE]
        frame = yf.download(
            batch,
            period="5d",
            interval="1d",
            group_by="ticker",
            auto_adjust=False,
            progress=False,
            threads=True,
        )
        for t in batch:
            price = _last_close(frame, t)
            if price is not None:
                prices[t] = price
    return prices


def fetch_latest_prices(tickers: List[str]) -> Dict[str, Decimal]:
    """Latest daily close per ticker from Yahoo Finance.

    Tickers that Yahoo doesn't know as-is and have no exchange suffix are retried
    on the TSX (".TO"), since the research reports list Canadian stocks without one.
    """
    prices = _download_closes(tickers)
    retry = {f"{t}.TO": t for t in tickers if t not in prices and "." not in t}
    if retry:
        for yahoo_ticker, price in _download_closes(list(retry)).items():
            prices[retry[yahoo_ticker]] = price
    return prices


def _round(value: Decimal) -> Decimal:
    return value.quantize(TWO_PLACES, rounding=ROUND_HALF_UP)


def apply_new_price(row: DividendHoldingModel, new_price: Decimal, when: datetime) -> None:
    new_price = _round(new_price)
    old_price = Decimal(row.price) if row.price is not None else None
    if row.pe is not None and old_price and old_price > 0:
        row.pe = _round(Decimal(row.pe) * new_price / old_price)
    if new_price > 0:
        row.current_yield = _round(Decimal(row.annual_div) / new_price * 100)
    row.price = new_price
    row.price_updated_at = when


def refresh_prices(db: Session, fetcher: PriceFetcher | None = None) -> RefreshResult:
    """Refresh all holdings' prices. Raises RefreshInProgressError if one is already running."""
    fetcher = fetcher or fetch_latest_prices
    if not _refresh_lock.acquire(blocking=False):
        raise RefreshInProgressError("A price refresh is already running")
    try:
        rows = db.query(DividendHoldingModel).all()
        result = RefreshResult()
        if not rows:
            return result
        prices = fetcher(sorted({r.ticker for r in rows}))
        for row in rows:
            price = prices.get(row.ticker)
            if price is None:
                result.failed_tickers.append(row.ticker)
                continue
            apply_new_price(row, price, result.refreshed_at)
            result.updated += 1
        db.commit()
        result.failed_tickers.sort()
        return result
    finally:
        _refresh_lock.release()


def describe(result: RefreshResult, trigger: str) -> str:
    message = f"Refreshed {result.updated} of {result.total} prices ({trigger})"
    if result.failed_tickers:
        shown = ", ".join(result.failed_tickers[:10])
        more = len(result.failed_tickers) - 10
        message += f"; no price found for {shown}" + (f" and {more} more" if more > 0 else "")
    return message


# --- Daily schedule -------------------------------------------------------------

def schedule_enabled() -> bool:
    return os.getenv("PRICE_REFRESH_ENABLED", "true").strip().lower() not in {"0", "false", "no"}


def _scheduled_time() -> dtime:
    # Default 22:30 UTC: after the 4pm ET close in both EST and EDT.
    raw = os.getenv("PRICE_REFRESH_TIME_UTC", "22:30")
    try:
        hour, minute = (int(p) for p in raw.split(":"))
        return dtime(hour, minute, tzinfo=timezone.utc)
    except ValueError:
        logger.warning("Invalid PRICE_REFRESH_TIME_UTC=%r, using 22:30", raw)
        return dtime(22, 30, tzinfo=timezone.utc)


def next_run_after(now: datetime, at: dtime) -> datetime:
    """Next weekday (Mon–Fri) occurrence of `at` strictly after `now`."""
    candidate = datetime.combine(now.date(), at)
    if candidate <= now:
        candidate += timedelta(days=1)
    while candidate.weekday() >= 5:
        candidate += timedelta(days=1)
    return candidate


def _run_scheduled_refresh() -> None:
    db = SessionLocal()
    try:
        store = HoldingStore(db)
        try:
            result = refresh_prices(db)
        except RefreshInProgressError:
            return
        except Exception as e:  # network / Yahoo errors shouldn't kill the scheduler
            db.rollback()
            logger.exception("Scheduled price refresh failed")
            store.create_audit_log(
                action="refresh_prices",
                file_name=None,
                imported_count=0,
                updated_count=0,
                status="failed",
                message=f"Scheduled price refresh failed: {e}",
            )
            return
        if result.total == 0:
            return
        store.create_audit_log(
            action="refresh_prices",
            file_name=None,
            imported_count=0,
            updated_count=result.updated,
            status="success" if result.updated else "failed",
            message=describe(result, "scheduled"),
        )
    finally:
        db.close()


async def run_daily_schedule() -> None:
    at = _scheduled_time()
    while True:
        now = datetime.now(timezone.utc)
        wait = (next_run_after(now, at) - now).total_seconds()
        await asyncio.sleep(wait)
        await asyncio.to_thread(_run_scheduled_refresh)
