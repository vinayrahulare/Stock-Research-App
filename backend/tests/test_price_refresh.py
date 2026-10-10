from datetime import datetime, time, timezone
from decimal import Decimal

import pandas as pd
import pytest

from app import price_refresh
from app.models import AuditLog, DividendHolding
from app.price_refresh import (
    RefreshInProgressError,
    _last_close,
    fetch_latest_prices,
    next_run_after,
    refresh_prices,
)

from .conftest import add_holding


def fake_fetcher(prices):
    return lambda tickers: {t: Decimal(prices[t]) for t in tickers if t in prices}


def test_refresh_updates_price_yield_and_pe(db):
    add_holding(db, "KO", price="50.00", annual_div="2.00", pe="20.00")

    result = refresh_prices(db, fetcher=fake_fetcher({"KO": "62.5"}))

    row = db.query(DividendHolding).one()
    assert result.updated == 1 and result.failed_tickers == []
    assert row.price == Decimal("62.50")
    assert row.current_yield == Decimal("3.20")  # 2.00 / 62.50
    assert row.pe == Decimal("25.00")  # same implied earnings, higher price
    assert row.price_updated_at is not None
    # Report-derived fields are untouched.
    assert row.valuation == "Undervalued" and row.annual_div == Decimal("2.00")


def test_refresh_reports_missing_tickers_and_keeps_their_price(db):
    add_holding(db, "KO", price="50", annual_div="2")
    add_holding(db, "ZZZZ", price="10", annual_div="1")

    result = refresh_prices(db, fetcher=fake_fetcher({"KO": "55"}))

    assert result.updated == 1
    assert result.failed_tickers == ["ZZZZ"]
    missing = db.query(DividendHolding).filter_by(ticker="ZZZZ").one()
    assert missing.price == Decimal("10.00") and missing.price_updated_at is None


def test_refresh_leaves_missing_pe_empty(db):
    add_holding(db, "O", price="50", annual_div="3", pe=None)
    refresh_prices(db, fetcher=fake_fetcher({"O": "60"}))
    assert db.query(DividendHolding).one().pe is None


def test_refresh_rejects_concurrent_runs(db):
    add_holding(db, "KO", price="50", annual_div="2")
    assert price_refresh._refresh_lock.acquire(blocking=False)
    try:
        with pytest.raises(RefreshInProgressError):
            refresh_prices(db, fetcher=fake_fetcher({"KO": "55"}))
    finally:
        price_refresh._refresh_lock.release()


def test_fetch_retries_bare_tickers_on_tsx(monkeypatch):
    calls = []

    def fake_download(tickers):
        calls.append(list(tickers))
        known = {"KO": Decimal("60"), "ENB.TO": Decimal("55")}
        return {t: known[t] for t in tickers if t in known}

    monkeypatch.setattr(price_refresh, "_download_closes", fake_download)
    prices = fetch_latest_prices(["KO", "ENB", "BCE.TO"])

    assert prices == {"KO": Decimal("60"), "ENB": Decimal("55")}
    # Only the bare ticker that failed is retried; suffixed ones are not.
    assert calls == [["KO", "ENB", "BCE.TO"], ["ENB.TO"]]


def test_last_close_handles_grouped_frames_and_gaps():
    idx = pd.date_range("2026-10-05", periods=3)
    frame = pd.concat(
        {
            "KO": pd.DataFrame({"Close": [60.0, 61.25, None]}, index=idx),
            "BAD": pd.DataFrame({"Close": [None, None, None]}, index=idx),
        },
        axis=1,
    )
    assert _last_close(frame, "KO") == Decimal("61.25")
    assert _last_close(frame, "BAD") is None
    assert _last_close(frame, "MISSING") is None
    assert _last_close(pd.DataFrame(), "KO") is None


def test_next_run_skips_weekends():
    at = time(22, 30, tzinfo=timezone.utc)
    friday_late = datetime(2026, 10, 9, 23, 0, tzinfo=timezone.utc)
    monday_early = datetime(2026, 10, 12, 9, 0, tzinfo=timezone.utc)
    assert next_run_after(friday_late, at) == datetime(2026, 10, 12, 22, 30, tzinfo=timezone.utc)
    assert next_run_after(monday_early, at) == datetime(2026, 10, 12, 22, 30, tzinfo=timezone.utc)


def test_refresh_endpoint_returns_summary_and_logs(client, db, monkeypatch):
    add_holding(db, "KO", price="50", annual_div="2")
    add_holding(db, "ZZZZ", price="10", annual_div="1")
    monkeypatch.setattr(price_refresh, "fetch_latest_prices", fake_fetcher({"KO": "55"}))

    res = client.post("/api/holdings/refresh-prices")

    assert res.status_code == 200
    body = res.json()
    assert body["updated"] == 1 and body["failed_tickers"] == ["ZZZZ"]
    assert "no price found for ZZZZ" in body["message"]
    log = db.query(AuditLog).one()
    assert log.action == "refresh_prices" and log.updated_count == 1

    stats = client.get("/api/stats").json()
    assert stats["last_price_refresh"] is not None


def test_refresh_endpoint_reports_upstream_failure(client, db, monkeypatch):
    add_holding(db, "KO", price="50", annual_div="2")

    def boom(_tickers):
        raise ConnectionError("Yahoo unreachable")

    monkeypatch.setattr(price_refresh, "fetch_latest_prices", boom)
    res = client.post("/api/holdings/refresh-prices")

    assert res.status_code == 502
    assert db.query(AuditLog).one().status == "failed"
    assert db.query(DividendHolding).one().price == Decimal("50.00")


def test_csv_reimport_clears_refresh_timestamp(client, db):
    add_holding(db, "KO", price="50", annual_div="2")
    refresh_prices(db, fetcher=fake_fetcher({"KO": "55"}))

    csv_body = (
        "Ticker,Company,Sector,Price,P/E,Ann. Div,Cur. Yield,5-Yr Avg Yield,Valuation,"
        "Payout %,5-Yr Gr,SI Verdict,Why it fits\n"
        "KO,Coca-Cola,Staples,$52.00,22,$2.00,3.85%,3%,Fair,70%,4%,Yes,Steady\n"
    )
    res = client.post(
        "/api/holdings/import-csv?duplicate_strategy=replace",
        files={"file": ("h.csv", csv_body, "text/csv")},
    )
    assert res.status_code == 200, res.text
    row = db.query(DividendHolding).one()
    db.refresh(row)
    assert row.price == Decimal("52.00") and row.price_updated_at is None


def test_init_adds_price_updated_at_to_existing_table(monkeypatch):
    from sqlalchemy import create_engine, inspect, text

    from app import database

    engine = create_engine("sqlite://")
    with engine.begin() as conn:
        # Table as created before this column existed.
        conn.execute(text("CREATE TABLE dividend_holdings (id INTEGER PRIMARY KEY, ticker TEXT)"))
    monkeypatch.setattr(database, "engine", engine)

    database.init_db()
    database.init_db()  # second startup is a no-op

    columns = {c["name"] for c in inspect(engine).get_columns("dividend_holdings")}
    assert "price_updated_at" in columns
