import time
from contextlib import asynccontextmanager
from io import StringIO
import csv

from fastapi import Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from sqlalchemy.orm import Session

from .csv_parser import parse_dividend_csv
from .database import get_db, init_db
from .schemas import (
    AuditLogEntry,
    DividendHolding,
    DividendHoldingCreate,
    HoldingsFilterOptionsResponse,
    HoldingsListResponse,
    StatsResponse,
)
from .store import HoldingStore


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Retry init_db so we tolerate postgres being briefly unavailable at startup
    for attempt in range(5):
        try:
            init_db()
            break
        except Exception as e:
            if attempt == 4:
                raise
            time.sleep(2)
    yield


app = FastAPI(
    title="Stock-Research-App",
    version="0.1.0",
    description="Dividend portfolio dashboard",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/api/holdings", response_model=HoldingsListResponse)
def list_holdings(
    db: Session = Depends(get_db),
    ticker: str | None = None,
    company: str | None = None,
    sector: str | None = None,
    valuation: str | None = None,
    si_verdict: str | None = None,
    why_it_fits: str | None = None,
    ticker_search: str | None = None,
    sort_by: str = "valuation",
    sort_order: str = "asc",
    page: int = 1,
    page_size: int = 10,
) -> HoldingsListResponse:
    store = HoldingStore(db)
    filters = _build_filters(
        ticker=ticker,
        company=company,
        sector=sector,
        valuation=valuation,
        si_verdict=si_verdict,
        why_it_fits=why_it_fits,
        ticker_search=ticker_search,
    )
    page = max(1, page)
    page_size = min(max(1, page_size), 100)
    skip = (page - 1) * page_size
    items = store.list_filtered(
        filters=filters or None,
        skip=skip,
        limit=page_size,
        sort_by=sort_by,
        sort_order=sort_order,
    )
    total = store.count_filtered(filters=filters or None)
    return HoldingsListResponse(items=items, total=total)


@app.get("/api/holdings/export-csv", response_class=Response)
def export_holdings_csv(
    db: Session = Depends(get_db),
    ticker: str | None = None,
    company: str | None = None,
    sector: str | None = None,
    valuation: str | None = None,
    si_verdict: str | None = None,
    why_it_fits: str | None = None,
    ticker_search: str | None = None,
    sort_by: str = "valuation",
    sort_order: str = "asc",
) -> Response:
    store = HoldingStore(db)
    filters = _build_filters(
        ticker=ticker,
        company=company,
        sector=sector,
        valuation=valuation,
        si_verdict=si_verdict,
        why_it_fits=why_it_fits,
        ticker_search=ticker_search,
    )
    total = store.count_filtered(filters=filters or None)
    rows = store.list_filtered(
        filters=filters or None,
        skip=0,
        limit=max(total, 1),
        sort_by=sort_by,
        sort_order=sort_order,
    )

    output = StringIO()
    writer = csv.writer(output)
    writer.writerow(
        [
            "Ticker",
            "Company",
            "Sector",
            "Price",
            "P/E",
            "Ann. Div",
            "Cur. Yield",
            "Valuation",
            "High Quality",
            "Why it fits",
        ]
    )
    for h in rows:
        writer.writerow(
            [
                h.ticker,
                h.company,
                h.sector,
                h.price,
                h.pe if h.pe is not None else "",
                h.annual_div,
                h.current_yield,
                h.valuation,
                h.si_verdict,
                h.why_it_fits,
            ]
        )

    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="holdings-export.csv"'},
    )


@app.get("/api/holdings/filter-options", response_model=HoldingsFilterOptionsResponse)
def holdings_filter_options(db: Session = Depends(get_db)) -> HoldingsFilterOptionsResponse:
    store = HoldingStore(db)
    return HoldingsFilterOptionsResponse(**store.get_filter_options())


@app.delete("/api/holdings/purge", response_model=dict)
def purge_holdings(db: Session = Depends(get_db)) -> dict:
    store = HoldingStore(db)
    deleted = store.purge()
    store.create_audit_log(
        action="purge_holdings",
        file_name=None,
        imported_count=0,
        updated_count=deleted,
        status="success",
        message=f"Purged {deleted} holdings",
    )
    return {"message": f"Purged {deleted} holdings", "deleted": deleted}


@app.get("/api/audit-logs", response_model=list[AuditLogEntry])
def list_audit_logs(limit: int = 100, db: Session = Depends(get_db)) -> list[AuditLogEntry]:
    store = HoldingStore(db)
    return store.list_audit_logs(limit=limit)


@app.post("/api/holdings", response_model=DividendHolding, status_code=201)
def create_holding(
    payload: DividendHoldingCreate,
    db: Session = Depends(get_db),
) -> DividendHolding:
    store = HoldingStore(db)
    return store.upsert(payload)


@app.get("/api/stats", response_model=StatsResponse)
def get_stats(db: Session = Depends(get_db)) -> StatsResponse:
    store = HoldingStore(db)
    return StatsResponse(**store.stats())


@app.post("/api/holdings/import-csv", response_model=dict)
async def import_csv(
    file: UploadFile = File(...),
    duplicate_strategy: str = "ask",
    db: Session = Depends(get_db),
) -> dict:
    store = HoldingStore(db)
    file_name = file.filename or ""

    if not file_name.lower().endswith(".csv"):
        store.create_audit_log(
            action="import_csv",
            file_name=file_name or None,
            imported_count=0,
            updated_count=0,
            status="failed",
            message="File must be a CSV",
        )
        raise HTTPException(status_code=400, detail="File must be a CSV")

    try:
        content = (await file.read()).decode("utf-8")
    except UnicodeDecodeError as e:
        store.create_audit_log(
            action="import_csv",
            file_name=file_name or None,
            imported_count=0,
            updated_count=0,
            status="failed",
            message=f"Invalid encoding: {e}",
        )
        raise HTTPException(status_code=400, detail=f"Invalid encoding: {e}")

    try:
        records, skipped = parse_dividend_csv(content)
    except Exception as e:
        store.create_audit_log(
            action="import_csv",
            file_name=file_name or None,
            imported_count=0,
            updated_count=0,
            status="failed",
            message=f"Failed to parse CSV: {e}",
        )
        raise HTTPException(status_code=400, detail=f"Failed to parse CSV: {e}")

    if not records:
        store.create_audit_log(
            action="import_csv",
            file_name=file_name or None,
            imported_count=0,
            updated_count=0,
            status="failed",
            message="No valid records found in CSV",
        )
        raise HTTPException(
            status_code=400,
            detail="No valid records. Expected columns: Ticker, Company, Sector, Price, P/E, Ann. Div, Cur. Yield, 5-Yr Avg Yield, Valuation, Payout %, 5-Yr Gr, SI Verdict, Why it fits",
        )
    strategy = (duplicate_strategy or "ask").strip().lower()
    if strategy not in {"ask", "skip", "replace"}:
        raise HTTPException(
            status_code=400,
            detail='duplicate_strategy must be one of: "ask", "skip", "replace"',
        )

    existing = store.existing_tickers([r.ticker for r in records])
    duplicate_tickers = sorted({r.ticker for r in records if r.ticker in existing})

    if duplicate_tickers and strategy == "ask":
        message = (
            f"Found {len(duplicate_tickers)} duplicate ticker(s): "
            f"{', '.join(duplicate_tickers[:10])}"
        )
        store.create_audit_log(
            action="import_csv",
            file_name=file_name or None,
            imported_count=0,
            updated_count=0,
            status="failed",
            message=f"{message}. User choice required: skip or replace.",
        )
        raise HTTPException(
            status_code=409,
            detail={
                "message": message,
                "duplicates_detected": len(duplicate_tickers),
                "duplicate_tickers": duplicate_tickers,
                "action_required": "choose_duplicate_strategy",
                "allowed_strategies": ["skip", "replace"],
            },
        )

    if strategy == "skip":
        filtered_records = [r for r in records if r.ticker not in existing]
        counts = store.bulk_upsert_counts(filtered_records)
        duplicate_skipped = len(duplicate_tickers)
        store.create_audit_log(
            action="import_csv",
            file_name=file_name or None,
            imported_count=counts["imported"],
            updated_count=0,
            status="success",
            message=(
                f"Imported {counts['imported']} new holdings, "
                f"skipped {duplicate_skipped} duplicate ticker(s)"
            ),
        )
        return {
            "message": (
                f"Imported {counts['imported']} new holdings; "
                f"skipped {duplicate_skipped} duplicate ticker(s)"
            ),
            "imported": counts["imported"],
            "updated": 0,
            "duplicates_detected": len(duplicate_tickers),
            "duplicate_tickers": duplicate_tickers,
            "duplicate_skipped": duplicate_skipped,
            "total_processed": counts["imported"],
            "skipped": len(skipped) + duplicate_skipped,
            "skipped_details": skipped,
        }

    counts = store.bulk_upsert_counts(records)
    store.create_audit_log(
        action="import_csv",
        file_name=file_name or None,
        imported_count=counts["imported"],
        updated_count=counts["updated"],
        status="success",
        message=(
            f"Imported {counts['imported']} new and updated {counts['updated']} "
            f"duplicate holding(s)"
        ),
    )
    return {
        "message": (
            f"Imported {counts['imported']} new holdings; "
            f"updated {counts['updated']} duplicate holding(s)"
        ),
        "imported": counts["imported"],
        "updated": counts["updated"],
        "duplicates_detected": len(duplicate_tickers),
        "duplicate_tickers": duplicate_tickers,
        "duplicate_skipped": 0,
        "total_processed": counts["total"],
        "skipped": len(skipped),
        "skipped_details": skipped,
    }


def _build_filters(
    ticker: str | None,
    company: str | None,
    sector: str | None,
    valuation: str | None,
    si_verdict: str | None,
    why_it_fits: str | None,
    ticker_search: str | None,
) -> dict[str, str]:
    filters: dict[str, str] = {}
    if ticker:
        filters["ticker"] = ticker
    if company:
        filters["company"] = company
    if sector:
        filters["sector"] = sector
    if valuation:
        filters["valuation"] = valuation
    if si_verdict:
        filters["si_verdict"] = si_verdict
    if why_it_fits:
        filters["why_it_fits"] = why_it_fits
    if ticker_search:
        filters["ticker_search"] = ticker_search
    return filters
