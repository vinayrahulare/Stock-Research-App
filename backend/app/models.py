from sqlalchemy import Column, String, Integer, Numeric, DateTime
from sqlalchemy.sql import func
from .database import Base


class DividendHolding(Base):
    __tablename__ = "dividend_holdings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    ticker = Column(String, unique=True, nullable=False, index=True)
    company = Column(String, nullable=False)
    sector = Column(String, nullable=False)
    price = Column(Numeric(12, 2), nullable=False)
    pe = Column(Numeric(8, 2), nullable=True)
    annual_div = Column(Numeric(8, 2), nullable=False)
    current_yield = Column(Numeric(6, 2), nullable=False)
    avg_yield_5y = Column(Numeric(6, 2), nullable=True)
    valuation = Column(String, nullable=False)
    payout_pct = Column(Numeric(6, 2), nullable=True)
    growth_5y = Column(Numeric(6, 2), nullable=True)
    si_verdict = Column(String, nullable=False)
    why_it_fits = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
