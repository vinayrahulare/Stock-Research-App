from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.models import DividendHolding


@pytest.fixture
def db():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client(db):
    app.dependency_overrides[get_db] = lambda: db
    try:
        # No `with`: skips the lifespan (Postgres init and the daily scheduler).
        yield TestClient(app)
    finally:
        app.dependency_overrides.clear()


def add_holding(db, ticker, price, annual_div, pe=None):
    row = DividendHolding(
        ticker=ticker,
        company=f"{ticker} Inc",
        sector="Utilities",
        price=Decimal(price),
        pe=Decimal(pe) if pe is not None else None,
        annual_div=Decimal(annual_div),
        current_yield=(Decimal(annual_div) / Decimal(price) * 100).quantize(Decimal("0.01")),
        valuation="Undervalued",
        si_verdict="Yes",
        why_it_fits="Steady payer",
    )
    db.add(row)
    db.commit()
    return row
