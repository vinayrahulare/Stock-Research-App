import time
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from .csv_parser import parse_dividend_csv
from .database import get_db, init_db
from .schemas import (
    DividendHolding,
    DividendHoldingCreate,
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
    title="SI Investing App",
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
    page: int = 1,
    page_size: int = 10,
) -> HoldingsListResponse:
    store = HoldingStore(db)
    filters = {}
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
    page = max(1, page)
    page_size = min(max(1, page_size), 100)
    skip = (page - 1) * page_size
    items = store.list_filtered(filters=filters or None, skip=skip, limit=page_size)
    total = store.count_filtered(filters=filters or None)
    return HoldingsListResponse(items=items, total=total)


@app.delete("/api/holdings/purge", response_model=dict)
def purge_holdings(db: Session = Depends(get_db)) -> dict:
    store = HoldingStore(db)
    deleted = store.purge()
    return {"message": f"Purged {deleted} holdings", "deleted": deleted}


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
    db: Session = Depends(get_db),
) -> dict:
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="File must be a CSV")

    try:
        content = (await file.read()).decode("utf-8")
    except UnicodeDecodeError as e:
        raise HTTPException(status_code=400, detail=f"Invalid encoding: {e}")

    try:
        records, skipped = parse_dividend_csv(content)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse CSV: {e}")

    if not records:
        raise HTTPException(
            status_code=400,
            detail="No valid records. Expected columns: Ticker, Company, Sector, Price, P/E, Ann. Div, Cur. Yield, 5-Yr Avg Yield, Valuation, Payout %, 5-Yr Gr, SI Verdict, Why it fits",
        )

    store = HoldingStore(db)
    count = store.bulk_upsert(records)
    return {
        "message": f"Imported {count} holdings",
        "imported": count,
        "skipped": len(skipped),
        "skipped_details": skipped,
    }
