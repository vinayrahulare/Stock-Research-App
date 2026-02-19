from decimal import Decimal
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session
from sqlalchemy import func

from .models import DividendHolding as DividendHoldingModel
from .schemas import DividendHolding, DividendHoldingCreate, StatsResponse


def _model_to_schema(m: DividendHoldingModel) -> DividendHolding:
    return DividendHolding(
        id=m.id,
        ticker=m.ticker,
        company=m.company,
        sector=m.sector,
        price=m.price,
        pe=m.pe,
        annual_div=m.annual_div,
        current_yield=m.current_yield,
        avg_yield_5y=m.avg_yield_5y,
        valuation=m.valuation,
        payout_pct=m.payout_pct,
        growth_5y=m.growth_5y,
        si_verdict=m.si_verdict,
        why_it_fits=m.why_it_fits,
        created_at=m.created_at,
    )


class HoldingStore:
    def __init__(self, db: Session):
        self.db = db

    def list(self) -> List[DividendHolding]:
        rows = self.db.query(DividendHoldingModel).order_by(
            DividendHoldingModel.valuation.asc(),
            DividendHoldingModel.ticker.asc(),
        ).all()
        return [_model_to_schema(r) for r in rows]

    def _apply_filters(self, q, filters: Dict[str, Any]):
        if not filters:
            return q
        if filters.get("ticker"):
            q = q.filter(
                DividendHoldingModel.ticker.ilike(f"%{filters['ticker'].strip()}%")
            )
        if filters.get("company"):
            q = q.filter(
                DividendHoldingModel.company.ilike(f"%{filters['company'].strip()}%")
            )
        if filters.get("sector"):
            q = q.filter(
                DividendHoldingModel.sector.ilike(f"%{filters['sector'].strip()}%")
            )
        if filters.get("valuation"):
            q = q.filter(
                DividendHoldingModel.valuation.ilike(
                    f"%{filters['valuation'].strip()}%"
                )
            )
        if filters.get("si_verdict"):
            q = q.filter(
                DividendHoldingModel.si_verdict.ilike(
                    f"%{filters['si_verdict'].strip()}%"
                )
            )
        if filters.get("why_it_fits"):
            q = q.filter(
                DividendHoldingModel.why_it_fits.ilike(
                    f"%{filters['why_it_fits'].strip()}%"
                )
            )
        return q

    def list_filtered(
        self,
        filters: Optional[Dict[str, str]] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> List[DividendHolding]:
        q = self.db.query(DividendHoldingModel).order_by(
            DividendHoldingModel.valuation.asc(),
            DividendHoldingModel.ticker.asc(),
        )
        q = self._apply_filters(q, filters or {})
        rows = q.offset(skip).limit(limit).all()
        return [_model_to_schema(r) for r in rows]

    def count_filtered(self, filters: Optional[Dict[str, str]] = None) -> int:
        q = self.db.query(func.count(DividendHoldingModel.id))
        q = self._apply_filters(q, filters or {})
        return q.scalar() or 0

    def purge(self) -> int:
        deleted = self.db.query(DividendHoldingModel).delete()
        self.db.commit()
        return deleted

    def get_by_ticker(self, ticker: str) -> Optional[DividendHolding]:
        row = self.db.query(DividendHoldingModel).filter(
            DividendHoldingModel.ticker == ticker
        ).first()
        return _model_to_schema(row) if row else None

    def upsert(self, data: DividendHoldingCreate) -> DividendHolding:
        row = self.db.query(DividendHoldingModel).filter(
            DividendHoldingModel.ticker == data.ticker
        ).first()
        payload = data.model_dump()
        if row:
            for k, v in payload.items():
                setattr(row, k, v)
            self.db.commit()
            self.db.refresh(row)
            return _model_to_schema(row)
        row = DividendHoldingModel(**payload)
        self.db.add(row)
        self.db.commit()
        self.db.refresh(row)
        return _model_to_schema(row)

    def bulk_upsert(self, items: List[DividendHoldingCreate]) -> int:
        count = 0
        for data in items:
            self.upsert(data)
            count += 1
        return count

    def stats(self) -> dict:
        total = self.db.query(func.count(DividendHoldingModel.id)).scalar() or 0
        if total == 0:
            return {"total": 0, "avg_yield": None, "undervalued_count": 0}
        avg = self.db.query(func.avg(DividendHoldingModel.current_yield)).scalar()
        undervalued = self.db.query(func.count(DividendHoldingModel.id)).filter(
            func.lower(DividendHoldingModel.valuation).like("under%")
        ).scalar() or 0
        return {
            "total": total,
            "avg_yield": float(avg) if avg is not None else None,
            "undervalued_count": undervalued,
        }
