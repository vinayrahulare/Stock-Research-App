from datetime import datetime
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field


class DividendHoldingBase(BaseModel):
    ticker: str
    company: str
    sector: str
    price: Decimal = Field(..., ge=0)
    pe: Optional[Decimal] = None
    annual_div: Decimal = Field(..., ge=0)
    current_yield: Decimal = Field(..., ge=0)
    avg_yield_5y: Optional[Decimal] = None
    valuation: str
    payout_pct: Optional[Decimal] = None
    growth_5y: Optional[Decimal] = None
    si_verdict: str
    why_it_fits: str


class DividendHoldingCreate(DividendHoldingBase):
    pass


class DividendHolding(DividendHoldingBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class StatsResponse(BaseModel):
    total: int
    avg_yield: Optional[float] = None
    undervalued_count: int
